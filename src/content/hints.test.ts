import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { buildRankMap } from '@/lib/text/frequency-map';
import type { LineHints } from '@/lib/text/hints';
import { HintLoader, hintsApply } from './hints';
import { getSession, setSession } from './store';

const GLOSSES: Record<string, string> = {
  detector: '探测器',
  dispenses: '分发',
  gizmo: '小玩意',
  'gave up': '放弃了',
  'called it a day': '收工了',
};

const translate = vi.hoisted(() => ({
  state: vi.fn(async () => 'available'),
  run: vi.fn(async (text: string) => GLOSSES[text] ?? text),
}));
const ai = vi.hoisted(() => ({ runJob: vi.fn() }));

vi.mock('@/lib/translate', () => ({
  chromeTranslatorState: translate.state,
  getChromeTranslator: vi.fn(async () => ({})),
  translateWithChrome: (word: string) => translate.run(word),
}));
vi.mock('@/lib/messaging', () => ({ runJob: ai.runJob }));

const W = (words: Record<string, string> = {}, phrases: LineHints['phrases'] = []): LineHints => ({ words, phrases });

const settled = () => new Promise((r) => setTimeout(r, 0));

function settings(patch: (s: Settings) => void = () => undefined): Settings {
  const s = structuredClone(DEFAULT_SETTINGS);
  s.nativeLanguage = 'zh-CN';
  s.targetLanguage = 'en';
  s.subtitles.definitionHints = true;
  s.subtitles.hintLevels = { cefr: 'B1' };
  patch(s);
  return s;
}

const cues = [
  { start: 0, end: 1, text: 'So this is a detector' },
  { start: 1, end: 2, text: 'it dispenses a gizmo' },
  { start: 2, end: 3, text: 'so this is it' },
];

describe('HintLoader', () => {
  let toast: ReturnType<typeof vi.fn<(text: string) => void>>;
  let loader: HintLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    toast = vi.fn<(text: string) => void>();
    loader = new HintLoader(toast);
    setSession({
      settings: settings(),
      lang: 'en',
      cues,
      status: 'ready',
      off: false,
      activeIndex: 0,
      lastIndex: 0,
      vocab: {},
      hints: {},
      frequency: buildRankMap(['so', 'this', 'is', 'a', 'it', ...Array.from({ length: 6000 }, (_, i) => `w${i}`), 'detector'], 'en'),
    });
  });

  it('applies only to videos in the language being learned', () => {
    expect(hintsApply({ settings: settings(), lang: 'en' })).toBe(true);
    expect(hintsApply({ settings: settings(), lang: 'fr' })).toBe(false);
    expect(hintsApply({ settings: settings((s) => (s.targetLanguage = 'auto')), lang: 'fr' })).toBe(true);
    expect(hintsApply({ settings: settings((s) => (s.nativeLanguage = 'en')), lang: 'en' })).toBe(false);
    expect(hintsApply({ settings: settings((s) => (s.subtitles.definitionHints = false)), lang: 'en' })).toBe(false);
  });

  it('glosses difficult words on-device, a word at a time', async () => {
    loader.update();
    await vi.waitFor(() => expect(2 in getSession().hints).toBe(true));
    expect(getSession().hints).toEqual({
      0: W({ detector: '探测器' }),
      1: W({ dispenses: '分发', gizmo: '小玩意' }),
      2: W(),
    });
    // A higher level leaves out what it knows: "detector" sits at rank 6,006, under C1's cutoff.
    setSession({ settings: settings((s) => (s.subtitles.hintLevels = { cefr: 'C1' })) });
    loader.update();
    await vi.waitFor(() => expect(getSession().hints[0]).toEqual(W()));
    // Each word is translated once.
    expect(translate.run).toHaveBeenCalledTimes(3);
  });

  it('says once when the on-device translator cannot do this pair', async () => {
    translate.state.mockResolvedValue('unavailable');
    loader.update();
    await settled();
    setSession({ activeIndex: 1 });
    loader.update();
    await settled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(getSession().hints[0]).toEqual(W());
    translate.state.mockResolvedValue('available');
  });

  it('asks the tutor for a batch of lines at the learner’s level', async () => {
    setSession({ settings: settings((s) => (s.subtitles.hintSource = 'ai')) });
    ai.runJob.mockResolvedValue({
      text: '{"g": [["探测器"], ["分发", "小装置"], []], "p": [[], [], [{"t": "this is it", "g": "就是这样"}]]}',
    });
    loader.update();
    await settled();
    expect(ai.runJob).toHaveBeenCalledTimes(1);
    expect(ai.runJob.mock.calls[0][0]).toMatchObject({
      task: 'hint',
      level: 'CEFR B1',
      items: [
        { line: 'So this is a detector', words: ['detector'] },
        { line: 'it dispenses a gizmo', words: ['dispenses', 'gizmo'] },
        // The tutor also looks for phrases, so lines without difficult words go too.
        { line: 'so this is it', words: [] },
      ],
    });
    expect(getSession().hints[1]).toEqual(W({ dispenses: '分发', gizmo: '小装置' }));
    expect(getSession().hints[2]).toEqual(W({}, [{ start: 2, end: 6, gloss: '就是这样' }]));
  });

  it('drops a word hint inside a phrase the tutor glossed', async () => {
    setSession({ settings: settings((s) => (s.subtitles.hintSource = 'ai')) });
    ai.runJob.mockResolvedValue({
      text: '{"g": [["探测器"], ["分发", "小装置"], []], "p": [[], [{"t": "dispenses a gizmo", "g": "发个小玩意"}], []]}',
    });
    loader.update();
    await settled();
    // Token indexes: it·dispenses·a·gizmo, with spaces between.
    expect(getSession().hints[1]).toEqual(W({}, [{ start: 2, end: 6, gloss: '发个小玩意' }]));
  });

  it('tells the learner to set up the tutor when it has no provider', async () => {
    setSession({ settings: settings((s) => (s.subtitles.hintSource = 'ai')) });
    ai.runJob.mockRejectedValue(Object.assign(new Error('no provider'), { code: 'not_configured' }));
    loader.update();
    await settled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(getSession().hints[0]).toEqual(W());
  });

  it('hints English phrasal verbs and idioms on-device, under the whole phrase', async () => {
    setSession({
      cues: [{ start: 0, end: 1, text: 'So it gave up and called it a day' }],
      hints: {},
      frequency: buildRankMap(['so', 'it', 'and', 'a', 'gave', 'up', 'called', 'day'], 'en'),
    });
    loader.update();
    await vi.waitFor(() => expect(0 in getSession().hints).toBe(true));
    // Token indexes: So·it·gave·up·and·called·it·a·day, with spaces between.
    expect(getSession().hints[0]).toEqual(
      W({}, [
        { start: 4, end: 6, gloss: '放弃了' },
        { start: 10, end: 16, gloss: '收工了' },
      ]),
    );
  });

  it('shows a saved phrase’s own translation while it is being learned', async () => {
    setSession({
      cues: [{ start: 0, end: 1, text: 'this is it, a gizmo' }],
      hints: {},
      vocab: {
        'en|this is it': {
          id: 'en|this is it',
          lang: 'en',
          text: 'this is it',
          key: 'this is it',
          kind: 'phrase',
          status: 'learning',
          translation: '就是这个；终于',
          createdAt: 0,
          updatedAt: 0,
        },
      },
    });
    loader.update();
    await vi.waitFor(() => expect(0 in getSession().hints).toBe(true));
    expect(getSession().hints[0]).toEqual(W({ gizmo: '小玩意' }, [{ start: 0, end: 4, gloss: '就是这个' }]));
    // Marking the phrase known takes its hint away.
    const item = getSession().vocab['en|this is it'];
    setSession({ vocab: { [item.id]: { ...item, status: 'known' } } });
    loader.update();
    await vi.waitFor(() => expect(getSession().hints[0]).toEqual(W({ gizmo: '小玩意' })));
  });
});

