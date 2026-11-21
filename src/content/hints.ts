import { getMessages, resolveUILocale } from '@/lib/i18n';
import { languageName, sameLang } from '@/lib/languages';
import { runJob } from '@/lib/messaging';
import { parseGlosses } from '@/lib/ai/prompts';
import type { Settings } from '@/lib/settings';
import { cleanGloss, hintLevelFor, hintLevelName, hintScaleFor, pickHintTokens } from '@/lib/text/hints';
import { normalizeWord, tokenize } from '@/lib/text/tokenize';
import { chromeTranslatorState, getChromeTranslator, translateWithChrome } from '@/lib/translate';
import { getSession, setSession, type SessionState } from './store';

/** Lines glossed ahead of the one playing, so a hint is there when its line comes up. */
const AHEAD = { chrome: 4, ai: 10 } as const;

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
 * Glosses for difficult words in the lines around the one playing (`SessionState.hints`). Which words
 * is decided here once per line (see `pickHintTokens`); the gloss comes from Chrome's on-device
 * translator, one word at a time, or from the tutor, a batch of lines at a time.
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
    const scale = hintScaleFor(lang);
    const level = hintLevelFor(scale, settings.subtitles.hintLevels, settings.learnerLevel);
    const known = new Set(
      Object.values(s.vocab)
        .filter((v) => v.status === 'known' && sameLang(v.lang, lang))
        .map((v) => normalizeWord(v.text, lang)),
    );
    const lines = indexes.map((i) => {
      const tokens = tokenize(s.cues[i].text, lang);
      const picked = pickHintTokens(tokens, { lang, ranks: s.frequency!, cutoff: level.cutoff, known });
      return { i, line: s.cues[i].text, words: picked.map((t) => tokens[t].text) };
    });
    indexes.forEach((i) => this.pending.add(i));
    const done = (glosses: Map<number, Record<string, string>>) => {
      if (gen !== this.generation) return;
      indexes.forEach((i) => this.pending.delete(i));
      setSession({ hints: { ...getSession().hints, ...Object.fromEntries(glosses) } });
    };
    const out = new Map<number, Record<string, string>>(lines.filter((l) => !l.words.length).map((l) => [l.i, {}]));
    const work = lines.filter((l) => l.words.length);
    if (!work.length) return done(out);

    const m = getMessages(resolveUILocale(settings));
    this.busy = true;
    try {
      if (source === 'chrome') {
        const state = await chromeTranslatorState(lang, settings.nativeLanguage);
        if (state === 'unsupported' || state === 'unavailable') {
          this.tell(
            `chrome:${lang}`,
            m.content.playerMenu.hintsUnavailable(`${languageName(lang)} → ${languageName(settings.nativeLanguage)}`),
          );
          for (const l of work) out.set(l.i, {});
          return;
        }
        for (const l of work) {
          const glosses: Record<string, string> = {};
          for (const word of l.words) {
            const k = normalizeWord(word, lang);
            const cacheKey = `${lang}>${settings.nativeLanguage}|${k}`;
            let g = this.words.get(cacheKey);
            if (g === undefined) {
              g = cleanGloss(word, await translateWithChrome(word, lang, settings.nativeLanguage));
              this.words.set(cacheKey, g);
            }
            if (gen !== this.generation) return;
            glosses[k] = g;
          }
          out.set(l.i, glosses);
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
          const glosses: Record<string, string> = {};
          l.words.forEach((w, k) => (glosses[normalizeWord(w, lang)] = cleanGloss(w, parsed?.[n][k] ?? '')));
          out.set(l.i, glosses);
        });
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (source === 'ai' && (code === 'not_configured' || code === 'disabled')) this.tell('ai', m.content.playerMenu.hintsNeedAi);
      else if (source === 'chrome') {
        this.tell(`chrome:${lang}`, (err as Error).message || m.content.playerMenu.hintsUnavailable(languageName(lang)));
      }
      // These lines go without hints rather than asking again on every frame.
      for (const l of work) if (!out.has(l.i)) out.set(l.i, {});
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
