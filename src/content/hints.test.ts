import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { buildRankMap } from '@/lib/text/frequency-map';
import { HintLoader, hintsApply } from './hints';
import { getSession, setSession } from './store';

const translate = vi.hoisted(() => ({
  state: vi.fn(async () => 'available'),
  run: vi.fn(async (word: string) => ({ detector: '探测器', dispenses: '分发', gizmo: '小玩意' })[word] ?? word),
}));
const ai = vi.hoisted(() => ({ runJob: vi.fn() }));

vi.mock('@/lib/translate', () => ({
  chromeTranslatorState: translate.state,
  getChromeTranslator: vi.fn(async () => ({})),
  translateWithChrome: (word: string) => translate.run(word),
}));
vi.mock('@/lib/messaging', () => ({ runJob: ai.runJob }));

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
      0: { detector: '探测器' },
      1: { dispenses: '分发', gizmo: '小玩意' },
      2: {},
    });
    // A higher level leaves out what it knows: "detector" sits at rank 6,006, under C1's cutoff.
    setSession({ settings: settings((s) => (s.subtitles.hintLevels = { cefr: 'C1' })) });
    loader.update();
    await vi.waitFor(() => expect(getSession().hints[0]).toEqual({}));
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
    expect(getSession().hints[0]).toEqual({});
    translate.state.mockResolvedValue('available');
  });

  it('asks the tutor for a batch of lines at the learner’s level', async () => {
    setSession({ settings: settings((s) => (s.subtitles.hintSource = 'ai')) });
    ai.runJob.mockResolvedValue({ text: '{"g": [["探测器"], ["分发", "小装置"]]}' });
    loader.update();
    await settled();
    expect(ai.runJob).toHaveBeenCalledTimes(1);
    expect(ai.runJob.mock.calls[0][0]).toMatchObject({
      task: 'hint',
      level: 'CEFR B1',
      items: [
        { line: 'So this is a detector', words: ['detector'] },
        { line: 'it dispenses a gizmo', words: ['dispenses', 'gizmo'] },
      ],
    });
    expect(getSession().hints[1]).toEqual({ dispenses: '分发', gizmo: '小装置' });
  });

  it('tells the learner to set up the tutor when it has no provider', async () => {
    setSession({ settings: settings((s) => (s.subtitles.hintSource = 'ai')) });
    ai.runJob.mockRejectedValue(Object.assign(new Error('no provider'), { code: 'not_configured' }));
    loader.update();
    await settled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(getSession().hints[0]).toEqual({});
  });
});