describe('HintLoader batching and invalidation', () => {
  it('asks the tutor in batches, not once per new line', async () => {
    vi.clearAllMocks();
    const many = Array.from({ length: 60 }, (_, i) => ({ start: i, end: i + 1, text: `this is gizmo${i}` }));
    setSession({
      settings: settings((s) => (s.subtitles.hintSource = 'ai')),
      lang: 'en',
      cues: many,
      status: 'ready',
      off: false,
      activeIndex: 0,
      lastIndex: 0,
      vocab: {},
      hints: {},
      frequency: buildRankMap(['this', 'is'], 'en'),
    });
    ai.runJob.mockImplementation(async (job: { items: unknown[] }) => ({
      text: JSON.stringify({ g: job.items.map(() => ['x']) }),
    }));
    const loader = new HintLoader(() => undefined);
    for (let i = 0; i < 30; i++) {
      setSession({ activeIndex: i });
      loader.update();
      await settled();
    }
    const sizes = ai.runJob.mock.calls.map((c) => (c[0] as { items: unknown[] }).items.length);
    expect(sizes.length).toBeLessThanOrEqual(3);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
  });

  it('looks again when the frequency map changes', async () => {
    vi.clearAllMocks();
    setSession({
      settings: settings(),
      lang: 'en',
      cues,
      status: 'ready',
      off: false,
      activeIndex: 0,
      lastIndex: 0,
      vocab: {},
      hints: {},
      frequency: buildRankMap(['so', 'this', 'is', 'a', 'detector', 'it', 'dispenses', 'gizmo'], 'en'),
    });
    const loader = new HintLoader(() => undefined);
    loader.update();
    await vi.waitFor(() => expect(2 in getSession().hints).toBe(true));
    expect(getSession().hints[0]).toEqual(W());
    setSession({ frequency: buildRankMap(['so', 'this', 'is', 'a', 'it'], 'en') });
    loader.update();
    await vi.waitFor(() => expect(getSession().hints[0]).toEqual(W({ detector: '探测器' })));
  });
});
