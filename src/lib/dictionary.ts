import { baseLang } from './languages';

export interface DictionarySense {
  definition: string;
  examples: string[];
}

export interface DictionaryEntry {
  partOfSpeech: string;
  senses: DictionarySense[];
}

export interface DictionaryResult {
  word: string;
  lang: string;
  source: 'wiktionary';
  url: string;
  entries: DictionaryEntry[];
}

interface WiktionaryDefinition {
  definition: string;
  examples?: string[];
  parsedExamples?: { example: string }[];
}
interface WiktionaryUsage {
  partOfSpeech: string;
  language: string;
  definitions: WiktionaryDefinition[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Strip Wiktionary's HTML into plain text (no DOM available in the service worker). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWiktionary(json: Record<string, WiktionaryUsage[]>, lang: string): DictionaryEntry[] {
  const code = baseLang(lang);
  const usages = json[code] ?? (code === 'nb' ? (json.no ?? json.nb) : undefined) ?? [];
  return usages
    .map((u) => ({
      partOfSpeech: u.partOfSpeech,
      senses: u.definitions
        .map((d) => ({
          definition: htmlToText(d.definition),
          examples: (d.parsedExamples?.map((e) => e.example) ?? d.examples ?? []).map(htmlToText).filter(Boolean).slice(0, 2),
        }))
        .filter((s) => s.definition.length > 0)
        .slice(0, 6),
    }))
    .filter((e) => e.senses.length > 0);
}

/**
 * Look a word up in English Wiktionary (which has entries for most languages, with
 * definitions written in English). Free, keyless, cached by the browser's HTTP cache.
 */
export async function lookupWiktionary(word: string, lang: string): Promise<DictionaryResult> {
  // Lower-case first: "Truth" at the start of a sentence is the common noun, not a brand.
  // Languages that capitalize nouns (German) fall back to the original spelling.
  const candidates = [...new Set([word.toLowerCase(), word])];
  for (const candidate of candidates) {
    const title = encodeURIComponent(candidate.replace(/ /g, '_'));
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${title}?redirect=true`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`Wiktionary error ${res.status}`);
    const entries = parseWiktionary((await res.json()) as Record<string, WiktionaryUsage[]>, lang);
    if (entries.length) {
      return { word: candidate, lang, source: 'wiktionary', url: `https://en.wiktionary.org/wiki/${title}`, entries };
    }
  }
  return {
    word,
    lang,
    source: 'wiktionary',
    url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
    entries: [],
  };
}

/** External dictionaries offered as links in the word pop-up. */
export function externalDictionaries(word: string, lang: string, native: string): { name: string; url: string }[] {
  const w = encodeURIComponent(word);
  const src = baseLang(lang);
  const tgt = baseLang(native);
  const links = [
    { name: 'Google Translate', url: `https://translate.google.com/?sl=${src}&tl=${tgt}&text=${w}` },
    { name: 'Wiktionary', url: `https://en.wiktionary.org/wiki/${w}` },
    { name: 'Forvo', url: `https://forvo.com/word/${w}/#${src}` },
    { name: 'Images', url: `https://www.google.com/search?tbm=isch&q=${w}` },
  ];
  if (src === 'ja') links.push({ name: 'Jisho', url: `https://jisho.org/search/${w}` });
  if (src === 'zh') links.push({ name: 'MDBG', url: `https://www.mdbg.net/chinese/dictionary?wdqb=${w}` });
  if (src === 'ko') links.push({ name: 'Naver', url: `https://korean.dict.naver.com/koendict/#/search?query=${w}` });
  if (['es', 'fr', 'it', 'pt', 'de'].includes(src)) {
    links.push({ name: 'WordReference', url: `https://www.wordreference.com/${src}${tgt === src ? 'en' : tgt}/${w}` });
  }
  if (src === 'en') links.push({ name: 'Cambridge', url: `https://dictionary.cambridge.org/dictionary/english/${w}` });
  if (['de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'sv', 'ru'].includes(src)) {
    links.push({ name: 'Reverso Context', url: `https://context.reverso.net/translation/${src}-${tgt}/${w}` });
  }
  return links;
}
