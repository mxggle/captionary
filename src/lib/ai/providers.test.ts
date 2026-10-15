import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveModel, toAIError } from './gateway';
import { fetchWithRetry, HttpError, parseSSE, withThinkingHeadroom } from './providers/shared';
import { isChatModel, newConnection, originPattern, validateBaseUrl } from './registry';
import { maskKey } from './secrets';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe('parseSSE', () => {
  it('handles events split across chunks, comments and CRLF', async () => {
    const out = [];
    for await (const m of parseSSE(streamOf([': keep-alive\n\nda', 'ta: {"a":1}\r\n\r\nevent: x\ndata: l1\ndata: l2\n\n', 'data: tail'])))
      out.push(m);
    expect(out).toEqual([
      { event: undefined, data: '{"a":1}' },
      { event: 'x', data: 'l1\nl2' },
      { event: undefined, data: 'tail' },
    ]);
  });
});

describe('fetchWithRetry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries 429 using Retry-After, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchWithRetry('https://x.test', {}, { signal: new AbortController().signal, timeoutMs: 1000, maxRetries: 2 });
    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors and reports the provider message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 })));
    const err = await fetchWithRetry('https://x.test', {}, { signal: new AbortController().signal, timeoutMs: 1000, maxRetries: 3 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('bad model');
  });
});

describe('toAIError', () => {
  it('maps HTTP statuses to actionable codes', () => {
    expect(toAIError({ status: 401, message: 'x' }).code).toBe('auth');
    expect(toAIError({ status: 429, message: 'You exceeded your current quota' }).code).toBe('quota');
    expect(toAIError({ status: 429, message: 'Too many requests' }).code).toBe('rate_limit');
    expect(toAIError({ status: 503, message: 'x' }).code).toBe('unavailable');
    expect(toAIError({ name: 'AbortError', message: 'aborted' }).code).toBe('aborted');
    expect(toAIError(new TypeError('Failed to fetch')).code).toBe('network');
  });
  it('explains Ollama origin errors', () => {
    expect(toAIError({ status: 403, message: 'forbidden' }, newConnection('ollama')).message).toContain('OLLAMA_ORIGINS');
  });
});

describe('registry', () => {
  it('requires https except for loopback', () => {
    expect(validateBaseUrl('https://api.example.com/v1')).toBeNull();
    expect(validateBaseUrl('http://localhost:11434/v1')).toBeNull();
    expect(validateBaseUrl('http://example.com/v1')).not.toBeNull();
    expect(validateBaseUrl('https://user:pw@example.com')).not.toBeNull();
    expect(validateBaseUrl('nope')).not.toBeNull();
  });
  it('derives a minimal host permission', () => {
    expect(originPattern({ kind: 'openai', baseUrl: 'https://api.openai.com/v1' })).toBe('https://api.openai.com/*');
    expect(originPattern({ kind: 'ollama', baseUrl: 'http://localhost:11434/v1' })).toBe('http://localhost/*');
    expect(originPattern({ kind: 'chrome-builtin', baseUrl: '' })).toBeNull();
  });
  it('filters non-chat models', () => {
    expect(['gpt-5-mini', 'text-embedding-3-small', 'whisper-1', 'tts-1', 'gpt-image-1'].filter(isChatModel)).toEqual(['gpt-5-mini']);
  });
  it('resolves route vs connection default models', () => {
    const conn = { ...newConnection('anthropic'), defaultModel: 'claude-haiku-5-5' };
    expect(resolveModel(conn, { model: '', connectionId: null })).toBe('claude-haiku-5-5');
    expect(resolveModel(conn, { model: 'claude-opus-5-5', connectionId: null })).toBe('claude-opus-5-5');
    expect(resolveModel(conn, { model: 'claude-opus-5-5', connectionId: null }, false)).toBe('claude-haiku-5-5');
  });
  it('adds thinking headroom only for reasoning models', () => {
    expect(withThinkingHeadroom(500, false)).toBe(500);
    expect(withThinkingHeadroom(500, true)).toBeGreaterThan(500);
  });
  it('masks keys', () => {
    expect(maskKey('sk-ant-api03-abcdefghijklmnop')).toBe('sk-a…mnop');
    expect(maskKey('short')).toBe('•••••');
  });
});
