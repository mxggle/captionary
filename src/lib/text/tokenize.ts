import { baseLang, isSpaceless } from '../languages';

export interface Token {
  text: string;
  /** True for words (letters/numbers); false for spaces and punctuation. */
  word: boolean;
  /** Offset of the token in the source string. */
  index: number;
}

const segmenters = new Map<string, Intl.Segmenter>();

function segmenter(lang: string, granularity: 'word' | 'sentence'): Intl.Segmenter {
  const key = `${lang}:${granularity}`;
  let s = segmenters.get(key);
  if (!s) {
    try {
      s = new Intl.Segmenter(lang || undefined, { granularity });
    } catch {
      s = new Intl.Segmenter(undefined, { granularity });
    }
    segmenters.set(key, s);
  }
  return s;
}

const LETTER = /[\p{L}\p{N}]/u;

/**
 * Split text into word and non-word tokens using the browser's ICU word segmenter,
 * which handles languages written without spaces (Chinese, Japanese, Thai).
 */
export function tokenize(text: string, lang: string): Token[] {
  const tokens: Token[] = [];
  for (const seg of segmenter(lang, 'word').segment(text)) {
    const word = seg.isWordLike ?? LETTER.test(seg.segment);
    tokens.push({ text: seg.segment, word: !!word, index: seg.index });
  }
  return tokens;
}

export function splitSentences(text: string, lang: string): string[] {
  return [...segmenter(lang, 'sentence').segment(text)].map((s) => s.segment).filter((s) => s.trim());
}

/** Canonical form used to recognise a saved word anywhere it appears. */
export function normalizeWord(text: string, lang: string): string {
  const code = baseLang(lang) || undefined;
  let out = text.normalize('NFC').trim();
  try {
    out = out.toLocaleLowerCase(code);
  } catch {
    out = out.toLowerCase();
  }
  return out
    .replace(/[’‘`´ʼ′＇]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

/** Key for a multi-word phrase made of the given word tokens. */
export function phraseKey(words: string[], lang: string): string {
  const sep = isSpaceless(lang) ? '' : ' ';
  return words.map((w) => normalizeWord(w, lang)).join(sep);
}

/**
 * Bucket key for phrase lookup: the first word for spaced languages, the first
 * character for languages written without spaces (segmenter boundaries vary there).
 */
export function phraseBucket(keyOrWord: string, lang: string): string {
  if (isSpaceless(lang)) return [...keyOrWord][0] ?? '';
  return keyOrWord.split(' ')[0];
}

export interface PhraseMatch {
  /** Index into the token array of the first word. */
  start: number;
  /** Index into the token array of the last word (inclusive). */
  end: number;
  key: string;
}

/**
 * Find saved multi-word phrases in a token list. `phrases` maps the first word's key
 * to the full keys of phrases starting with it.
 */
export function findPhrases(tokens: Token[], lang: string, phrases: Map<string, string[]>): PhraseMatch[] {
  if (!phrases.size) return [];
  const sep = isSpaceless(lang) ? '' : ' ';
  const matches: PhraseMatch[] = [];
  const wordIdx = tokens.map((t, i) => (t.word ? i : -1)).filter((i) => i >= 0);
  for (let w = 0; w < wordIdx.length; w++) {
    const first = normalizeWord(tokens[wordIdx[w]].text, lang);
    const candidates = phrases.get(phraseBucket(first, lang));
    if (!candidates) continue;
    let best: PhraseMatch | null = null;
    let key = first;
    if (sep === '' && candidates.includes(key)) best = { start: wordIdx[w], end: wordIdx[w], key };
    for (let n = w + 1; n < wordIdx.length && n < w + 8; n++) {
      key += sep + normalizeWord(tokens[wordIdx[n]].text, lang);
      if (candidates.includes(key)) best = { start: wordIdx[w], end: wordIdx[n], key };
    }
    if (best) {
      matches.push(best);
      w = wordIdx.indexOf(best.end);
    }
  }
  return matches;
}
