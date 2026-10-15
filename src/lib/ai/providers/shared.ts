/** Extra output budget for models whose hidden reasoning counts against max tokens. */
export const THINKING_HEADROOM = 2048;

export function withThinkingHeadroom(maxOutputTokens: number, reasoning: boolean): number {
  return reasoning ? maxOutputTokens + THINKING_HEADROOM : maxOutputTokens;
}

export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: { t: { type: 'array', items: { type: 'string' } } },
  required: ['t'],
  additionalProperties: false,
} as const;

/** HTTP failure from a provider called without an SDK; mirrors the SDKs' `status`. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof json.error === 'string') return json.error;
    return json.error?.message ?? json.message ?? (text || res.statusText);
  } catch {
    return text.slice(0, 300) || res.statusText;
  }
}

/**
 * fetch with a timeout, retry with exponential backoff + jitter on 408/409/429/5xx
 * (honouring Retry-After), and errors carrying the HTTP status. Same policy as the
 * official SDKs, for providers we call over plain HTTP.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { signal: AbortSignal; timeoutMs: number; maxRetries: number },
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(opts.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.any([opts.signal, timeout]) });
    } catch (err) {
      if (opts.signal.aborted) throw err;
      if (attempt >= opts.maxRetries) throw err;
      await sleep(backoff(attempt), opts.signal);
      continue;
    }
    if (res.ok) return res;
    const retryAfter = parseRetryAfter(res);
    if (RETRYABLE.has(res.status) && attempt < opts.maxRetries) {
      await res.body?.cancel().catch(() => undefined);
      await sleep(Math.min(retryAfter ?? backoff(attempt), 20_000), opts.signal);
      continue;
    }
    throw new HttpError(res.status, await errorMessage(res), retryAfter);
  }
}

function backoff(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000) * (0.75 + Math.random() * 0.5);
}

export interface SSEMessage {
  event?: string;
  data: string;
}

/** Minimal Server-Sent Events parser over a fetch body. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
  let buffer = '';
  let event: string | undefined;
  let data: string[] = [];
  const readField = (line: string) => {
    if (line.startsWith(':')) return; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const val = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') data.push(val);
    else if (field === 'event') event = val;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + (buffer[nl] === '\r' ? 2 : 1));
        if (line === '') {
          if (data.length) yield { event, data: data.join('\n') };
          event = undefined;
          data = [];
        } else {
          readField(line);
        }
      }
    }
    // A last line without a trailing newline still counts.
    if (buffer) readField(buffer);
    if (data.length) yield { event, data: data.join('\n') };
  } finally {
    reader.releaseLock();
  }
}
