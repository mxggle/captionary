import { getMessages, resolveUILocale } from '@/lib/i18n';
import { languageName, sameLang } from '@/lib/languages';
import { runJob } from '@/lib/messaging';
import { parseGlosses } from '@/lib/ai/prompts';
import type { Settings } from '@/lib/settings';
import {
  cleanGloss,
  findListedPhrases,
  hintLevelFor,
  hintLevelName,
  hintScaleFor,
  MAX_PHRASES_PER_LINE,
  outsidePhrases,
  pickHintTokens,
  type LineHints,
} from '@/lib/text/hints';
import { findPhrases, locateChunk, normalizeWord, tokenize } from '@/lib/text/tokenize';
import { vocabKeys } from '@/lib/vocab';
import { buildVocabIndex } from '@/ui/vocab-index';
import { chromeTranslatorState, getChromeTranslator, translateWithChrome } from '@/lib/translate';
import { getSession, setSession, type SessionState } from './store';

/** Lines glossed ahead of the one playing, so a hint is there when its line comes up. */
const AHEAD = { chrome: 4, ai: 10 } as const;

function overlaps(a: { start: number; end: number }, list: { start: number; end: number }[]): boolean {
  return list.some((b) => a.start <= b.end && b.start <= a.end);
}

/** Whether definition hints apply to this video: on, and the video is in the language being learned. */
export function hintsApply(s: Pick<SessionState, 'settings' | 'lang'>): boolean {
  const { settings, lang } = s;
  if (!settings.subtitles.definitionHints || !lang || sameLang(lang, settings.nativeLanguage)) return false;
  return settings.targetLanguage === 'auto' || sameLang(lang, settings.targetLanguage);
}

/** The vocabulary level hints use for a language, as the pickers show it ("JLPT N3", "HSK 4", "B1"). */
export function hintLevelLabel(settings: Settings, lang: string): string {
  const scale = hintScaleFor(lang);
  return hintLevelName(scale, hintLevelFor(scale, settings.subtitles.hintLevels, settings.learnerLevel));
}

/** Settings that change which words get hints, or what they say. */
function hintKey(s: Pick<SessionState, 'settings' | 'lang' | 'cues'>): string {
  const sub = s.settings.subtitles;
  return JSON.stringify([
    sub.definitionHints,
    sub.hintLevels,
    sub.hintSource,
    s.settings.learnerLevel,
    s.settings.nativeLanguage,
    s.settings.targetLanguage,
    s.lang,
  ]);
}

/**
 * Glosses for difficult words and phrases in the lines around the one playing (`SessionState.hints`).
 * Which words is decided here once per line (see `pickHintTokens`); phrases are the learner's saved
 * ones still being learned (with their saved translation), plus the built-in English list on-device
 * (`findListedPhrases`) or whatever the tutor finds. Glosses come from Chrome's on-device translator,
 * one item at a time, or from the tutor, a batch of lines at a time.
 */
export class HintLoader {
  private generation = 0;
  private key = '';
  private cues: SessionState['cues'] | null = null;
  private frequency: SessionState['frequency'] = null;
  private pending = new Set<number>();
  /** On-device glosses by language pair and word, kept across videos. */
  private words = new Map<string, string>();
  /** Problems already told to the learner, so a toast shows once per setting. */
  private told = new Set<string>();
  private busy = false;

  constructor(private toast: (text: string) => void) {}

  /** Called on every session change; cheap when nothing new is needed. */
  update() {
    let s = getSession();
    const key = hintKey(s);
    // A new frequency map (another language's, or the first one) changes which words are difficult.
    if (key !== this.key || s.cues !== this.cues || s.frequency !== this.frequency) {
      this.key = key;
      this.cues = s.cues;
      this.frequency = s.frequency;
      this.generation++;
      this.pending.clear();
      this.busy = false;
      if (Object.keys(s.hints).length) {
        setSession({ hints: {} });
        s = getSession();
      }
    }
    if (!hintsApply(s) || s.status !== 'ready' || s.off || !s.frequency || !s.cues.length || this.busy) return;
    const source = s.settings.subtitles.hintSource;
    const from = Math.max(0, s.activeIndex >= 0 ? s.activeIndex : s.lastIndex);
    const ahead = AHEAD[source];
    // The tutor is asked in batches: once fewer than half the lines ahead are ready, for up to twice
    // as many lines, so a request covers about `ahead` new lines rather than one line per cue.
    const end = Math.min(s.cues.length, from + (source === 'ai' ? 2 * ahead : ahead + 1));
    const todo: number[] = [];
    for (let i = from; i < end; i++) {
      if (!(i in s.hints) && !this.pending.has(i)) todo.push(i);
    }
    if (!todo.length) return;
    if (source === 'ai' && todo[0] - from > ahead / 2 && end < s.cues.length) return;
    void this.load(todo, source);
  }

  /**
   * Make the on-device translator ready from a click: its first use may download a language pack,
   * which Chrome only starts after a user gesture.
   */
  prime() {
    const { lang, settings } = getSession();
    if (!lang || settings.subtitles.hintSource !== 'chrome') return;
    getChromeTranslator(lang, settings.nativeLanguage).catch(() => undefined);
  }

