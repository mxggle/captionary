import { describe, expect, it } from 'vitest';
import { extractNetflixTracks, mayHoldNetflixTracks, patchManifestRequest, VTT_PROFILE } from './netflix';

const manifest = {
  version: 2,
  result: {
    movieId: 80057281,
    timedtexttracks: [
      { isNoneTrack: true, language: 'none' },
      {
        new_track_id: 'T:1:0;1;en;0;0;0;',
        language: 'en',
        languageDescription: 'English',
        rawTrackType: 'subtitles',
        isForcedNarrative: false,
        ttDownloadables: {
          [VTT_PROFILE]: { urls: [{ cdn_id: 1, url: 'https://ipv4-c001.1.oca.nflxvideo.net/?o=1&v=en.vtt' }] },
          'dfxp-ls-sdh': { downloadUrls: { '1': 'https://ipv4-c001.1.oca.nflxvideo.net/?o=1&v=en.dfxp' } },
        },
      },
      {
        new_track_id: 'T:1:0;1;es;1;0;0;',
        language: 'es',
        languageDescription: 'Spanish [CC]',
        rawTrackType: 'closedcaptions',
        ttDownloadables: { 'dfxp-ls-sdh': { downloadUrls: { '7': 'https://x.nflxvideo.net/es.dfxp' } } },
      },
      {
        id: 'forced-de',
        language: 'de',
        languageDescription: 'Deutsch (Forced)',
        isForcedNarrative: true,
        ttDownloadables: { [VTT_PROFILE]: { downloadUrls: { '3': 'https://x.nflxvideo.net/de.vtt' } } },
      },
      { language: 'fr', ttDownloadables: { 'imsc1.1': { urls: [{ url: 'https://x/fr.ttml' }] } } },
    ],
  },
};

describe('Netflix manifest', () => {
  it('extracts usable subtitle tracks from both URL layouts', () => {
    const out = extractNetflixTracks(manifest);
    expect(out?.movieId).toBe('80057281');
    expect(out?.tracks).toEqual([
      {
        id: 'T:1:0;1;en;0;0;0;',
        lang: 'en',
        label: 'English',
        forced: false,
        closedCaptions: false,
        vtt: 'https://ipv4-c001.1.oca.nflxvideo.net/?o=1&v=en.vtt',
        dfxp: 'https://ipv4-c001.1.oca.nflxvideo.net/?o=1&v=en.dfxp',
      },
      {
        id: 'T:1:0;1;es;1;0;0;',
        lang: 'es',
        label: 'Spanish [CC]',
        forced: false,
        closedCaptions: true,
        vtt: undefined,
        dfxp: 'https://x.nflxvideo.net/es.dfxp',
      },
      {
        id: 'forced-de',
        lang: 'de',
        label: 'Deutsch (Forced)',
        forced: true,
        closedCaptions: false,
        vtt: 'https://x.nflxvideo.net/de.vtt',
        dfxp: undefined,
      },
    ]);
  });

  it('accepts an unwrapped result and ignores unrelated JSON', () => {
    expect(extractNetflixTracks(manifest.result)?.tracks).toHaveLength(3);
    expect(extractNetflixTracks({ result: { movieId: 1 } })).toBeNull();
    expect(extractNetflixTracks(null)).toBeNull();
    expect(extractNetflixTracks('text')).toBeNull();
  });

  it('reads v4 manifests (textTracks / downloadables) and skips unhydrated tracks', () => {
    const v4 = {
      result: {
        movieId: 70196252,
        manifestVersion: 'v4',
        textTracks: [
          { id: 'T:none', isNoneTrack: true, language: 'none', downloadables: {} },
          {
            id: 'T:1:1;1;en;1;0;',
            language: 'en',
            languageDescription: 'English [CC]',
            rawTrackType: 'closedcaptions',
            trackType: 'PRIMARY',
            hydrated: true,
            downloadables: {
              [VTT_PROFILE]: { size: 1, urls: [{ cdnId: 1, url: 'https://x.nflxvideo.net/en.vtt' }] },
            },
          },
          { id: 'T:1:1;1;ja;0;0;', language: 'ja', languageDescription: 'Japanese', hydrated: false, downloadables: {} },
        ],
      },
    };
    const text = JSON.stringify(v4);
    expect(mayHoldNetflixTracks(text)).toBe(true);
    expect(extractNetflixTracks(JSON.parse(text))).toEqual({
      movieId: '70196252',
      tracks: [
        {
          id: 'T:1:1;1;en;1;0;',
          lang: 'en',
          label: 'English [CC]',
          forced: false,
          closedCaptions: true,
          vtt: 'https://x.nflxvideo.net/en.vtt',
          dfxp: undefined,
        },
      ],
    });
    expect(mayHoldNetflixTracks(JSON.stringify(manifest))).toBe(true);
    expect(mayHoldNetflixTracks('{"textTrackSettings":{}}')).toBe(false);
  });

  it('turns off partial hydration so every subtitle track carries URLs', () => {
    const req = { params: { profiles: [] as string[], supportsPartialHydration: true } };
    patchManifestRequest(req);
    expect(req.params.supportsPartialHydration).toBe(false);
  });

  it('asks for WebVTT and all subtitle languages in manifest requests', () => {
    const req = { version: 2, url: '/manifest', params: { profiles: ['playready-h264mpl30-dash', 'dfxp-ls-sdh'] } };
    expect(patchManifestRequest(req)).toBe(true);
    expect(req.params.profiles).toContain(VTT_PROFILE);
    expect((req.params as { showAllSubDubTracks?: boolean }).showAllSubDubTracks).toBe(true);
    patchManifestRequest(req);
    expect(req.params.profiles.filter((p) => p === VTT_PROFILE)).toHaveLength(1);
    expect(patchManifestRequest({ some: 'other json' })).toBe(false);
  });
});
