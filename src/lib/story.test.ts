import { describe, expect, it } from 'vitest';
import type { Cue } from './subtitles/types';
import { findMentions, storyExcerpts } from './story';

const cues = (lines: string[]): Cue[] => lines.map((text, i) => ({ start: i * 10, end: i * 10 + 5, text }));

describe('findMentions', () => {
  const show = cues(["Where's Mike?", 'Mikey is late again.', "That's Mike's bike.", 'MIKE!', 'Let him go,\nMike.', 'Mike is back.']);

  it('finds a name as a whole word, possessive included', () => {
    expect(findMentions(show, 99, 'Mike', 'en')).toEqual([0, 2, 3, 4, 5]);
    expect(findMentions(show, 99, "Mike's", 'en')).toEqual([0, 2, 3, 4, 5]);
  });

  it('stops at the last line heard', () => {
    expect(findMentions(show, 3, 'Mike', 'en')).toEqual([0, 2, 3]);
  });

  it('finds names inside words in languages written without spaces', () => {
    const ja = cues(['田中さん、おはよう。', '田中先輩が来た。', '中田です。']);
    expect(findMentions(ja, 99, '田中', 'ja')).toEqual([0, 1]);
  });
});

describe('storyExcerpts', () => {
  const show = cues(['A', 'Hi Mike', 'B', 'C', 'D', 'Mike again', 'E']);

  it('sends each mention with the lines around it, timed, with a gap mark between passages', () => {
    expect(storyExcerpts(show, [1, 5], 99)).toEqual([
      '[0:00] A',
      '[0:10] Hi Mike',
      '[0:20] B',
      '…',
      '[0:40] D',
      '[0:50] Mike again',
      '[1:00] E',
    ]);
  });

  it('never sends a line after the last one heard', () => {
    expect(storyExcerpts(show, [1, 5], 5)).toEqual(['[0:00] A', '[0:10] Hi Mike', '[0:20] B', '…', '[0:40] D', '[0:50] Mike again']);
  });

  it('keeps the first and the latest mentions of a long episode, within the budget', () => {
    const long = cues(Array.from({ length: 400 }, (_, i) => `Line ${i} with Mike and a fairly long tail of words to fill it up`));
    const mentions = long.map((_, i) => i);
    const lines = storyExcerpts(long, mentions, 399);
    expect(lines.join('\n').length).toBeLessThanOrEqual(5000);
    expect(lines[0]).toContain('Line 0 ');
    expect(lines[lines.length - 1]).toContain('Line 399 ');
  });
});
