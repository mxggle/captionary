import { parseTranslations } from './ai/prompts';
import { getCurrentUILocale, getMessages } from './i18n';
import { baseLang } from './languages';
import { runJob } from './messaging';
import { guessLanguage } from './text/detect';

// ---------- Chrome built-in Translator API (on-device) ----------

interface ChromeTranslator {
  translate(text: string): Promise<string>;
  destroy?(): void;
}
interface TranslatorStatic {
  availability(opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<ChromeTranslator>;
}

function translatorApi(): TranslatorStatic | undefined {
  return (globalThis as unknown as { Translator?: TranslatorStatic }).Translator;
}

export type ChromeTranslatorState = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

export async function chromeTranslatorState(src: string, tgt: string): Promise<ChromeTranslatorState> {
  const api = translatorApi();
  if (!api) return 'unsupported';
  try {
    return await api.availability({ sourceLanguage: baseLang(src), targetLanguage: baseLang(tgt) });
  } catch {
    return 'unavailable';
  }
}

const translators = new Map<string, Promise<ChromeTranslator>>();

/**
 * Get (or create) an on-device translator. Creating one may download a language pack,
 * which Chrome only allows after a user gesture; callers should invoke this from a
 * click handler the first time.
 */
export function getChromeTranslator(src: string, tgt: string): Promise<ChromeTranslator> {
  const api = translatorApi();
  if (!api) return Promise.reject(new Error(getMessages(getCurrentUILocale()).runtime.translate.translatorNotSupported));
  const key = `${baseLang(src)}>${baseLang(tgt)}`;
  let t = translators.get(key);
  if (!t) {
    // create() waits for a language-pack download, which never starts without a user
    // gesture; give up instead of leaving translations pending forever.
    t = Promise.race([
      api.create({ sourceLanguage: baseLang(src), targetLanguage: baseLang(tgt) }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(getMessages(getCurrentUILocale()).runtime.translate.onDeviceNotReady)), 20_000),
      ),
    ]);
    translators.set(key, t);
    t.catch(() => translators.delete(key));
  }
  return t;
}

export async function translateWithChrome(text: string, src: string, tgt: string): Promise<string> {
  const t = await getChromeTranslator(src, tgt);
  return t.translate(text);
}

// ---------- batch translation of subtitle lines ----------

export interface BatchOptions {
  sourceLang: string;
  targetLang: string;
  engine: 'chrome' | 'ai';
  /** Translate around this line first so the current scene is ready quickly. */
  startIndex?: number;
  batchSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onBatch: (start: number, translations: string[]) => void;
}

function batchOrder(total: number, size: number, startIndex: number): number[] {
  const starts: number[] = [];
  for (let s = 0; s < total; s += size) starts.push(s);
  const first = Math.max(0, Math.floor(startIndex / size) * size);
  return [...starts.filter((s) => s >= first), ...starts.filter((s) => s < first)];
}

async function translateAiBatch(lines: string[], opts: BatchOptions): Promise<string[]> {
  const result = await runJob(
    { task: 'translate', lines, sourceLang: opts.sourceLang, targetLang: opts.targetLang },
    undefined,
    opts.signal,
  );
  const parsed = parseTranslations(result.text, lines.length);
  if (parsed) return parsed;
  if (lines.length > 4) {
    // The model lost count; halve the batch and try again.
    const mid = Math.ceil(lines.length / 2);
    return [...(await translateAiBatch(lines.slice(0, mid), opts)), ...(await translateAiBatch(lines.slice(mid), opts))];
  }
  throw new Error(getMessages(getCurrentUILocale()).runtime.translate.malformedTranslations);
}

/** Translate many lines in batches, reporting each finished batch. */
export async function translateLines(lines: string[], opts: BatchOptions): Promise<void> {
  const size = opts.batchSize ?? (opts.engine === 'ai' ? 40 : 1);
  const order = batchOrder(lines.length, size, opts.startIndex ?? 0);
  const concurrency = opts.concurrency ?? (opts.engine === 'ai' ? 2 : 4);
  let next = 0;
  let firstError: unknown = null;
  const worker = async () => {
    while (next < order.length && !opts.signal?.aborted) {
      const start = order[next++];
      const batch = lines.slice(start, start + size);
      try {
        const out =
          opts.engine === 'ai'
            ? await translateAiBatch(batch, opts)
            : await Promise.all(batch.map((l) => translateWithChrome(l, opts.sourceLang, opts.targetLang)));
        if (!opts.signal?.aborted) opts.onBatch(start, out);
      } catch (err) {
        firstError ??= err;
        // Stop on errors that will not go away by themselves (no key, limit reached…).
        const code = (err as { code?: string }).code;
        if (code && code !== 'rate_limit' && code !== 'timeout' && code !== 'network') {
          next = order.length;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (firstError && !opts.signal?.aborted) throw firstError;
}

// ---------- language detection ----------

interface LanguageDetectorStatic {
  create(): Promise<{ detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }>;
}

/**
 * Detect the language of a text with Chrome's on-device detector, falling back to a
 * small offline heuristic; null if unsure.
 */
export async function detectLanguage(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  const api = (globalThis as unknown as { LanguageDetector?: LanguageDetectorStatic }).LanguageDetector;
  if (api) {
    try {
      const detector = await api.create();
      const [best] = await detector.detect(text.slice(0, 2000));
      if (best && best.confidence > 0.5 && best.detectedLanguage !== 'und') return best.detectedLanguage;
    } catch {
      // fall through to the heuristic
    }
  }
  return guessLanguage(text);
}
