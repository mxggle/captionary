import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getSettings, updateSettings } from '@/lib/settings';
import { HOVER_INTENT_MS, SessionController, type SiteAdapter } from './controller';
import { getSession, setSession } from './store';

const adapter: SiteAdapter = {
  site: 'netflix',
  getVideo: () => null,
  seek() {},
  play() {},
  pause() {},
  loadTrack: async () => [{ start: 0, end: 1, text: 'こんにちは' }],
  setNativeSubtitlesHidden() {},
};

/** Lets the storage write and its watcher run. */
const settled = () => new Promise((r) => setTimeout(r, 20));

describe('chooseTranslation', () => {
  let controller: SessionController;

  beforeEach(async () => {
    fakeBrowser.reset();
    await updateSettings((s) => {
      s.nativeLanguage = 'zh-CN';
      s.subtitles.translationEngine = 'platform';
    });
    controller = new SessionController(adapter);
    await controller.init();
    // A Japanese title that also has a human Chinese track, which the default would pick.
    setSession({
      media: { id: '1', title: 'Title', url: 'https://www.netflix.com/watch/1' },
      lang: 'ja',
      originalTrackId: 'ja',
      tracks: [
        { id: 'ja', lang: 'ja', label: 'Japanese' },
        { id: 'zh', lang: 'zh-CN', label: 'Chinese (Simplified)' },
      ],
      cues: [{ start: 0, end: 1, text: 'こんにちは' }],
    });
  });

  afterEach(() => controller.destroy());

  it('keeps a machine translation picked in the menu as the default for later videos', async () => {
    void controller.chooseTranslation({ type: 'ai', lang: 'zh-CN' });
    await settled();
    expect((await getSettings()).subtitles.translationEngine).toBe('ai');
    // Saving the engine does not send this video back to the default (its Chinese track).
    expect(getSession().translationSource).toEqual({ type: 'ai', lang: 'zh-CN' });
  });

  it('keeps a subtitle track or "off" to this video', async () => {
    void controller.chooseTranslation({ type: 'track', trackId: 'zh' });
    void controller.chooseTranslation({ type: 'none' });
    await settled();
    expect((await getSettings()).subtitles.translationEngine).toBe('platform');
  });

  it('still applies an engine changed on the settings page', async () => {
    void controller.chooseTranslation({ type: 'chrome', lang: 'zh-CN' });
    await settled();
    await updateSettings((s) => void (s.subtitles.translationEngine = 'ai'));
    await settled();
    // The human track in the learner's language comes first, as the default always does.
    expect(getSession().translationSource).toEqual({ type: 'track', trackId: 'zh' });
  });
});

const media = { id: '1', title: 'Title', url: 'https://www.netflix.com/watch/1' };

describe('the host captions', () => {
  let hidden: boolean[];
  let controller: SessionController;
  const now = () => hidden[hidden.length - 1];

  beforeEach(async () => {
    fakeBrowser.reset();
    setSession({ media: null, status: 'idle', off: false, cues: [] });
    hidden = [];
    controller = new SessionController({ ...adapter, setNativeSubtitlesHidden: (h) => void hidden.push(h) });
    await controller.init();
  });

  afterEach(() => controller.destroy());

  it('are hidden only while Captionary draws its own', () => {
    expect(now()).toBe(false);
    setSession({ media, status: 'loading' });
    expect(now()).toBe(false);
    setSession({ status: 'ready' });
    expect(now()).toBe(true);
    controller.setOff(true);
    expect(now()).toBe(false);
    controller.setOff(false);
    expect(now()).toBe(true);
  });

  it('come back when loading ends without subtitles, or the video goes away', () => {
    setSession({ media, status: 'ready' });
    setSession({ status: 'error' });
    expect(now()).toBe(false);
    setSession({ status: 'ready' });
    setSession({ media: null, status: 'idle' });
    expect(now()).toBe(false);
  });

  it('come back when Captionary is turned off for the site', async () => {
    setSession({ media, status: 'ready' });
    await updateSettings((s) => void (s.sites.netflix = false));
    await settled();
    expect(now()).toBe(false);
  });

  it('show during an ad, when Captionary draws nothing over it', () => {
    setSession({ media, status: 'ready', adShowing: true });
    expect(now()).toBe(false);
    setSession({ adShowing: false });
    expect(now()).toBe(true);
  });

  it('come back when Captionary shows neither of its lines', async () => {
    setSession({ media, status: 'ready' });
    await updateSettings((s) => {
      s.subtitles.showOriginal = false;
      s.subtitles.showTranslation = false;
    });
    await settled();
    expect(now()).toBe(false);
  });

  it('come back when Captionary goes away', () => {
    setSession({ media, status: 'ready' });
    controller.destroy();
    expect(now()).toBe(false);
  });
});

describe('shortcuts', () => {
  let controller: SessionController;
  const press = (key: string, target: Element = document.body) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(e);
    return e.defaultPrevented;
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    setSession({ media: null, status: 'idle', off: false, cues: [] });
    controller = new SessionController(adapter);
    await controller.init();
  });

  afterEach(() => {
    controller.destroy();
    document.body.replaceChildren();
  });

  it('leave every key to the page while there is no video', () => {
    expect(press('q')).toBe(false);
  });

  it('leave every key to the page where Captionary is off for the site', async () => {
    setSession({ media });
    await updateSettings((s) => void (s.sites.netflix = false));
    await settled();
    expect(press('q')).toBe(false);
  });

  it('take their keys on a video', () => {
    setSession({ media });
    expect(press('q')).toBe(true);
  });

  it('let Space press a focused Captionary button', async () => {
    await updateSettings((s) => void (s.shortcuts.togglePlay = ' '));
    await settled();
    setSession({ media });
    const root = document.createElement('div');
    root.className = 'cap-root';
    const button = document.createElement('button');
    root.append(button);
    document.body.append(root);
    expect(press(' ', button)).toBe(false);
    expect(press(' ')).toBe(true);
  });
});

describe('pause on hover', () => {
  let controller: SessionController;
  let pauses: number;

  beforeEach(async () => {
    fakeBrowser.reset();
    pauses = 0;
    controller = new SessionController({ ...adapter, pause: () => void pauses++ });
    await controller.init();
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { value: false });
    controller.attachVideo(video);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    controller.destroy();
  });

  it('waits for the pointer to rest on the captions', () => {
    controller.hoverStart();
    vi.advanceTimersByTime(HOVER_INTENT_MS - 50);
    expect(pauses).toBe(0);
    vi.advanceTimersByTime(50);
    expect(pauses).toBe(1);
  });

  it('does not pause for a pointer passing over', () => {
    controller.hoverStart();
    vi.advanceTimersByTime(HOVER_INTENT_MS / 2);
    controller.hoverEnd();
    vi.advanceTimersByTime(HOVER_INTENT_MS);
    expect(pauses).toBe(0);
  });

  it('does not pause once the line under the pointer has gone', () => {
    let hovered = true;
    controller.hoverStart(() => hovered);
    vi.advanceTimersByTime(HOVER_INTENT_MS / 2);
    // The line ended: its captions unmounted without a mouseleave.
    hovered = false;
    vi.advanceTimersByTime(HOVER_INTENT_MS);
    expect(pauses).toBe(0);
  });
});
