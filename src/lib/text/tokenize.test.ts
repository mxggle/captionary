import { describe, expect, it } from 'vitest';
import { findPhrases, normalizeWord, phraseBucket, phraseKey, splitSentences, tokenize } from './tokenize';

describe('tokenize', () => {
  it('separates words from punctuation and spaces', () => {
    const tokens = tokenize("¿Dónde está l'hôtel?", 'es');
    expect(tokens.filter((t) => t.word).map((t) => t.text)).toEqual(['Dónde', 'está', "l'hôtel"]);
    expect(tokens.map((t) => t.text).join('')).toBe("¿Dónde está l'hôtel?");
  });

  it('segments Japanese without spaces', () => {
    const words = tokenize('私は学生です', 'ja').filter((t) => t.word);
    expect(words.length).toBeGreaterThan(1);
    expect(words.map((t) => t.text).join('')).toBe('私は学生です');
  });
});

describe('normalizeWord', () => {
  it('lower-cases, unifies apostrophes and trims punctuation', () => {
    expect(normalizeWord('«Haus»', 'de')).toBe('haus');
    expect(normalizeWord('Don’t', 'en')).toBe("don't");
    expect(normalizeWord('Thatʼs', 'en')).toBe("that's");
    expect(normalizeWord('İstanbul', 'tr')).toBe('istanbul');
  });
});

describe('phrases', () => {
  it('finds saved multi-word phrases ignoring punctuation and case', () => {
    const tokens = tokenize('Well, I gave UP on it.', 'en');
    const key = phraseKey(['gave', 'up'], 'en');
    const matches = findPhrases(tokens, 'en', new Map([[phraseBucket(key, 'en'), [key]]]));
    expect(matches).toHaveLength(1);
    const m = matches[0];
    expect(
      tokens
        .slice(m.start, m.end + 1)
        .map((t) => t.text)
        .join(''),
    ).toBe('gave UP');
  });

  it('matches phrases in languages without spaces', () => {
    const text = '我们一起去吃饭吧';
    const tokens = tokenize(text, 'zh-CN');
    const words = tokens.filter((t) => t.word).map((t) => t.text);
    const key = phraseKey(words.slice(0, 2), 'zh-CN');
    const matches = findPhrases(tokens, 'zh-CN', new Map([[phraseBucket(key, 'zh-CN'), [key]]]));
    expect(matches.length).toBe(1);
  });
});

describe('splitSentences', () => {
  it('splits on sentence boundaries', () => {
    expect(splitSentences('Hola. ¿Cómo estás? Bien.', 'es').map((s) => s.trim())).toEqual(['Hola.', '¿Cómo estás?', 'Bien.']);
  });
});
