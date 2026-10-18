import { browser, storage } from '#imports';
import { getCurrentUILocale, getMessages } from '../i18n';
import { AIError, type AIErrorCode } from './types';

/**
 * "Sign in with ChatGPT": OAuth 2.0 + PKCE against auth.openai.com, using the public
 * client that OpenAI's Codex CLI ships (opencode, Cline and Kilo use it the same way).
 * The access token then calls the Codex backend (chatgpt.com/backend-api/codex) on the
 * user's ChatGPT plan.
 *
 * That client only allows a loopback redirect. An extension cannot listen on a port, so
 * the sign-in tab is watched instead: when it navigates to the redirect URL (which fails
 * to load, as nothing listens there), the code is read from the tab's address and the tab
 * is closed.
 *
 * Tokens follow the same rules as API keys (see secrets.ts): storage.local only, under
 * their own key, never synced or exported.
 */

const ISSUER = 'https://auth.openai.com';
export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SCOPE = 'openid profile email offline_access';
/** Identifies this client to OpenAI, as Codex sends `codex_cli_rs`. */
export const ORIGINATOR = 'captionary';
/** Refresh this long before the access token expires (Codex uses the same window). */
const REFRESH_WINDOW_MS = 5 * 60_000;
const SIGN_IN_TIMEOUT_MS = 10 * 60_000;
/** A token request that takes longer has stalled; every request on the connection waits for it. */
const TOKEN_TIMEOUT_MS = 30_000;
const AUTH_CLAIM = 'https://api.openai.com/auth';
const PROFILE_CLAIM = 'https://api.openai.com/profile';

/** Host access the sign-in needs: the token endpoint, the API, and reading the redirect tab. */
export const SIGN_IN_ORIGINS = [`${ISSUER}/*`, 'https://chatgpt.com/*', 'http://localhost/*'];

export interface ChatGPTTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  accountId: string;
  email?: string;
  plan?: string;
  fedramp?: boolean;
}

/** What settings pages may show about the signed-in account (no tokens). */
export interface ChatGPTAccount {
  email?: string;
  plan?: string;
}

export const tokensItem = (connectionId: string) =>
  storage.defineItem<ChatGPTTokens | null>(`local:aiOAuth:${connectionId}`, { fallback: null });

export async function getChatGPTAccount(connectionId: string): Promise<ChatGPTAccount | null> {
  const t = await tokensItem(connectionId).getValue();
  return t ? { email: t.email, plan: t.plan } : null;
}

export async function signOutChatGPT(connectionId: string): Promise<void> {
  await tokensItem(connectionId).removeValue();
}

// ---------------------------------------------------------------------------------------
// Pure helpers

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(size: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function authorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    originator: ORIGINATOR,
  });
  return `${ISSUER}/oauth/authorize?${params}`;
}

export function isCallbackUrl(url: string | undefined): url is string {
  return !!url && url.startsWith(`${REDIRECT_URI}?`);
}

/** Read the authorization code from the redirect, checking it answers our request. */
export function parseCallback(url: string, expectedState: string): string {
  const m = getMessages(getCurrentUILocale()).runtime.ai;
  const params = new URL(url).searchParams;
  const error = params.get('error');
  if (error) throw new AIError('auth', m.chatgptSignInFailed(params.get('error_description') || error));
  // ChatGPT may append a suffix to the state it echoes back; Codex accepts the prefix too.
  if (!params.get('state')?.startsWith(expectedState)) throw new AIError('auth', m.chatgptStateMismatch);
  const code = params.get('code');
  if (!code) throw new AIError('auth', m.chatgptNoAuthCode);
  return code;
}

export function decodeJwt(token: string | undefined): Record<string, unknown> {
  const payload = token?.split('.')[1];
  if (!payload) return {};
  try {
    const bin = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

/** Build stored tokens from a token response; `previous` fills fields a refresh omits. */
export function toTokens(res: TokenResponse, previous?: ChatGPTTokens, now = Date.now()): ChatGPTTokens {
  const m = getMessages(getCurrentUILocale()).runtime.ai;
  if (!res.access_token) throw new AIError('auth', m.chatgptNoAccessToken);
  const id = decodeJwt(res.id_token);
  const access = decodeJwt(res.access_token);
  const auth = (id[AUTH_CLAIM] ?? access[AUTH_CLAIM] ?? {}) as Record<string, unknown>;
  const orgs = id.organizations as { id?: string }[] | undefined;
  const accountId = String(auth.chatgpt_account_id ?? orgs?.[0]?.id ?? previous?.accountId ?? '');
  if (!accountId) throw new AIError('auth', m.chatgptNoWorkspace);
  const exp = typeof access.exp === 'number' ? access.exp * 1000 : undefined;
  const profile = (id[PROFILE_CLAIM] ?? {}) as { email?: string };
  return {
    accessToken: res.access_token,
    // Refresh tokens rotate, but a response without one keeps the old one valid.
    refreshToken: res.refresh_token ?? previous?.refreshToken ?? '',
    expiresAt: res.expires_in ? now + res.expires_in * 1000 : (exp ?? now + 3600_000),
    accountId,
    email: (id.email as string | undefined) ?? profile.email ?? previous?.email,
    plan: (auth.chatgpt_plan_type as string | undefined) ?? previous?.plan,
    fedramp: auth.chatgpt_account_is_fedramp === true || undefined,
  };
}

// ---------------------------------------------------------------------------------------
// Token endpoint

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const m = getMessages(getCurrentUILocale()).runtime.ai;
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${ISSUER}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      credentials: 'omit',
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    text = await res.text();
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') throw new AIError('timeout', m.chatgptServiceTimeout);
    throw new AIError('network', m.chatgptServiceUnreachable);
  }
  if (!res.ok) {
    let reason = text.slice(0, 200);
    try {
      const json = JSON.parse(text) as { error?: string | { code?: string; message?: string }; error_description?: string };
      reason =
        typeof json.error === 'string' ? (json.error_description ?? json.error) : (json.error?.message ?? json.error?.code ?? reason);
    } catch {
      /* not JSON */
    }
    // A busy or failing server says nothing about the sign-in: keep it, and let a fallback provider answer.
    const code: AIErrorCode = res.status === 429 ? 'rate_limit' : res.status >= 500 ? 'unavailable' : 'auth';
    throw new AIError(code, m.chatgptSignInStatusFailed(res.status, reason), res.status);
  }
  return JSON.parse(text) as TokenResponse;
}

