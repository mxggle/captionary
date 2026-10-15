import { describe, expect, it } from 'vitest';
import { parseFrequencyList } from '../frequency';
import { buildRankMap, frequencyClass, frequencyRank } from './frequency-map';

describe('frequency lists', () => {
  it('parses "word count" lines in rank order', () => {
    expect(parseFrequencyList('de 14459520\nque 14421005\n\nno 12379505\n', 2)).toEqual(['de', 'que']);
  });
  it('maps normalized words to their first rank', () => {
    const ranks = buildRankMap(['The', 'the', 'Haus', 'don’t'], 'en');
    expect(ranks.get('the')).toBe(1);
    expect(ranks.get('haus')).toBe(3);
    expect(ranks.get("don't")).toBe(4);
  });
  it('ranks contractions by their more common form', () => {
    const ranks = buildRankMap(['that', 's', 'i', 'that’s'], 'en');
    expect(frequencyRank(ranks, "that's")).toBe(1);
    expect(frequencyRank(ranks, "i've")).toBe(3);
    expect(frequencyRank(ranks, 'zzz')).toBeUndefined();
  });
  it('assigns rarity bands', () => {
    expect(frequencyClass(10)).toBe('');
    expect(frequencyClass(5000)).toBe('f-mid');
    expect(frequencyClass(15000)).toBe('f-rare');
    expect(frequencyClass(25000)).toBe('f-vrare');
    expect(frequencyClass(undefined)).toBe('f-vrare');
  });
});
