import { describe, expect, it } from 'vitest';
import {
  alignTracks,
  cleanCueText,
  cueIndexAt,
  cueIndexBefore,
  normalizeCues,
  parseTtml,
  parseVttOrSrt,
  parseYouTubeJson3,
  toSrt,
} from './parse';

describe('parseVttOrSrt', () => {
  it('parses WebVTT with settings, tags and entities', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.500 position:50% line:85%
<c.bg_transparent>Hello &amp; <i>welcome</i></c>

2
00:00:04.000 --> 00:00:05.000
Second
line`;
    expect(parseVttOrSrt(vtt)).toEqual([
      { start: 1, end: 3.5, text: 'Hello & welcome' },
      { start: 4, end: 5, text: 'Second line' },
    ]);
  });

  it('parses SRT with comma milliseconds and CRLF', () => {
    const srt = '1\r\n00:01:02,500 --> 00:01:04,000\r\nHola\r\n\r\n2\r\n00:01:05,000 --> 00:01:06,250\r\n¿Qué tal?\r\n';
    expect(parseVttOrSrt(srt)).toEqual([
      { start: 62.5, end: 64, text: 'Hola' },
      { start: 65, end: 66.25, text: '¿Qué tal?' },
    ]);
  });
});

describe('parseYouTubeJson3', () => {
  it('joins segments, skips append/newline events and clips overlaps', () => {
    const json = {
      events: [
        { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: 'one ' }, { utf8: 'two' }] },
        { tStartMs: 2000, dDurationMs: 10, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'three' }] },
        { tStartMs: 6000, dDurationMs: 1000 },
      ],
    };
    expect(parseYouTubeJson3(json)).toEqual([
      { start: 0, end: 3, text: 'one two' },
      { start: 3, end: 5, text: 'three' },
    ]);
  });
});

describe('parseTtml', () => {
  it('reads tick-based Netflix DFXP with line breaks', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000">
 <body><div>
  <p begin="10000000t" end="25000000t">Bonjour<br/>le monde</p>
  <p begin="30000000t" end="40000000t"><span>Salut</span></p>
 </div></body></tt>`;
    expect(parseTtml(xml)).toEqual([
      { start: 1, end: 2.5, text: 'Bonjour le monde' },
      { start: 3, end: 4, text: 'Salut' },
    ]);
  });
});

describe('normalizeCues', () => {
  it('merges cues that start together and drops empty ones', () => {
    expect(
      normalizeCues([
        { start: 1, end: 2, text: 'A' },
        { start: 1.01, end: 2.5, text: 'B' },
        { start: 3, end: 3, text: 'zero length' },
        { start: 4, end: 5, text: '' },
      ]),
    ).toEqual([{ start: 1, end: 2.5, text: 'A B' }]);
  });
});

describe('cleanCueText', () => {
  it('strips markup and direction marks', () => {
    expect(cleanCueText('\u200e<b>Hi</b>\n{\\an8}there')).toBe('Hi there');
  });
});

describe('alignTracks', () => {
  it('assigns differently split translation cues by overlap', () => {
    const original = [
      { start: 0, end: 2, text: 'a' },
      { start: 2, end: 4, text: 'b' },
      { start: 5, end: 6, text: 'c' },
    ];
    const translation = [
      { start: 0, end: 1.2, text: 'A1' },
      { start: 1.2, end: 2.1, text: 'A2' },
      { start: 2.2, end: 3.9, text: 'B' },
      { start: 7, end: 8, text: 'orphan' },
    ];
    expect(alignTracks(original, translation)).toEqual(['A1 A2', 'B', '']);
  });
});

describe('cue lookup', () => {
  const cues = [
    { start: 0, end: 1, text: 'a' },
    { start: 2, end: 3, text: 'b' },
    { start: 3, end: 4, text: 'c' },
  ];
  it('finds the active cue', () => {
    expect(cueIndexAt(cues, 0.5)).toBe(0);
    expect(cueIndexAt(cues, 1.5)).toBe(-1);
    expect(cueIndexAt(cues, 3)).toBe(2);
  });
  it('finds the last cue before a time', () => {
    expect(cueIndexBefore(cues, 1.5)).toBe(0);
    expect(cueIndexBefore(cues, -1)).toBe(-1);
  });
});

describe('toSrt', () => {
  it('writes both languages', () => {
    expect(toSrt([{ start: 3661.5, end: 3662, text: 'Hola' }], ['Hello'])).toBe('1\n01:01:01,500 --> 01:01:02,000\nHola\nHello');
  });
});
