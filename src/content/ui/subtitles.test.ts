import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/en';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { trackLabel, translationChoices, translationLang } from './subtitles';

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

describe('the translation list', () => {
  it('starts with Off, then the learner’s language by source, then other languages', () => {
    const tracks = [
      { id: 'ja', lang: 'ja', label: 'Japanese' },
      { id: 'en', lang: 'en', label: 'English' },
      { id: 'fr', lang: 'fr', label: 'French' },
    ];
    const choices = translationChoices({ ...base, tracks, originalTrackId: 'ja', aiStatus: null });
    expect(choices.map((c) => c.key)).toEqual(['none', 'track:en', 'chrome', 'ai', 'track:fr']);
    expect(choices.find((c) => c.key === 'track:en')?.meta).toBe(en.content.subtitles.metaOfficial);
    expect(choices.find((c) => c.key === 'chrome')?.label).toBe(en.content.subtitles.choiceOnDevice);
    expect(choices.find((c) => c.key === 'track:fr')?.primary).toBe(false);
  });

  it('names a host’s language-only tracks in the UI language, keeping the region', () => {
    expect(trackLabel({ id: '1', lang: 'es-419', label: 'Español (Latinoamérica)', cc: true, namedByLang: true })).toBe(
      'Latin American Spanish (CC)',
    );
    expect(trackLabel({ id: '2', lang: 'ja', label: '日本語', namedByLang: true })).toBe('Japanese');
    expect(trackLabel({ id: '3', lang: 'en', label: 'English (auto-generated)' })).toBe('English (auto-generated)');
    expect(trackLabel({ id: 'a.ja', lang: 'ja', label: '日本語 (自動生成)', auto: true, namedByLang: true })).toBe(
      'Japanese (auto-generated)',
    );
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
