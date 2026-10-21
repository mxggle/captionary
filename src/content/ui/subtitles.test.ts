import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/en';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { translationChoices, translationLang } from './subtitles';

const settings = { ...DEFAULT_SETTINGS, uiLanguage: 'en' as const, nativeLanguage: 'en' };
const base = { tracks: [], originalTrackId: null, site: 'netflix' as const, settings };

describe('translationChoices', () => {
  it('marks AI translation as needing setup while no provider is configured', () => {
    const ai = translationChoices({ ...base, aiStatus: { enabled: true, configured: false, autoExplain: false } }).find(
      (c) => c.key === 'ai',
    );
    expect(ai?.setup).toBe(true);
    expect(ai?.meta).toBe(en.content.subtitles.metaAiNeedsSetup);
  });

  it('offers AI translation as is once it is set up, or while its status is unknown', () => {
    const ready = translationChoices({ ...base, aiStatus: { enabled: true, configured: true, autoExplain: false } });
    expect(ready.find((c) => c.key === 'ai')?.setup).toBe(false);
    expect(translationChoices({ ...base, aiStatus: null }).find((c) => c.key === 'ai')?.setup).toBe(false);
  });
});

describe('translationLang', () => {
  it('is a subtitle track’s own language, else the language translated into', () => {
    const tracks = [{ id: 'fr', lang: 'fr', label: 'French' }];
    expect(translationLang({ tracks, translationSource: { type: 'track', trackId: 'fr' } })).toBe('fr');
    expect(translationLang({ tracks, translationSource: { type: 'ai', lang: 'ja' } })).toBe('ja');
    expect(translationLang({ tracks, translationSource: { type: 'none' } })).toBeUndefined();
  });
});
