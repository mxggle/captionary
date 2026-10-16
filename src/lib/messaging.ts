import { browser } from '#imports';
import type { AIErrorInfo, AIJob, AIResult, AIStreamEvent, ProviderKind } from './ai/types';
import { AIError } from './ai/types';
import type { DictionaryResult } from './dictionary';

export interface AIStatus {
  enabled: boolean;
  configured: boolean;
  autoExplain: boolean;
  provider?: ProviderKind;
  providerName?: string;
  model?: string;
}

export interface SidePanelPayload {
  kind: 'word' | 'sentence';
  text: string;
  sentence?: string;
  lang?: string;
  url?: string;
  title?: string;
}

/** Requests handled by the background service worker. */
export type BgRequest =
  | { type: 'ai.run'; job: AIJob }
  | { type: 'ai.status' }
  | { type: 'ai.listModels'; connectionId: string }
  | { type: 'ai.test'; connectionId: string; model?: string }
  | { type: 'dict.lookup'; word: string; lang: string }
  | { type: 'text.romanize'; lang: string; lines: string[] }
  | { type: 'freq.list'; lang: string }
  | { type: 'fetch.text'; url: string }
  | { type: 'open.page'; page: 'options' | 'vocab' | 'reader'; hash?: string }
  | { type: 'sidepanel.open'; payload: SidePanelPayload }
  | { type: 'reader.import'; doc: ReaderDocument }
  | { type: 'reader.openTab'; tabId: number };

/** Text handed to the reader page (a transcript, or a page's article). */
export interface ReaderDocument {
  title: string;
  url: string;
  text: string;
  lang: string;
}

export type BgResponse<T> = { ok: true; data: T } | { ok: false; error: AIErrorInfo };

export interface BgResponseMap {
  'ai.run': AIResult;
  'ai.status': AIStatus;
  'ai.listModels': string[];
  'ai.test': import('./ai/gateway').TestResult;
  'dict.lookup': DictionaryResult;
  'text.romanize': string[];
  'freq.list': string[] | null;
  'fetch.text': string;
  'open.page': void;
  'sidepanel.open': void;
  'reader.import': void;
  'reader.openTab': void;
}

/** Send a request to the background and unwrap the response envelope. */
export async function bg<K extends BgRequest['type']>(msg: Extract<BgRequest, { type: K }>): Promise<BgResponseMap[K]> {
  const res = (await browser.runtime.sendMessage(msg)) as BgResponse<BgResponseMap[K]> | undefined;
  if (!res) throw new AIError('unknown', 'No response from the extension background.');
  if (!res.ok) throw new AIError(res.error.code, res.error.message, res.error.status);
  return res.data;
}

export const AI_PORT = 'ai-stream';

export interface StreamHandlers {
  onMeta?: (meta: { model: string; provider: ProviderKind; cached: boolean }) => void;
  onDelta?: (text: string) => void;
  onDone?: (result: AIResult) => void;
  onError?: (error: AIErrorInfo) => void;
}

/**
 * Stream an AI job through the background. Returns a cancel function; cancelling
 * (or the page unloading) disconnects the port, which aborts the provider request.
 */
export function streamJob(job: AIJob, handlers: StreamHandlers): () => void {
  let port: ReturnType<typeof browser.runtime.connect>;
  try {
    port = browser.runtime.connect({ name: AI_PORT });
  } catch (err) {
    handlers.onError?.({ code: 'unknown', message: (err as Error).message || 'Extension was reloaded; refresh the page.' });
    return () => undefined;
  }
  let finished = false;
  port.onMessage.addListener((raw: unknown) => {
    const event = raw as AIStreamEvent;
    if (event.type === 'meta') handlers.onMeta?.(event);
    else if (event.type === 'delta') handlers.onDelta?.(event.text);
    else if (event.type === 'done') {
      finished = true;
      handlers.onDone?.(event.result);
      port.disconnect();
    } else if (event.type === 'error') {
      finished = true;
      handlers.onError?.(event.error);
      port.disconnect();
    }
  });
  port.onDisconnect.addListener(() => {
    if (!finished) {
      finished = true;
      handlers.onError?.({ code: 'aborted', message: 'Connection to the extension was lost. Refresh the page.' });
    }
  });
  port.postMessage({ type: 'run', job });
  return () => {
    if (!finished) {
      finished = true;
      port.disconnect();
    }
  };
}

/** Promise wrapper around streamJob for callers that only want the final text. */
export function runJob(job: AIJob, onDelta?: (text: string) => void, signal?: AbortSignal): Promise<AIResult> {
  return new Promise((resolve, reject) => {
    const cancel = streamJob(job, {
      onDelta,
      onDone: resolve,
      onError: (e) => reject(new AIError(e.code, e.message, e.status)),
    });
    signal?.addEventListener('abort', () => {
      cancel();
      reject(new AIError('aborted', 'Cancelled'));
    });
  });
}
