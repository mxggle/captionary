import { describe, expect, it } from 'vitest';
import { tokenize } from '@/lib/text/tokenize';
import type { PopupTarget } from '@/content/store';
import { chunkSuggestion, explainsAtOnce } from './useLookup';

const sentence = "I hope the weather holds up 'cause it looks like it may rain at some point,";
const holds = tokenize(sentence, 'en').findIndex((t) => t.text === 'holds');
const target = (over: Partial<PopupTarget> = {}): PopupTarget => ({
  kind: 'word',
  text: 'holds',
  lang: 'en',
  cueIndex: 3,
  sentence,
  before: [],
  after: [],
  rect: { left: 0, top: 0, width: 10, height: 10 },
  surface: 'overlay',
  tokenRange: [holds, holds],
  ...over,
});
const heldUp = { text: 'holds up', base: 'hold up', meaning: '（天气）维持不变' };

describe('chunkSuggestion', () => {
  it('offers the chunk around the selection, under its dictionary form', () => {
    expect(chunkSuggestion(target(), heldUp)).toEqual({
      text: 'holds up',
      base: 'hold up',
      meaning: '（天气）维持不变',
      range: [holds, holds + 2],
      words: 2,
    });
  });

  it('files an uninflected chunk under itself', () => {
    const point = tokenize(sentence, 'en').findIndex((t) => t.text === 'point');
    const s = chunkSuggestion(target({ text: 'point', tokenRange: [point, point] }), { text: 'at some point', meaning: '某个时候' });
    expect(s).toMatchObject({ text: 'at some point', base: 'at some point', words: 3 });
  });

  it('finds the selection in the line when it has no token range, or a stale one', () => {
    expect(chunkSuggestion(target({ tokenRange: undefined }), heldUp)?.range).toEqual([holds, holds + 2]);
    expect(chunkSuggestion(target({ tokenRange: [0, 0] }), heldUp)?.range).toEqual([holds, holds + 2]);
  });

  it('offers nothing when the chunk is the selection, elsewhere, or not in the line', () => {
    expect(chunkSuggestion(target(), { text: 'holds', meaning: '维持' })).toBeNull();
    expect(chunkSuggestion(target(), { text: 'at some point', meaning: '某个时候' })).toBeNull();
    expect(chunkSuggestion(target(), { text: 'hold sth up', meaning: '举起' })).toBeNull();
  });
});

describe('explainsAtOnce', () => {
  it('starts the tutor for a chunk the learner followed from an explanation', () => {
    expect(explainsAtOnce(target(), { enabled: true, configured: true, autoExplain: false } as never)).toBe(false);
    expect(explainsAtOnce(target({ text: 'holds up', base: 'hold up' }), null)).toBe(true);
    expect(explainsAtOnce(target({ kind: 'sentence' }), null)).toBe(true);
  });
});
