import { describe, expect, it } from 'vitest';
import { normalizeLang } from '../languages';
import {
  assetOf,
  isSubtitleMaster,
  parseAttributes,
  parseMasterPlaylist,
  parseMediaPlaylist,
  planSubtitleParts,
  timelineDomains,
} from './hls';
import { parseVttOrSrt } from './parse';

const BASE = 'https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?a=1';

function sub(lang: string, name: string, pathway: string, extra = '') {
  return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles_vod-${pathway}-aoc.tv.apple.com",PATHWAY-ID="${pathway}",NAME="${name}",LANGUAGE="${lang}",AUTOSELECT=YES,${extra}URI="https://vod-${pathway}-aoc.tv.apple.com/itunes-assets/x/P1_A2_${lang}_subtitles_V1.m3u8"`;
}

const MASTER = [
  '#EXTM3U',
  '#EXT-X-SESSION-DATA:DATA-ID="com.apple.hls.title",VALUE="Severance"',
  '#EXT-X-SESSION-DATA:DATA-ID="com.apple.hls.feature.adam-id",VALUE="1779318764"',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-stereo",NAME="English AD",LANGUAGE="en",CHARACTERISTICS="public.accessibility.describes-video",URI="ad.m3u8"',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-stereo",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="en.m3u8"',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-stereo",NAME="Español",LANGUAGE="es-419",URI="es.m3u8"',
  ...['ap', 'fa', 'ak'].flatMap((p) => [
    sub('en', 'English', p, 'STABLE-RENDITION-ID="en-1",FORCED=NO,'),
    sub('en', 'English (forced)', p, 'STABLE-RENDITION-ID="en-f",FORCED=YES,'),
    sub(
      'en',
      'English ',
      p,
      'STABLE-RENDITION-ID="en-sdh",FORCED=NO,CHARACTERISTICS="public.accessibility.transcribes-spoken-dialog,public.accessibility.describes-music-and-sound",',
    ),
    sub('zh-Hans', '简体中文', p, 'STABLE-RENDITION-ID="zh-1",FORCED=NO,'),
  ]),
  '#EXT-X-STREAM-INF:BANDWIDTH=1000,SUBTITLES="subtitles_vod-ap-aoc.tv.apple.com"',
  'video.m3u8',
].join('\n');

