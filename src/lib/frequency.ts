import { openDB, type IDBPDatabase } from 'idb';
import { baseLang, normalizeLang } from './languages';

/**
 * Word-frequency lists from OpenSubtitles (hermitdave/FrequencyWords, MIT). Downloaded
 * on demand the first time a language needs one, then kept locally. Subtitles are the
 * ideal corpus here: the ranks reflect spoken, everyday language.
 */
const SOURCE = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content';
const KEEP = 30_000;

function listCode(lang: string): string {
  const norm = normalizeLang(lang);
  if (norm === 'zh-CN') return 'zh_cn';
  if (norm === 'zh-TW') return 'zh_tw';
  if (norm === 'nb') return 'no';
  if (norm === 'fil') return 'tl';
  return baseLang(norm);
}

/** "word count" lines → words in rank order. */
export function parseFrequencyList(text: string, limit = KEEP): string[] {
  const words: string[] = [];
  for (const line of text.split('\n')) {
    const word = line.split(' ')[0]?.trim();
    if (word) words.push(word.normalize('NFC'));
    if (words.length >= limit) break;
  }
  return words;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  // Pre-rename database name, kept so existing installs keep their data.
  dbPromise ??= openDB('language-react-data', 1, {
    upgrade(database) {
      database.createObjectStore('frequency', { keyPath: 'code' });
    },
  });
  return dbPromise;
}

/** Ranked word list for a language, or null if none is published. (Background only.) */
export async function getFrequencyList(lang: string): Promise<string[] | null> {
  const code = listCode(lang);
  const cached = (await (await db()).get('frequency', code)) as { code: string; words: string[] | null } | undefined;
  if (cached) return cached.words;
  let words: string[] | null = null;
  for (const year of ['2018', '2016']) {
    const res = await fetch(`${SOURCE}/${year}/${code}/${code}_50k.txt`, { credentials: 'omit' });
    if (res.ok) {
      words = parseFrequencyList(await res.text());
      break;
    }
    if (res.status !== 404) throw new Error(`Frequency list download failed (${res.status})`);
  }
  // Remember misses too, so unsupported languages are not re-requested on every video.
  await (await db()).put('frequency', { code, words });
  return words;
}

export async function clearFrequencyLists(): Promise<void> {
  await (await db()).clear('frequency');
}
