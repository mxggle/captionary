import { browser } from '#imports';
import { normalizeLang } from './languages';
import { normalizeWord, phraseKey, tokenize } from './text/tokenize';

export type VocabStatus = 'learning' | 'known';

export interface VocabContext {
  sentence: string;
  translation?: string;
  title?: string;
  url?: string;
  /** Seconds into the video. */
  time?: number;
  site?: string;
}

export interface VocabItem {
  id: string;
  lang: string;
  /** Surface form as first saved. */
  text: string;
  /** Normalized key used for matching. */
  key: string;
  kind: 'word' | 'phrase';
  status: VocabStatus;
  translation?: string;
  notes?: string;
  context?: VocabContext;
  createdAt: number;
  updatedAt: number;
}

/** Each item is its own storage key so concurrent saves from several tabs never collide. */
const PREFIX = 'vocab:';

export function vocabId(lang: string, key: string): string {
  return `${normalizeLang(lang)}|${key}`;
}

export async function listVocab(): Promise<VocabItem[]> {
  const all = await browser.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([, v]) => v as VocabItem)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getVocab(id: string): Promise<VocabItem | undefined> {
  const res = await browser.storage.local.get(PREFIX + id);
  return res[PREFIX + id] as VocabItem | undefined;
}

export interface SaveInput {
  lang: string;
  text: string;
  /** Defaults to 'phrase' when the text contains spaces. */
  kind?: 'word' | 'phrase';
  status?: VocabStatus;
  translation?: string;
  notes?: string;
  context?: VocabContext;
}

/** Identity of a word or phrase in the vocabulary. */
export function vocabKey(text: string, rawLang: string, kindHint?: 'word' | 'phrase') {
  const lang = normalizeLang(rawLang);
  const words = tokenize(text, lang).filter((t) => t.word);
  const kind = kindHint ?? (words.length > 1 ? 'phrase' : 'word');
  // Phrase keys are built from word tokens only, matching how they are found in text.
  const key =
    kind === 'phrase'
      ? phraseKey(
          words.map((w) => w.text),
          lang,
        )
      : normalizeWord(text, lang);
  return { id: vocabId(lang, key), key, kind, lang };
}

export async function saveVocab(input: SaveInput): Promise<VocabItem> {
  const { id, key, kind, lang } = vocabKey(input.text, input.lang, input.kind);
  const existing = await getVocab(id);
  const now = Date.now();
  const item: VocabItem = {
    id,
    lang,
    key,
    text: existing?.text ?? input.text.trim(),
    kind: existing?.kind ?? kind,
    status: input.status ?? existing?.status ?? 'learning',
    translation: input.translation ?? existing?.translation,
    notes: input.notes ?? existing?.notes,
    context: input.context ?? existing?.context,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await browser.storage.local.set({ [PREFIX + id]: item });
  return item;
}

export async function updateVocab(id: string, patch: Partial<Omit<VocabItem, 'id' | 'key' | 'lang'>>): Promise<void> {
  const existing = await getVocab(id);
  if (!existing) return;
  await browser.storage.local.set({ [PREFIX + id]: { ...existing, ...patch, updatedAt: Date.now() } });
}

export async function removeVocab(id: string): Promise<void> {
  await browser.storage.local.remove(PREFIX + id);
}

export async function importVocab(items: VocabItem[]): Promise<number> {
  const entries: Record<string, VocabItem> = {};
  for (const item of items) {
    if (!item?.id || !item.key || !item.lang) continue;
    entries[PREFIX + item.id] = item;
  }
  await browser.storage.local.set(entries);
  return Object.keys(entries).length;
}

/** Subscribe to vocabulary changes from any tab or extension page. */
export function watchVocab(cb: (changed: { id: string; item?: VocabItem }[]) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local') return;
    const changed = Object.entries(changes)
      .filter(([k]) => k.startsWith(PREFIX))
      .map(([k, c]) => ({ id: k.slice(PREFIX.length), item: c.newValue as VocabItem | undefined }));
    if (changed.length) cb(changed);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

// ---------- export ----------

function csvCell(value: string | number | undefined): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(items: VocabItem[]): string {
  const header = [
    'text',
    'language',
    'status',
    'translation',
    'notes',
    'sentence',
    'sentence_translation',
    'source',
    'url',
    'time',
    'saved',
  ];
  const rows = items.map((i) => [
    i.text,
    i.lang,
    i.status,
    i.translation,
    i.notes,
    i.context?.sentence,
    i.context?.translation,
    i.context?.title,
    sourceUrl(i),
    i.context?.time !== undefined ? Math.round(i.context.time) : '',
    new Date(i.createdAt).toISOString(),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * Anki-importable TSV (File → Import, "Fields separated by: Tab", allow HTML).
 * Front: the word plus its sentence with the word in bold. Back: meaning and notes.
 */
export function toAnkiTsv(items: VocabItem[]): string {
  const lines = ['#separator:tab', '#html:true', '#columns:Front\tBack\tTags'];
  for (const i of items) {
    const sentence = i.context?.sentence ? escapeHtml(i.context.sentence) : '';
    const word = escapeHtml(i.text);
    const highlighted = sentence ? sentence.split(word).join(`<b>${word}</b>`) : '';
    const front = highlighted ? `${word}<br><br><i>${highlighted}</i>` : word;
    const backParts = [i.translation, i.context?.translation ? `<i>${escapeHtml(i.context.translation)}</i>` : '', i.notes]
      .filter(Boolean)
      .map((p) => String(p).replace(/\n/g, '<br>'));
    const source = sourceUrl(i);
    if (source) backParts.push(`<a href="${escapeHtml(source)}">${escapeHtml(i.context?.title ?? 'source')}</a>`);
    const tags = ['captionary', i.lang, i.status].join(' ');
    lines.push([front, backParts.join('<br><br>'), tags].map((f) => f.replace(/\t/g, ' ')).join('\t'));
  }
  return lines.join('\n');
}

/** Link back to the exact moment in the video when possible. */
export function sourceUrl(item: VocabItem): string {
  const ctx = item.context;
  if (!ctx?.url) return '';
  if (ctx.time === undefined) return ctx.url;
  try {
    const url = new URL(ctx.url);
    if (url.hostname.endsWith('youtube.com')) url.searchParams.set('t', `${Math.floor(ctx.time)}s`);
    else if (url.hostname.endsWith('netflix.com')) url.searchParams.set('t', String(Math.floor(ctx.time)));
    return url.toString();
  } catch {
    return ctx.url;
  }
}
