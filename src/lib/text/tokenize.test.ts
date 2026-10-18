import { describe, expect, it } from 'vitest';
import { findPhrases, locateChunk, normalizeWord, phraseBucket, phraseKey, splitSentences, tokenize } from './tokenize';

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

describe('locateChunk', () => {
  const line = "I hope the weather holds up 'cause it looks like it may rain at some point,";
  const tokens = tokenize(line, 'en');
  const at = (word: string) => tokens.findIndex((t) => t.text === word);
  const text = (r: [number, number] | null) => (r ? line.slice(tokens[r[0]].index, tokens[r[1]].index + tokens[r[1]].text.length) : null);

  it('finds a chunk as whole words, ignoring case and punctuation', () => {
    expect(text(locateChunk(tokens, 'Holds up', 'en'))).toBe('holds up');
    expect(text(locateChunk(tokens, 'at some point.', 'en'))).toBe('at some point');
    expect(locateChunk(tokens, 'old up', 'en')).toBeNull();
    expect(locateChunk(tokens, 'hold up', 'en')).toBeNull();
  });

  it('within a selection, takes only an occurrence that covers it and more', () => {
    const holds = at('holds');
    expect(text(locateChunk(tokens, 'holds up', 'en', [holds, holds]))).toBe('holds up');
    expect(locateChunk(tokens, 'holds', 'en', [holds, holds])).toBeNull();
    expect(locateChunk(tokens, 'at some point', 'en', [holds, holds])).toBeNull();
    const second = tokenize('it is what it is', 'en');
    const lastIs = second.map((t) => t.text).lastIndexOf('is');
    expect(locateChunk(second, 'it is', 'en', [lastIs, lastIs])).toEqual([lastIs - 2, lastIs]);
  });

  it('takes in the words it touches in languages without spaces', () => {
    const zh = tokenize('看起来要下雨了', 'zh');
    const r = locateChunk(zh, '要下雨', 'zh');
    expect(r).not.toBeNull();
    const covered = zh
      .slice(r![0], r![1] + 1)
      .map((t) => t.text)
      .join('');
    expect(covered).toContain('要下雨');
  });
});
