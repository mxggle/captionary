import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getSettings, updateSettings } from '@/lib/settings';
import { SessionController, type SiteAdapter } from './controller';
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
