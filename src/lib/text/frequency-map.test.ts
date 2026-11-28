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
  it('ranks a chunk cut differently from the list by its listed pieces, without spaces only', () => {
    const ranks = buildRankMap(['の', 'に', 'う', '言', '本当', 'た', 'よ', '台無し'], 'ja');
    expect(frequencyRank(ranks, '本当に', 'ja')).toBe(5);
    expect(frequencyRank(ranks, '言う', 'ja')).toBe(4);
    expect(frequencyRank(ranks, 'たよ', 'ja')).toBe(7);
    // A listed chunk keeps its own rank; one with an unlisted part stays unknown.
    expect(frequencyRank(ranks, '台無し', 'ja')).toBe(8);
    expect(frequencyRank(ranks, '邂逅', 'ja')).toBeUndefined();
    expect(frequencyRank(ranks, '本当に')).toBeUndefined();
    expect(frequencyRank(buildRankMap(['the', 'cat'], 'en'), 'thecat', 'en')).toBeUndefined();
  });
  it('assigns rarity bands', () => {
    expect(frequencyClass(10)).toBe('');
    expect(frequencyClass(5000)).toBe('f-mid');
    expect(frequencyClass(15000)).toBe('f-rare');
    expect(frequencyClass(25000)).toBe('f-vrare');
    expect(frequencyClass(undefined)).toBe('f-vrare');
  });
});
