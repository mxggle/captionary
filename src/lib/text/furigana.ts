import { romanizeKana } from './romanize';

/** How Japanese readings are written: furigana in hiragana or katakana, or romaji. */
export type JapaneseReadingScript = 'hiragana' | 'katakana' | 'romaji';

/**
 * A reading over part of a line: UTF-16 offsets `[start, end)` and the reading in hiragana.
 * `kana` marks a reading that only matters in romaji: the particles は and へ, said "wa" and "e".
 */
export interface RubySpan {
  start: number;
  end: number;
  reading: string;
  kana?: true;
}

/** The fields of a kuromoji token this module reads. */
export interface MorphToken {
  surface_form: string;
  reading?: string;
  pos?: string;
  pos_detail_1?: string;
}

/** Endings and helpers that romaji writes joined to the word before: 行き|ます → ikimasu, 食べ|て → tabete. */
function joinsPrevious(t: MorphToken): boolean {
  return t.pos === '助動詞' || t.pos_detail_1 === '接尾' || t.pos_detail_1 === '非自立' || t.pos_detail_1 === '接続助詞';
}

const KANJI = /[々-〇㐀-䶿一-鿿豈-﫿ヶヵ]/;
const KANJI_RUN = /[々-〇㐀-䶿一-鿿豈-﫿ヶヵ]+/g;

export function hasKanji(text: string): boolean {
  return KANJI.test(text);
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Readings for the kanji in one word. The word's kana (okurigana) is matched against its reading so each
 * kanji run gets only its own part: 選ば (えらば) → 選 = えら. When that fails the whole word gets the reading.
 */
export function wordFurigana(surface: string, reading: string, offset = 0): RubySpan[] {
  if (!hasKanji(surface) || !reading) return [];
  const kana = toHiragana(reading);
  const runs: { start: number; end: number }[] = [];
  for (const m of surface.matchAll(KANJI_RUN)) runs.push({ start: m.index!, end: m.index! + m[0].length });
  // Kana between the kanji runs must appear in the reading as written.
  let pattern = '^';
  let at = 0;
  for (const r of runs) {
    pattern += escape(toHiragana(surface.slice(at, r.start))) + '(.+?)';
    at = r.end;
  }
  pattern += escape(toHiragana(surface.slice(at))) + '$';
  const m = new RegExp(pattern).exec(kana);
  if (m && toHiragana(surface) !== kana) {
    return runs.map((r, i) => ({ start: offset + r.start, end: offset + r.end, reading: m[i + 1] }));
  }
  return [{ start: offset, end: offset + surface.length, reading: kana }];
}

/** Ruby spans for a line from its kuromoji tokens (whose surfaces, joined, are the line). */
export function lineFurigana(tokens: MorphToken[]): RubySpan[] {
  const out: RubySpan[] = [];
  let offset = 0;
  for (const t of tokens) {
    const surface = t.surface_form;
    const reading = t.reading && t.reading !== '*' ? t.reading : '';
    if (reading) out.push(...wordFurigana(surface, reading, offset));
    if (t.pos === '助詞' && (surface === 'は' || surface === 'へ')) {
      out.push({ start: offset, end: offset + 1, reading: surface === 'は' ? 'わ' : 'え', kana: true });
    }
    offset += surface.length;
  }
  return out;
}

/** The whole reading of a line in kana or romaji, for a single line of text (the look-up card, the reader). */
export function lineReading(tokens: MorphToken[], script: JapaneseReadingScript): string {
  const words: string[] = [];
  for (const t of tokens) {
    const surface = t.surface_form;
    if (!surface.trim()) continue;
    const reading = t.reading && t.reading !== '*' ? toHiragana(t.reading) : toHiragana(surface);
    if (script === 'romaji') {
      const said = t.pos === '助詞' && surface === 'は' ? 'わ' : t.pos === '助詞' && surface === 'へ' ? 'え' : reading;
      const roman = romanizeKana(said);
      if (words.length && joinsPrevious(t) && /[a-z]$/.test(words[words.length - 1])) words[words.length - 1] += roman;
      else words.push(roman);
    } else words.push(script === 'katakana' ? toKatakana(reading) : reading);
  }
  if (script !== 'romaji') return words.join('');
  return words
    .join(' ')
    .replace(/ ?([、。！？])/g, (_, p: string) => ({ '、': ',', '。': '.', '！': '!', '？': '?' })[p] ?? p)
    .replace(/ +([,.!?])/g, '$1');
}

/**
 * The ruby to show over one piece of a line, `[start, end)`, in the learner's script. In hiragana or
 * katakana only kanji get furigana; in romaji the whole piece (a word) gets one reading, kana included.
 * Returns the pieces of the text, each with its reading or none.
 */
export function rubyPieces(
  text: string,
  start: number,
  end: number,
  spans: RubySpan[],
  script: JapaneseReadingScript,
): { text: string; reading?: string }[] {
  const inside = spans.filter((s) => s.start < end && s.end > start);
  if (!inside.length && script !== 'romaji') return [{ text: text.slice(start, end) }];
  if (script === 'romaji') {
    let kana = '';
    let at = start;
    for (const s of inside.sort((a, b) => a.start - b.start)) {
      // A span running past a piece is read in full on the piece where it starts.
      if (s.start >= at) kana += text.slice(at, s.start) + s.reading;
      at = Math.max(at, s.end);
    }
    kana += text.slice(Math.min(at, end), end);
    const piece = text.slice(start, end);
    const roman = /[぀-ヿ々-〇㐀-鿿]/.test(piece) ? romanizeKana(toHiragana(kana)) : '';
    return [{ text: piece, reading: roman && roman !== piece ? roman : undefined }];
  }
  const out: { text: string; reading?: string }[] = [];
  let at = start;
  for (const s of inside.filter((x) => !x.kana).sort((a, b) => a.start - b.start)) {
    // A kanji word cut in two by the word splitter keeps its whole reading on the part where it starts.
    if (s.start < start) continue;
    const to = Math.min(s.end, end);
    if (s.start > at) out.push({ text: text.slice(at, s.start) });
    out.push({ text: text.slice(s.start, to), reading: script === 'katakana' ? toKatakana(s.reading) : s.reading });
    at = to;
  }
  if (at < end) out.push({ text: text.slice(at, end) });
  return out;
}
