import { baseLang, isSpaceless } from '../languages';
import type { Settings } from '../settings';
import { frequencyRank } from './frequency-map';
import { englishPhrases, type PhraseLevel } from './phrases-en';
import { normalizeWord, type Token } from './tokenize';

export type LearnerLevel = Settings['learnerLevel'];

/** The level scale learners of a language know: JLPT, HSK, TOPIK, else CEFR. */
export type HintScale = 'cefr' | 'jlpt' | 'hsk' | 'topik';

export interface HintLevel {
  id: string;
  /** Shown in pickers: "N3", "HSK 4", "B1". */
  label: string;
  /**
   * Frequency rank past which a word counts as difficult. The lists rank word forms ("running",
   * "ran"), not dictionary entries, so each cutoff sits above the vocabulary size the level stands for;
   * more so for Korean, whose endings make many forms of each word.
   */
  cutoff: number;
}

export const HINT_SCALES: Record<HintScale, { name: string; levels: HintLevel[] }> = {
  cefr: {
    name: 'CEFR',
    levels: [
      { id: 'A1', label: 'A1', cutoff: 1000 },
      { id: 'A2', label: 'A2', cutoff: 2000 },
      { id: 'B1', label: 'B1', cutoff: 4000 },
      { id: 'B2', label: 'B2', cutoff: 7000 },
      { id: 'C1', label: 'C1', cutoff: 12000 },
      { id: 'C2', label: 'C2', cutoff: 20000 },
    ],
  },
  // About 800, 1,500, 3,750, 6,000 and 10,000 words.
  jlpt: {
    name: 'JLPT',
    levels: [
      { id: 'N5', label: 'N5', cutoff: 1000 },
      { id: 'N4', label: 'N4', cutoff: 2000 },
      { id: 'N3', label: 'N3', cutoff: 4500 },
      { id: 'N2', label: 'N2', cutoff: 7500 },
      { id: 'N1', label: 'N1', cutoff: 12000 },
    ],
  },
  // HSK 3.0 (2021): 500, 1,272, 2,245, 3,245, 4,316, 5,456 and 11,092 words in total.
  hsk: {
    name: 'HSK',
    levels: [
      { id: '1', label: 'HSK 1', cutoff: 600 },
      { id: '2', label: 'HSK 2', cutoff: 1500 },
      { id: '3', label: 'HSK 3', cutoff: 2700 },
      { id: '4', label: 'HSK 4', cutoff: 3900 },
      { id: '5', label: 'HSK 5', cutoff: 5200 },
      { id: '6', label: 'HSK 6', cutoff: 6500 },
      { id: '7-9', label: 'HSK 7–9', cutoff: 13000 },
    ],
  },
  // Roughly 800, 1,500, 3,000, 5,000, 8,000 and 10,000+ words.
  topik: {
    name: 'TOPIK',
    levels: [
      { id: '1', label: 'TOPIK 1', cutoff: 1500 },
      { id: '2', label: 'TOPIK 2', cutoff: 3000 },
      { id: '3', label: 'TOPIK 3', cutoff: 6000 },
      { id: '4', label: 'TOPIK 4', cutoff: 9000 },
      { id: '5', label: 'TOPIK 5', cutoff: 13000 },
      { id: '6', label: 'TOPIK 6', cutoff: 18000 },
    ],
  },
};

export function hintScaleFor(lang: string): HintScale {
  const code = baseLang(lang);
  if (code === 'ja') return 'jlpt';
  if (code === 'zh') return 'hsk';
  if (code === 'ko') return 'topik';
  return 'cefr';
}

