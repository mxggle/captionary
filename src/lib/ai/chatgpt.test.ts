import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  authorizeUrl,
  chatGPTCredentials,
  CLIENT_ID,
  decodeJwt,
  isCallbackUrl,
  parseCallback,
  pkcePair,
  REDIRECT_URI,
  toTokens,
  tokensItem,
  type ChatGPTTokens,
} from './chatgpt-auth';
import { testConnection, toAIError } from './gateway';
import { chatgptAdapter } from './providers/chatgpt';
import { newConnection, providerOrigins } from './registry';
import type { ProviderRequest } from './types';

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: object) => `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(payload))}.sig`;

const ID_TOKEN = jwt({
  email: 'learner@example.com',
  'https://api.openai.com/auth': { chatgpt_account_id: 'acct_123', chatgpt_plan_type: 'plus' },
});

function sse(events: object[]): Response {
  const body = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const request = (over: Partial<ProviderRequest> = {}): ProviderRequest => ({
  model: 'gpt-5.5',
  system: 'Explain words.',
  messages: [
    { role: 'user', content: 'What is 猫?' },
    { role: 'assistant', content: 'Cat.' },
  ],
  temperature: 0.2,
  maxOutputTokens: 900,
  effort: 'low',
  signal: new AbortController().signal,
  timeoutMs: 5000,
  maxRetries: 0,
  ...over,
});

describe('ChatGPT sign-in helpers', () => {
  it('makes an S256 PKCE pair', async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{86}$/);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    expect(challenge).toBe(b64url(String.fromCharCode(...digest)));
  });

  it('builds the Codex authorize URL', () => {
    const url = new URL(authorizeUrl('chal', 'st'));
    expect(url.origin + url.pathname).toBe('https://auth.openai.com/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_challenge: 'chal',
      code_challenge_method: 'S256',
      state: 'st',
      scope: 'openid profile email offline_access',
      codex_cli_simplified_flow: 'true',
    });
  });

  it('reads the code from the redirect and checks the state', () => {
    const ok = `${REDIRECT_URI}?code=abc&state=st123`;
    expect(isCallbackUrl(ok)).toBe(true);
    expect(isCallbackUrl('https://auth.openai.com/log-in')).toBe(false);
    expect(parseCallback(ok, 'st123')).toBe('abc');
    expect(parseCallback(`${REDIRECT_URI}?code=abc&state=st123-suffix`, 'st123')).toBe('abc');
    expect(() => parseCallback(`${REDIRECT_URI}?code=abc&state=other`, 'st123')).toThrow(/did not match/);
    expect(() => parseCallback(`${REDIRECT_URI}?error=access_denied&state=st123`, 'st123')).toThrow(/access_denied/);
  });

  it('extracts the account, plan and expiry from the tokens', () => {
    const t = toTokens({ access_token: jwt({ exp: 2000 }), refresh_token: 'r1', id_token: ID_TOKEN }, undefined, 0);
    expect(t).toMatchObject({
      accountId: 'acct_123',
      email: 'learner@example.com',
      plan: 'plus',
      refreshToken: 'r1',
      expiresAt: 2_000_000,
    });
    expect(toTokens({ access_token: 'x', expires_in: 60 }, t, 1000)).toMatchObject({
      accountId: 'acct_123',
      refreshToken: 'r1',
      expiresAt: 61_000,
    });
    expect(() => toTokens({ access_token: 'x' })).toThrow(/workspace/);
    expect(decodeJwt('not-a-jwt')).toEqual({});
  });

  it('asks for the API and token hosts', () => {
    expect(providerOrigins(newConnection('chatgpt'))).toEqual(['https://chatgpt.com/*', 'https://auth.openai.com/*']);
  });
});

describe('chatGPTCredentials', () => {
  const stored: ChatGPTTokens = { accessToken: 'old', refreshToken: 'r1', expiresAt: 0, accountId: 'acct_123' };
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.unstubAllGlobals());

  it('returns a valid token without refreshing', async () => {
    await tokensItem('c1').setValue({ ...stored, expiresAt: Date.now() + 3600_000 });
    vi.stubGlobal('fetch', vi.fn());
    expect((await chatGPTCredentials('c1')).accessToken).toBe('old');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes an expiring token once for concurrent callers and stores the rotated one', async () => {
    await tokensItem('c1').setValue(stored);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 })));
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([chatGPTCredentials('c1'), chatGPTCredentials('c1')]);
    expect(a.accessToken).toBe('new');
    expect(b.accessToken).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as URLSearchParams);
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: 'r1' });
    expect((await tokensItem('c1').getValue())?.refreshToken).toBe('r2');
  });

  it('signs out when the refresh token is no longer valid', async () => {
    await tokensItem('c1').setValue(stored);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));
    await expect(chatGPTCredentials('c1')).rejects.toMatchObject({ code: 'auth' });
    expect(await tokensItem('c1').getValue()).toBeNull();
  });

  it('keeps the sign-in when OpenAI is unavailable', async () => {
    await tokensItem('c1').setValue(stored);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream error', { status: 503 })));
    await expect(chatGPTCredentials('c1')).rejects.toMatchObject({ code: 'unavailable', status: 503 });
    expect(await tokensItem('c1').getValue()).toEqual(stored);
  });

  it('does not bring back a sign-in removed while it was being refreshed', async () => {
    await tokensItem('c1').setValue(stored);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        await tokensItem('c1').removeValue();
        return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 }));
      }),
    );
    await expect(chatGPTCredentials('c1')).rejects.toMatchObject({ code: 'missing_key' });
    expect(await tokensItem('c1').getValue()).toBeNull();
  });

  it('keeps a newer sign-in when the old refresh token turns out spent', async () => {
    await tokensItem('c1').setValue(stored);
    const newer = { ...stored, accessToken: 'fresh', refreshToken: 'r9', expiresAt: Date.now() + 3600_000 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        await tokensItem('c1').setValue(newer);
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      }),
    );
    expect(await chatGPTCredentials('c1')).toEqual(newer);
    expect(await tokensItem('c1').getValue()).toEqual(newer);
  });

  it('asks to sign in when there are no tokens', async () => {
    await expect(chatGPTCredentials('none')).rejects.toMatchObject({ code: 'missing_key' });
  });
});