  private async load(indexes: number[], source: Settings['subtitles']['hintSource']) {
    const gen = this.generation;
    const s = getSession();
    const { lang, settings } = s;
    const native = settings.nativeLanguage;
    const scale = hintScaleFor(lang);
    const level = hintLevelFor(scale, settings.subtitles.hintLevels, settings.learnerLevel);
    const vocab = buildVocabIndex(s.vocab, lang);
    const known = new Set([...vocab.words].filter(([, st]) => st === 'known').map(([k]) => k));
    // Saved phrases the learner is still learning carry their own translation as the hint.
    const savedGloss = new Map<string, string>();
    for (const item of Object.values(s.vocab)) {
      if (item.kind !== 'phrase' || item.status !== 'learning' || !item.translation || !sameLang(item.lang, lang)) continue;
      for (const key of vocabKeys(item)) savedGloss.set(key, cleanGloss(item.text, item.translation));
    }
    const lines = indexes.map((i) => {
      const tokens = tokenize(s.cues[i].text, lang);
      const saved = findPhrases(tokens, lang, vocab.phrases)
        .filter((p) => savedGloss.get(p.key))
        .map((p) => ({ start: p.start, end: p.end, gloss: savedGloss.get(p.key)! }));
      // The tutor finds phrases itself; on-device, the built-in English list does.
      const listed =
        source === 'chrome'
          ? findListedPhrases(tokens, lang, hintLevelFor('cefr', settings.subtitles.hintLevels, settings.learnerLevel).id).filter(
              (p) => !overlaps(p, saved),
            )
          : [];
      const taken = [...saved, ...listed].slice(0, MAX_PHRASES_PER_LINE);
      const picked = outsidePhrases(pickHintTokens(tokens, { lang, ranks: s.frequency!, cutoff: level.cutoff, known }), taken);
      return {
        i,
        tokens,
        line: s.cues[i].text,
        words: picked.map((t) => tokens[t].text),
        saved: saved.slice(0, MAX_PHRASES_PER_LINE),
        listed: listed.slice(0, Math.max(0, MAX_PHRASES_PER_LINE - saved.length)),
      };
    });
    indexes.forEach((i) => this.pending.add(i));
    const done = (hints: Map<number, LineHints>) => {
      if (gen !== this.generation) return;
      indexes.forEach((i) => this.pending.delete(i));
      setSession({ hints: { ...getSession().hints, ...Object.fromEntries(hints) } });
    };
    const out = new Map<number, LineHints>();
    // Lines with nothing to look up are done now: only saved phrases (on-device), or nothing at all.
    const work = lines.filter((l) => {
      if (l.words.length || l.listed.length || source === 'ai') return true;
      out.set(l.i, { words: {}, phrases: l.saved });
      return false;
    });
    if (!work.length) return done(out);
    const fallback = (l: (typeof lines)[number]): LineHints => ({ words: {}, phrases: l.saved });

    const m = getMessages(resolveUILocale(settings));
    this.busy = true;
    try {
      if (source === 'chrome') {
        const state = await chromeTranslatorState(lang, native);
        if (state === 'unsupported' || state === 'unavailable') {
          this.tell(`chrome:${lang}`, m.content.playerMenu.hintsUnavailable(`${languageName(lang)} → ${languageName(native)}`));
          for (const l of work) out.set(l.i, fallback(l));
          return;
        }
        const gloss = async (text: string, cacheKey: string) => {
          const key = `${lang}>${native}|${cacheKey}`;
          let g = this.words.get(key);
          if (g === undefined) {
            g = cleanGloss(text, await translateWithChrome(text, lang, native));
            this.words.set(key, g);
          }
          return g;
        };
        for (const l of work) {
          const words: Record<string, string> = {};
          for (const word of l.words) {
            const k = normalizeWord(word, lang);
            words[k] = await gloss(word, k);
            if (gen !== this.generation) return;
          }
          const phrases = [...l.saved];
          for (const p of l.listed) {
            const g = await gloss(p.text, `phrase:${p.text.toLowerCase()}`);
            if (gen !== this.generation) return;
            if (g) phrases.push({ start: p.start, end: p.end, gloss: g });
          }
          out.set(l.i, { words, phrases });
        }
      } else {
        const result = await runJob({
          task: 'hint',
          items: work.map((l) => ({ line: l.line, words: l.words })),
          targetLang: lang,
          level: hintLevelLabel(settings, lang),
        });
        if (gen !== this.generation) return;
        const parsed = parseGlosses(
          result.text,
          work.map((l) => l.words.length),
        );
        work.forEach((l, n) => {
          const phrases = [...l.saved];
          for (const p of parsed?.phrases[n] ?? []) {
            if (phrases.length >= MAX_PHRASES_PER_LINE) break;
            const range = locateChunk(l.tokens, p.text, lang);
            const g = cleanGloss(p.text, p.gloss);
            // A phrase is more than one word; one word is a word hint.
            if (!range || !g || range[0] === range[1] || overlaps({ start: range[0], end: range[1] }, phrases)) continue;
            phrases.push({ start: range[0], end: range[1], gloss: g });
          }
          const words: Record<string, string> = {};
          l.words.forEach((w, k) => (words[normalizeWord(w, lang)] = cleanGloss(w, parsed?.words[n][k] ?? '')));
          out.set(l.i, { words, phrases });
        });
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (source === 'ai' && (code === 'not_configured' || code === 'disabled')) this.tell('ai', m.content.playerMenu.hintsNeedAi);
      else if (source === 'chrome') {
        this.tell(`chrome:${lang}`, (err as Error).message || m.content.playerMenu.hintsUnavailable(languageName(lang)));
      }
      // These lines go without hints (but saved phrases) rather than asking again on every frame.
      for (const l of work) if (!out.has(l.i)) out.set(l.i, fallback(l));
    } finally {
      if (gen === this.generation) {
        this.busy = false;
        done(out);
        // More lines may have come into range while this batch ran.
        this.update();
      }
    }
  }

  private tell(id: string, text: string) {
    if (this.told.has(`${this.key}|${id}`)) return;
    this.told.add(`${this.key}|${id}`);
    this.toast(text);
  }
}