const FROM_CEFR: Record<HintScale, Record<LearnerLevel, string>> = {
  cefr: { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' },
  jlpt: { A1: 'N5', A2: 'N4', B1: 'N3', B2: 'N2', C1: 'N1', C2: 'N1' },
  hsk: { A1: '2', A2: '3', B1: '4', B2: '5', C1: '6', C2: '7-9' },
  topik: { A1: '1', A2: '2', B1: '3', B2: '4', C1: '5', C2: '6' },
};

/** The level picked on a scale, or the one matching the learner's CEFR level until one is picked. */
export function hintLevelFor(
  scale: HintScale,
  picked: Partial<Record<HintScale, string>> | undefined,
  learnerLevel: LearnerLevel,
): HintLevel {
  const levels = HINT_SCALES[scale].levels;
  return levels.find((l) => l.id === picked?.[scale]) ?? levels.find((l) => l.id === FROM_CEFR[scale][learnerLevel]) ?? levels[0];
}

/** A level with its scale's name, as menus show it on its own: "JLPT N3", "HSK 4", "CEFR B1". */
export function hintLevelName(scale: HintScale, level: HintLevel): string {
  const { name } = HINT_SCALES[scale];
  return level.label.startsWith(name) ? level.label : `${name} ${level.label}`;
}

/** At most this many hints in one line, rarest first, so a dense line stays readable. */
export const MAX_HINTS_PER_LINE = 3;

export interface HintOptions {
  lang: string;
  ranks: Map<string, number>;
  /** Frequency rank past which a word is difficult (see {@link HintLevel.cutoff}). */
  cutoff: number;
  /** Normalized words the learner marked as known: never hinted. */
  known?: ReadonlySet<string>;
  max?: number;
}

/** Languages that capitalise common nouns. */
const NOUNS_CAPITALISED = new Set(['de', 'lb']);
const NUMERIC = /^[\p{N}\p{P}\p{S}]+$/u;
/** Scripts with upper and lower case, where a capital inside a line usually marks a name. */
const CASED = /[\p{Lu}\p{Ll}]/u;

/**
 * Token indexes of the words in a line that are difficult for the learner's level: rarer than the
 * level's cutoff in the frequency list. Names are left out (a capitalised word inside the line, except in
 * German, or an unlisted capitalised word anywhere), and so are numbers, single letters, and unlisted words in
 * languages written without spaces.
 */
export function pickHintTokens(tokens: Token[], opts: HintOptions): number[] {
  const { cutoff } = opts;
  const picked: { i: number; rank: number }[] = [];
  const seen = new Set<string>();
  let firstWord = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.word) {
      // A sentence end inside the line starts a new sentence, where a capital is expected.
      if (/[.!?。！？…]/u.test(t.text)) firstWord = true;
      continue;
    }
    const atStart = firstWord;
    firstWord = false;
    const key = normalizeWord(t.text, opts.lang);
    if (!key || seen.has(key) || NUMERIC.test(key) || [...key].length < (CASED.test(key) ? 2 : 1)) continue;
    if (opts.known?.has(key)) continue;
    const capitalised = CASED.test(t.text) && t.text[0] !== t.text[0].toLocaleLowerCase() && t.text.length > 1;
    // German capitalises every noun, so there a capital says nothing; unlisted names are still left out below.
    if (capitalised && !atStart && !NOUNS_CAPITALISED.has(baseLang(opts.lang))) continue;
    const rank = frequencyRank(opts.ranks, key);
    // Unlisted: a name, or (without spaces) a chunk the segmenter cut differently from the list.
    if (rank === undefined && (capitalised || isSpaceless(opts.lang))) continue;
    const r = rank ?? Infinity;
    if (r <= cutoff) continue;
    seen.add(key);
    picked.push({ i, rank: r });
  }
  return picked
    .sort((a, b) => b.rank - a.rank)
    .slice(0, opts.max ?? MAX_HINTS_PER_LINE)
    .map((p) => p.i)
    .sort((a, b) => a - b);
}

/**
 * A machine translation of one word, trimmed to a gloss that fits under it: the first sense
 * ("dismiss; fire" → "dismiss"), no end punctuation, nothing when it only repeats the word.
 */
export function cleanGloss(word: string, translated: string, max = 24): string {
  let out = translated
    .trim()
    .split(/[;；,，、/\n]/u)[0]
    .replace(/^[\s"'“”‘’「」『』«»()（）]+|[\s"'“”‘’「」『』«»()（）.。!！?？:：]+$/gu, '')
    .trim();
  if (!out || out.toLocaleLowerCase() === word.toLocaleLowerCase()) return '';
  if ([...out].length > max) out = [...out].slice(0, max - 1).join('') + '…';
  return out;
}

/** Hints for one subtitle line. */
export interface LineHints {
  /** Normalized word -> short gloss ('' = none). */
  words: Record<string, string>;
  /** Phrases with one gloss under all their words, by first and last token index. */
  phrases: { start: number; end: number; gloss: string }[];
}

/** A phrase in a line that gets one hint under all its words. */
export interface PhraseSpan {
  /** First and last token index. */
  start: number;
  end: number;
  /** The phrase as written in the line. */
  text: string;
}

/** At most this many phrase hints in one line. */
export const MAX_PHRASES_PER_LINE = 2;

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Phrasal verbs and idioms from the built-in English list in a line, longest first, never
 * overlapping: those at or above the learner's CEFR level (a B1 learner sees B1, B2 and C1 phrases;
 * C2 sees none).
 */
export function findListedPhrases(tokens: Token[], lang: string, cefr: string, max = MAX_PHRASES_PER_LINE): PhraseSpan[] {
  if (baseLang(lang) !== 'en') return [];
  const learner = CEFR_ORDER.indexOf(cefr);
  const list = englishPhrases();
  const words = tokens.flatMap((t, i) => (t.word ? [{ i, key: normalizeWord(t.text, lang) }] : []));
  const out: PhraseSpan[] = [];
  for (let w = 0; w < words.length; w++) {
    let best: { end: number; size: number } | null = null;
    for (const entry of list.get(words[w].key) ?? []) {
      if (CEFR_ORDER.indexOf(entry.level satisfies PhraseLevel) < learner) continue;
      const n = entry.words.length;
      if (w + n > words.length || (best && n <= best.size)) continue;
      if (entry.words.every((forms, k) => forms.includes(words[w + k].key))) best = { end: w + n - 1, size: n };
    }
    if (!best) continue;
    const start = words[w].i;
    const end = words[best.end].i;
    out.push({
      start,
      end,
      text: tokens
        .slice(start, end + 1)
        .map((t) => t.text)
        .join(''),
    });
    w = best.end;
    if (out.length >= max) break;
  }
  return out;
}

/** Drops word hints inside a phrase that has its own hint. */
export function outsidePhrases(indexes: number[], phrases: Pick<PhraseSpan, 'start' | 'end'>[]): number[] {
  return indexes.filter((i) => !phrases.some((p) => i >= p.start && i <= p.end));
}