describe('chatgptAdapter', () => {
  const ctx = { connection: newConnection('chatgpt'), apiKey: 'tok', accountId: 'acct_123' };
  afterEach(() => vi.unstubAllGlobals());

  it('sends a stateless Responses request and streams text and usage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sse([
          { type: 'response.created' },
          { type: 'response.output_text.delta', delta: 'Hel' },
          { type: 'response.output_text.delta', delta: 'lo' },
          { type: 'response.completed', response: { usage: { input_tokens: 12, output_tokens: 3 } } },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const chunks = [];
    for await (const c of chatgptAdapter.stream(ctx, request())) chunks.push(c);
    expect(chunks).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
      { type: 'usage', usage: { inputTokens: 12, outputTokens: 3 } },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(init.headers).toMatchObject({ authorization: 'Bearer tok', 'chatgpt-account-id': 'acct_123', originator: 'captionary' });
    expect(init.credentials).toBe('omit');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gpt-5.5',
      instructions: 'Explain words.',
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
    });
    expect(body.input[1]).toEqual({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Cat.' }] });
    // The backend rejects an output limit; temperature is not offered either.
    expect(body).not.toHaveProperty('max_output_tokens');
    expect(body).not.toHaveProperty('temperature');
  });

  it('explains a plan usage limit', async () => {
    const limit = { error: { type: 'usage_limit_reached', plan_type: 'plus', resets_at: 1_900_000_000 } };
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(limit), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const err = await (async () => {
      for await (const _ of chatgptAdapter.stream(ctx, request({ maxRetries: 2 }))) void _;
    })().catch((e) => e);
    expect(err).toMatchObject({ code: 'quota', status: 429 });
    expect(err.message).toMatch(/usage limit/);
    // Waiting won't lift a plan limit, so it is not retried.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the token only to chatgpt.com, whatever the connection says', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sse([{ type: 'response.completed' }]));
    vi.stubGlobal('fetch', fetchMock);
    const moved = { ...ctx, connection: { ...ctx.connection, baseUrl: 'https://attacker.example/v1' } };
    for await (const _ of chatgptAdapter.stream(moved, request())) void _;
    expect(fetchMock.mock.calls[0][0]).toBe('https://chatgpt.com/backend-api/codex/responses');
  });

  it('reports a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sse([{ type: 'response.failed', response: { error: { message: 'context too long' } } }])),
    );
    const err = await (async () => {
      for await (const _ of chatgptAdapter.stream(ctx, request())) void _;
    })().catch((e) => e);
    expect(err.message).toBe('context too long');
  });

  it('lists visible models in priority order', async () => {
    const models = {
      models: [
        { slug: 'b', priority: 2 },
        { slug: 'hidden', visibility: 'hide' },
        { slug: 'a', priority: 1, visibility: 'list' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(models)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await chatgptAdapter.listModels(ctx, new AbortController().signal)).toEqual(['a', 'b']);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/chatgpt\.com\/backend-api\/codex\/models\?client_version=/);
  });

  it('asks to sign in again on 401', () => {
    expect(toAIError({ status: 401, message: 'x' }, newConnection('chatgpt')).message).toMatch(/Sign in again/);
  });
});

describe('testConnection for ChatGPT', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    Object.assign(fakeBrowser, { permissions: { contains: vi.fn().mockResolvedValue(true) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks for an answer, so a plan without Codex fails even though models list', async () => {
    const conn = newConnection('chatgpt');
    await tokensItem(conn.id).setValue({ accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, accountId: 'acct_123' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ slug: 'gpt-5.5' }] })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'usage_not_included' } }), { status: 403 })),
    );
    const r = await testConnection(conn);
    expect(r).toMatchObject({ ok: false, code: 'quota' });
    expect(r.error).toMatch(/does not include Codex/);
  });
});
