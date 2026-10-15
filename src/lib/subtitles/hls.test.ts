import { describe, expect, it } from 'vitest';
import { normalizeLang } from '../languages';
import { isSubtitleMaster, parseAttributes, parseMasterPlaylist, parseMediaPlaylist } from './hls';
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

  it('lists each segment file once', () => {
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
    expect(parseMediaPlaylist(media, 'https://vod-ap-aoc.tv.apple.com/a/b/list.m3u8')).toEqual([
      'https://vod-ap-aoc.tv.apple.com/a/b/P1_A2_en_subtitles_V1-.webvtt',
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
