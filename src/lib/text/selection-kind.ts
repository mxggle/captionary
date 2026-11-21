import { tokenize } from './tokenize';

/** More words than this and a selection is a sentence to break down, not a word or phrase to look up. */
const MAX_PHRASE_WORDS = 3;

/** A lone hiragana is a particle or a piece of an inflection ("食べ|さ|せ|ら|れ"), not a word of its own. */
const LONE_KANA = /^[぀-ゟ]$/u;

/** Marks that end a sentence; a full stop is left out, as abbreviations ("Mr.", "e.g.") carry one. */
const SENTENCE_END = /[。！？!?]/u;

/**
 * Whether selected or typed text is looked up as a word (or short phrase) or broken down as a
 * sentence. Words are counted with the segmenter, so a Chinese or Japanese sentence written without
 * spaces is a sentence too; pass the text's language once it is known.
 */
export function selectionKind(text: string, lang: string): 'word' | 'sentence' {
  const words = tokenize(text.trim(), lang).filter((t) => t.word && !LONE_KANA.test(t.text)).length;
  if (words > MAX_PHRASE_WORDS) return 'sentence';
  return words > 1 && SENTENCE_END.test(text) ? 'sentence' : 'word';
}