/** Credential lookups in flight, one per connection. */
const refreshing = new Map<string, Promise<ChatGPTTokens>>();

/**
 * The stored tokens when they are no longer the ones being refreshed: the user signed out
 * (null) or signed in again while the request was out. Undefined when they are unchanged.
 */
async function replacedTokens(connectionId: string, current: ChatGPTTokens): Promise<ChatGPTTokens | null | undefined> {
  const stored = await tokensItem(connectionId).getValue();
  return stored?.refreshToken === current.refreshToken ? undefined : stored;
}

function orSignIn(tokens: ChatGPTTokens | null): ChatGPTTokens {
  if (!tokens) throw new AIError('missing_key', getMessages(getCurrentUILocale()).runtime.ai.chatgptSignInFirst);
  return tokens;
}

async function refresh(connectionId: string, current: ChatGPTTokens): Promise<ChatGPTTokens> {
  try {
    const res = await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: current.refreshToken });
    const next = toTokens(res, current);
    // Writing now would bring back a sign-out, or overwrite a newer sign-in.
    const replaced = await replacedTokens(connectionId, current);
    if (replaced !== undefined) return orSignIn(replaced);
    await tokensItem(connectionId).setValue(next);
    return next;
  } catch (err) {
    const status = (err as AIError).status;
    // 400/401 mean the refresh token is spent (expired, revoked or reused): sign in again.
    if (status === 400 || status === 401) {
      const replaced = await replacedTokens(connectionId, current);
      if (replaced !== undefined) return orSignIn(replaced);
      await signOutChatGPT(connectionId);
      throw new AIError('auth', getMessages(getCurrentUILocale()).runtime.ai.chatgptSessionExpired, 401);
    }
    throw err;
  }
}

/**
 * A usable access token, refreshed when it is about to expire (or `force`d after a 401).
 * Refresh tokens are single-use, so concurrent callers share one refresh. Only the
 * background worker calls this, which keeps that guarantee across the extension.
 */
export function chatGPTCredentials(connectionId: string, force = false): Promise<ChatGPTTokens> {
  const pending = refreshing.get(connectionId);
  if (pending) return pending;
  // Registered before the first await, so a second caller cannot read the same
  // about-to-expire token and spend the refresh token a second time.
  const job = (async () => {
    const tokens = await tokensItem(connectionId).getValue();
    if (!tokens) throw new AIError('missing_key', getMessages(getCurrentUILocale()).runtime.ai.chatgptSignInFirst);
    if (!force && tokens.expiresAt - Date.now() > REFRESH_WINDOW_MS) return tokens;
    return refresh(connectionId, tokens);
  })().finally(() => refreshing.delete(connectionId));
  refreshing.set(connectionId, job);
  return job;
}

// ---------------------------------------------------------------------------------------
// Interactive sign-in (runs in the options page, which stays open while the user signs in)

/** Watch a tab until it reaches the redirect URL; rejects if the tab is closed first. */
function waitForCallback(tabId: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const m = getMessages(getCurrentUILocale()).runtime.ai;
    const done = (fn: () => void) => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      fn();
    };
    const onUpdated = (id: number, change: { url?: string }, tab: { url?: string; pendingUrl?: string }) => {
      if (id !== tabId) return;
      const url = [change.url, tab.url, tab.pendingUrl].find(isCallbackUrl);
      if (url) done(() => resolve(url));
    };
    const onRemoved = (id: number) => {
      if (id === tabId) done(() => reject(new AIError('aborted', m.chatgptSignInCancelled)));
    };
    const onAbort = () => done(() => reject(new AIError('aborted', m.chatgptSignInCancelled)));
    const timer = setTimeout(() => done(() => reject(new AIError('timeout', m.chatgptSignInTimedOut))), SIGN_IN_TIMEOUT_MS);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Open the ChatGPT sign-in in a new tab and store the resulting tokens. The caller must
 * already hold SIGN_IN_ORIGINS (request them inside the click, before calling this).
 */
export async function signInWithChatGPT(connectionId: string, signal?: AbortSignal): Promise<ChatGPTAccount> {
  const { verifier, challenge } = await pkcePair();
  const state = randomToken(32);
  const self = await browser.tabs.getCurrent();
  const tab = await browser.tabs.create({ url: authorizeUrl(challenge, state), openerTabId: self?.id });
  if (tab.id === undefined) throw new AIError('unknown', getMessages(getCurrentUILocale()).runtime.ai.chatgptOpenTabFailed);
  let callback: string;
  try {
    callback = await waitForCallback(tab.id, signal);
  } finally {
    await browser.tabs.remove(tab.id).catch(() => undefined);
    if (self?.id !== undefined) await browser.tabs.update(self.id, { active: true }).catch(() => undefined);
  }
  const code = parseCallback(callback, state);
  const res = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const tokens = toTokens(res);
  await tokensItem(connectionId).setValue(tokens);
  return { email: tokens.email, plan: tokens.plan };
}
