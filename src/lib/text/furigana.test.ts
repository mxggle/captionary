import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { lineFurigana, lineReading, rubyPieces, wordFurigana } from './furigana';
import { createJapaneseTokenizer, type JapaneseTokenizer } from './kuromoji';

const dictDir = join(dirname(createRequire(import.meta.url).resolve('kuromoji/package.json')), 'dict');
let tk: JapaneseTokenizer;
beforeAll(async () => {
  tk = await createJapaneseTokenizer(async (name) => {
    const buf = gunzipSync(await readFile(join(dictDir, name)));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });
}, 30_000);

describe('wordFurigana', () => {
  it('gives each kanji run only its own part of the reading', () => {
    expect(wordFurigana('選ば', 'エラバ')).toEqual([{ start: 0, end: 1, reading: 'えら' }]);
    expect(wordFurigana('取り扱い', 'トリアツカイ')).toEqual([
      { start: 0, end: 1, reading: 'と' },
      { start: 2, end: 3, reading: 'あつか' },
    ]);
    expect(wordFurigana('言葉', 'コトバ')).toEqual([{ start: 0, end: 2, reading: 'ことば' }]);
  });
  it('skips kana-only words', () => {
    expect(wordFurigana('なら', 'ナラ')).toEqual([]);
  });
});

describe('Japanese line readings', () => {
  const line = 'ま 言葉選ばずに言うのなら';
  it('reads every kanji in the line', () => {
    const spans = lineFurigana(tk.tokenize(line));
    const kanji = spans.filter((s) => !s.kana).map((s) => [line.slice(s.start, s.end), s.reading]);
    expect(kanji).toEqual([
      ['言葉', 'ことば'],
      ['選', 'えら'],
      ['言', 'い'],
    ]);
  });
  it('writes the reading in the chosen script', () => {
    const t = tk.tokenize('私は東京へ行きます。');
    expect(lineReading(t, 'hiragana')).toBe('わたしはとうきょうへいきます。');
    expect(lineReading(t, 'katakana')).toBe('ワタシハトウキョウヘイキマス。');
    expect(lineReading(t, 'romaji')).toBe('watashi wa toukyou e ikimasu.');
  });
  it('splits a word into ruby pieces', () => {
    const text = '言葉選ばずに';
    const spans = lineFurigana(tk.tokenize(text));
    expect(rubyPieces(text, 0, 2, spans, 'hiragana')).toEqual([{ text: '言葉', reading: 'ことば' }]);
    expect(rubyPieces(text, 2, 6, spans, 'katakana')).toEqual([{ text: '選', reading: 'エラ' }, { text: 'ばずに' }]);
    expect(rubyPieces(text, 2, 6, spans, 'romaji')).toEqual([{ text: '選ばずに', reading: 'erabazuni' }]);
  });
  it('reads particles as said in romaji only', () => {
    const text = '私は';
    const spans = lineFurigana(tk.tokenize(text));
    expect(rubyPieces(text, 1, 2, spans, 'romaji')).toEqual([{ text: 'は', reading: 'wa' }]);
    expect(rubyPieces(text, 1, 2, spans, 'hiragana')).toEqual([{ text: 'は' }]);
  });
});
