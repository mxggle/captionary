// kuromoji ships CommonJS without types; only its dictionary classes and tokenizer are used, not its
// loaders (they need Node's `path` or XMLHttpRequest, which a service worker lacks).
// @ts-expect-error untyped CommonJS module
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries';
// @ts-expect-error untyped CommonJS module
import KuromojiTokenizer from 'kuromoji/src/Tokenizer';
import type { MorphToken } from './furigana';

export interface JapaneseTokenizer {
  tokenize(text: string): MorphToken[];
}

/** Where the dictionary files go in the built extension (see `wxt.config.ts`). */
export const JA_DICT_DIR = 'dict/ja';

/** Load the IPA dictionary through `load(name)`, which returns one decompressed `*.dat` file. */
export async function createJapaneseTokenizer(load: (name: string) => Promise<ArrayBuffer>): Promise<JapaneseTokenizer> {
  const names = [
    'base',
    'check',
    'tid',
    'tid_pos',
    'tid_map',
    'cc',
    'unk',
    'unk_pos',
    'unk_map',
    'unk_char',
    'unk_compat',
    'unk_invoke',
  ] as const;
  const b = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await load(`${n}.dat.gz`)] as const))) as Record<
    (typeof names)[number],
    ArrayBuffer
  >;
  const dic = new DynamicDictionaries();
  dic.loadTrie(new Int32Array(b.base), new Int32Array(b.check));
  dic.loadTokenInfoDictionaries(new Uint8Array(b.tid), new Uint8Array(b.tid_pos), new Uint8Array(b.tid_map));
  dic.loadConnectionCosts(new Int16Array(b.cc));
  dic.loadUnknownDictionaries(
    new Uint8Array(b.unk),
    new Uint8Array(b.unk_pos),
    new Uint8Array(b.unk_map),
    new Uint8Array(b.unk_char),
    new Uint32Array(b.unk_compat),
    new Uint8Array(b.unk_invoke),
  );
  return new KuromojiTokenizer(dic) as JapaneseTokenizer;
}

/** Fetch and gunzip one dictionary file from the extension's own files. */
export async function fetchGzip(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`dictionary ${url}: ${res.status}`);
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
