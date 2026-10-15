import { pinyin } from 'pinyin-pro';

const HAN = /\p{Script=Han}/u;
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

/**
 * Pinyin with tone marks, grouped by word ("wǒmen yìqǐ qù"). The whole line is passed
 * to pinyin-pro at once so polyphonic characters are read in context (银行 yínháng).
 * Background-only: pinyin-pro carries a large dictionary.
 */
export function romanizeChinese(text: string): string {
  if (!HAN.test(text)) return '';
  const chars = pinyin(text, { type: 'all', toneType: 'symbol' });
  // pinyin-pro returns one entry per UTF-16 code unit sequence it treats as a char.
  const readings: string[] = [];
  let offset = 0;
  for (const c of chars) {
    for (let k = 0; k < c.origin.length; k++) readings[offset + k] = k === 0 && c.isZh ? c.pinyin : k === 0 ? c.origin : '';
    offset += c.origin.length;
  }
  const words: string[] = [];
  for (const seg of segmenter.segment(text)) {
    if (!HAN.test(seg.segment)) {
      const t = seg.segment.trim();
      if (t) words.push(t);
      continue;
    }
    let w = '';
    for (let i = seg.index; i < seg.index + seg.segment.length; i++) w += readings[i] ?? '';
    words.push(w);
  }
  return words
    .join(' ')
    .replace(/ ([，。！？、；：,.!?;:）」』”])/g, (_, p: string) => toAscii(p))
    .replace(/([（「『“]) /g, '$1')
    .replace(/[，。！？、；：（）]/g, toAscii);
}

function toAscii(p: string): string {
  return (
    ({ '，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '（': '(', '）': ')' } as Record<string, string>)[p] ??
    p
  );
}