describe('HLS master playlist', () => {
  it('parses quoted attributes containing commas', () => {
    expect(parseAttributes('TYPE=SUBTITLES,CHARACTERISTICS="a,b",FORCED=NO')).toEqual({
      TYPE: 'SUBTITLES',
      CHARACTERISTICS: 'a,b',
      FORCED: 'NO',
    });
  });

  it('dedupes pathways, classifies variants and reads session data', () => {
    expect(isSubtitleMaster(MASTER)).toBe(true);
    const m = parseMasterPlaylist(MASTER, BASE);
    expect(m.title).toBe('Severance');
    expect(m.adamId).toBe('1779318764');
    expect(m.audioLang).toBe('en');
    expect(m.subtitles.map((s) => [s.id, s.lang, s.name, s.forced, s.sdh])).toEqual([
      ['en-1', 'en', 'English', false, false],
      ['en-sdh', 'en', 'English', false, true],
      ['en-f', 'en', 'English (forced)', true, false],
      ['zh-1', 'zh-Hans', '简体中文', false, false],
    ]);
    expect(m.subtitles[0].uri).toMatch(/^https:\/\/vod-ap-aoc\.tv\.apple\.com\//);
  });

  it('lists each segment file once and keeps an unstitched title at its own times', () => {
    const media = `#EXTM3U
#EXT-X-TARGETDURATION:32
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:31.85800,
#EXT-X-BYTERANGE:1054@0
P1_A2_en_subtitles_V1-.webvtt
#EXTINF:30,
#EXT-X-BYTERANGE:900@1054
P1_A2_en_subtitles_V1-.webvtt
#EXT-X-ENDLIST`;
    const segments = parseMediaPlaylist(media, 'https://vod-ap-aoc.tv.apple.com/a/b/list.m3u8');
    expect(segments.map((s) => [s.start, s.duration, s.discontinuity])).toEqual([
      [0, 31.858, 0],
      [31.858, 30, 0],
    ]);
    expect(planSubtitleParts(segments, '2', null)).toEqual([
      { uris: ['https://vod-ap-aoc.tv.apple.com/a/b/P1_A2_en_subtitles_V1-.webvtt'], offset: 0 },
    ]);
  });

  it('parses Apple WebVTT with lone CR line breaks and timestamp map', () => {
    const vtt =
      'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n1\n00:00:02.711 --> 00:00:04.505 align:middle line:100%,end position:50%,middle\nSo what did you guys\rsee up there?\n\n2\n00:00:05.000 --> 00:00:06.000\n<i>Music</i>\n';
    expect(parseVttOrSrt(vtt)).toEqual([
      { start: 2.711, end: 4.505, text: 'So what did you guys see up there?' },
      { start: 5, end: 6, text: 'Music' },
    ]);
  });

  it('normalizes Apple language codes', () => {
    expect(normalizeLang('zh-Hans')).toBe('zh-CN');
    expect(normalizeLang('zh-Hant')).toBe('zh-TW');
    expect(normalizeLang('es-419')).toBe('es');
    expect(normalizeLang('fr-CA')).toBe('fr');
    expect(normalizeLang('yue-Hant')).toBe('yue');
    expect(normalizeLang('cmn-Hans')).toBe('zh-CN');
    expect(normalizeLang('cmn-Hant')).toBe('zh-TW');
    expect(normalizeLang('no')).toBe('nb');
  });
});

// Severance S1E1 as streamed on 2026-10-16 (trimmed): an Apple TV ident, a promo for another
// title, the episode, then post-roll slots, each after a discontinuity.
const CDN = 'https://vod-ap-aoc.tv.apple.com/itunes-assets/X';
const EPISODE = '1600701943';
const STITCHED_SUBTITLES = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:180
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:8.126,\t
${CDN}/empty-8126.webvtt?accessKey=k
#EXT-X-DISCONTINUITY
#EXTINF:31.20800,\t
${CDN}/P1504082596_A6812927623_en_subtitles_V2-0.webvtt?accessKey=k
#EXT-X-DISCONTINUITY
#EXTINF:60.00000,\t
${CDN}/P1451997785_A1600701943_en_subtitles_V2-0.webvtt
#EXTINF:60.00000,\t
${CDN}/P1451997785_A1600701943_en_subtitles_V2-1.webvtt
#EXTINF:3314.882,\t
${CDN}/P1451997785_A1600701943_en_subtitles_V2-2.webvtt
#EXT-X-DISCONTINUITY
#EXTINF:12.12,\t
${CDN}/empty-12120.webvtt?accessKey=k
#EXT-X-DISCONTINUITY
#EXTINF:12.12,\t
${CDN}/empty-12120.webvtt?accessKey=k
#EXT-X-ENDLIST`;

/** Runs of the video playlist streamed alongside it (durations differ slightly from the subtitles'). */
const STITCHED_VIDEO = [
  { start: 0, duration: 8.008, asset: '1848971751' },
  { start: 8.008, duration: 31.073, asset: '6812927623' },
  { start: 39.081, duration: 3434.723, asset: EPISODE },
  { start: 3473.804, duration: 12.012, asset: '1605935301' },
  { start: 3485.816, duration: 12.012, asset: '1605487986' },
];

const EPISODE_FILES = [0, 1, 2].map((n) => `${CDN}/P1451997785_A1600701943_en_subtitles_V2-${n}.webvtt`);

describe('HLS stitched streams (Apple TV+ episodes)', () => {
  const segments = parseMediaPlaylist(STITCHED_SUBTITLES, BASE);

  it('splits the playlist into runs per title', () => {
    expect(assetOf(`${CDN}/P1451997785_A1600701943_en_subtitles_V2-0.webvtt?x=1`)).toBe(EPISODE);
    expect(assetOf(`${CDN}/empty-8126.webvtt`)).toBeNull();
    expect(timelineDomains(segments).map((d) => [Number(d.start.toFixed(3)), d.asset, d.uris.length])).toEqual([
      [0, null, 1],
      [8.126, '6812927623', 1],
      [39.334, EPISODE, 3],
      [3474.216, null, 1],
      [3486.336, null, 1],
    ]);
  });

  it('keeps only the episode and moves it to where the player plays it', () => {
    // Episode cue "Who are you?" is at 14.139 s in its file and plays at 39.081 + 14.139 s.
    expect(planSubtitleParts(segments, EPISODE, STITCHED_VIDEO)).toEqual([{ uris: EPISODE_FILES, offset: 39.081 }]);
  });

  it('falls back to the subtitle playlist timeline without a matching video playlist', () => {
    const [part] = planSubtitleParts(segments, EPISODE, null);
    expect(part.uris).toEqual(EPISODE_FILES);
    expect(part.offset).toBeCloseTo(39.334, 3);
    // A video playlist of another title (the show page's hero preview) is ignored.
    const preview = [{ start: 0, duration: 26.285, asset: '1785465905' }];
    expect(planSubtitleParts(segments, EPISODE, preview)[0].offset).toBeCloseTo(39.334, 3);
  });

  it('picks the longest titled run when the master has no title id', () => {
    expect(planSubtitleParts(segments, null, STITCHED_VIDEO)).toEqual([{ uris: EPISODE_FILES, offset: 39.081 }]);
  });

  it('keeps the episode clock running across a mid-roll', () => {
    const midRoll = `#EXTM3U
#EXTINF:600,
${CDN}/P1_A${EPISODE}_en_subtitles_V2-0.webvtt
#EXT-X-DISCONTINUITY
#EXTINF:30,
${CDN}/P2_A42_en_subtitles_V2-0.webvtt
#EXT-X-DISCONTINUITY
#EXTINF:900,
${CDN}/P1_A${EPISODE}_en_subtitles_V2-10.webvtt
#EXT-X-ENDLIST`;
    const video = [
      { start: 0, duration: 599.9, asset: EPISODE },
      { start: 599.9, duration: 30, asset: '42' },
      { start: 629.9, duration: 900, asset: EPISODE },
    ];
    expect(planSubtitleParts(parseMediaPlaylist(midRoll, BASE), EPISODE, video).map((p) => p.offset)).toEqual([0, 629.9 - 599.9]);
  });

  it('places untitled runs by position', () => {
    const plain = `#EXTM3U
#EXTINF:10,
a.webvtt
#EXT-X-DISCONTINUITY
#EXTINF:20,
b.webvtt
#EXT-X-ENDLIST`;
    const parts = planSubtitleParts(parseMediaPlaylist(plain, BASE), null, null);
    expect(parts.map((p) => p.offset)).toEqual([0, 10]);
  });

  it('drops filler cues that hold only a zero-width space', () => {
    expect(parseVttOrSrt('WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n1\n00:00:07.793 --> 00:00:08.126\n\u200b\n')).toEqual(
      [],
    );
  });
});
