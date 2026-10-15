import { browser } from '#imports';
import { getAISettings, getSettings } from '../settings';
import { cacheKey, getCached, putCached } from './cache';
import { buildPrompt, parseTranslations } from './prompts';
import { anthropicAdapter } from './providers/anthropic';
import { chromeAdapter } from './providers/chrome';
import { geminiAdapter } from './providers/gemini';
import { openaiAdapter } from './providers/openai';
import { originPattern, PROVIDERS } from './registry';
import { getApiKey } from './secrets';
import {
  AIError,
  type AIJob,
  type AIResult,
  type AISettings,
  type AIUsage,
  type ProviderAdapter,
  type ProviderConnection,
  type ProviderProtocol,
  type ProviderRequest,
  type TaskRoute,
} from './types';
import { assertWithinLimit, recordRequest } from './usage';

const ADAPTERS: Record<ProviderProtocol, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  chrome: chromeAdapter,
};

/** Bump when prompt construction changes so stale cached answers are not reused. */
const CACHE_VERSION = 1;

export interface RunOptions {
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onMeta?: (meta: { model: string; provider: ProviderConnection['kind'] }) => void;
}

export function resolveConnection(ai: AISettings, id: string | null): ProviderConnection | null {
  const wanted = id ?? ai.defaultConnectionId;
  return ai.connections.find((c) => c.id === wanted) ?? ai.connections[0] ?? null;
}

export function resolveModel(conn: ProviderConnection, route: Pick<TaskRoute, 'model' | 'connectionId'>, useRouteModel = true): string {
  // A route-specific model only applies to the connection it was chosen for.
  if (useRouteModel && route.model) return route.model;
  return conn.defaultModel || PROVIDERS[conn.kind].defaultModel;
}

/** Map SDK / fetch errors to user-facing error codes. */
export function toAIError(err: unknown, conn?: ProviderConnection): AIError {
  if (err instanceof AIError) return err;
  const e = err as { name?: string; status?: number; message?: string; code?: string };
  const name = e?.name ?? '';
  const message = String(e?.message ?? err ?? 'Unknown error');
  if (name === 'AbortError' || name === 'APIUserAbortError') return new AIError('aborted', 'Request cancelled.');
  if (name === 'TimeoutError' || name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(message)) {
    return new AIError('timeout', 'The AI provider took too long to answer. Try again or raise the timeout in Settings.');
  }
  const status = e?.status;
  const local = conn ? PROVIDERS[conn.kind].local : false;
  if (status === 401) return new AIError('auth', 'The API key was rejected. Check it in Settings → AI providers.', status);
  if (status === 403) {
    if (conn?.kind === 'ollama') {
      return new AIError('permission', 'Ollama refused the connection. Restart it with OLLAMA_ORIGINS="chrome-extension://*".', status);
    }
    return new AIError('auth', `Access denied by the provider: ${message}`, status);
  }
  if (status === 402 || (status === 429 && /quota|insufficient|billing|credit/i.test(message))) {
    return new AIError('quota', 'Your provider account is out of credit or quota.', status);
  }
  if (status === 429) return new AIError('rate_limit', 'Rate limited by the provider. Wait a moment and try again.', status);
  if (status === 404) return new AIError('bad_request', `Model or endpoint not found: ${message}`, status);
  if (status && status >= 400 && status < 500) return new AIError('bad_request', message, status);
  if (status && status >= 500) return new AIError('unavailable', `The provider is having problems (${status}). Try again later.`, status);
  if (name === 'APIConnectionError' || name === 'TypeError' || /fetch|network|connection/i.test(message)) {
    return new AIError(
      'network',
      local ? `Cannot reach ${conn?.baseUrl}. Is the local server running?` : 'Network error while contacting the AI provider.',
    );
  }
  return new AIError('unknown', message, status);
}

const RETRY_ON_FALLBACK = new Set(['rate_limit', 'unavailable', 'network', 'timeout', 'quota']);

async function ensureHostPermission(conn: ProviderConnection): Promise<void> {
  const origin = originPattern(conn);
  if (!origin) return;
  const granted = await browser.permissions.contains({ origins: [origin] });
  if (!granted) {
    throw new AIError(
      'permission',
      `Captionary does not have permission to contact ${new URL(conn.baseUrl).host}. Open Settings → AI providers and click "Grant access".`,
    );
  }
}

async function streamOnce(
  conn: ProviderConnection,
  req: ProviderRequest,
  onDelta: ((t: string) => void) | undefined,
): Promise<{ text: string; usage?: AIUsage }> {
  const info = PROVIDERS[conn.kind];
  const apiKey = await getApiKey(conn.id);
  if (info.requiresKey && !apiKey) {
    throw new AIError('missing_key', `Add your ${info.name} API key in Settings → AI providers.`);
  }
  await ensureHostPermission(conn);
  const adapter = ADAPTERS[info.protocol];
  let text = '';
  let usage: AIUsage | undefined;
  for await (const chunk of adapter.stream({ connection: conn, apiKey }, req)) {
    if (chunk.type === 'text') {
      text += chunk.text;
      onDelta?.(chunk.text);
    } else {
      usage = { ...usage, ...chunk.usage };
    }
  }
  return { text, usage };
}

/**
 * Some models reject optional parameters (temperature, reasoning effort, JSON mode).
 * If a request fails with 400 before any text was produced, retry once without them.
 */
async function streamWithParamFallback(conn: ProviderConnection, req: ProviderRequest, onDelta: ((t: string) => void) | undefined) {
  let emitted = false;
  const track = (t: string) => {
    emitted = true;
    onDelta?.(t);
  };
  try {
    return await streamOnce(conn, req, track);
  } catch (err) {
    const status = (err as { status?: number }).status;
    const hasOptional = req.temperature !== null || req.effort !== 'default' || req.json;
    if (status === 400 && hasOptional && !emitted && !req.signal.aborted) {
      return streamOnce(conn, { ...req, temperature: null, effort: 'default', json: false }, onDelta);
    }
    throw err;
  }
}

export async function runJob(job: AIJob, opts: RunOptions = {}): Promise<AIResult> {
  const [ai, settings] = await Promise.all([getAISettings(), getSettings()]);
  if (!ai.enabled) throw new AIError('disabled', 'AI features are turned off in Settings.');
  const route = ai.routes[job.task];
  const primary = resolveConnection(ai, route.connectionId);
  if (!primary) throw new AIError('not_configured', 'Add an AI provider in Settings → AI providers to get explanations.');

  const prompt = buildPrompt(job, { ai, nativeLanguage: settings.nativeLanguage, level: settings.learnerLevel });
  const signal = opts.signal ?? new AbortController().signal;
  const validate = job.task === 'translate' ? (t: string) => parseTranslations(t, job.lines.length) !== null : () => true;

  const attempt = async (conn: ProviderConnection, useRouteModel: boolean): Promise<AIResult> => {
    const model = resolveModel(conn, route, useRouteModel);
    if (!model) throw new AIError('not_configured', `Choose a model for ${conn.label} in Settings → AI.`);
    opts.onMeta?.({ model, provider: conn.kind });
    const req: ProviderRequest = {
      model,
      system: prompt.system,
      messages: prompt.messages,
      temperature: route.temperature,
      maxOutputTokens: route.maxOutputTokens,
      effort: route.effort,
      json: prompt.json,
      signal,
      timeoutMs: ai.timeoutSec * 1000,
      maxRetries: ai.maxRetries,
    };
    const key = ai.cacheEnabled
      ? await cacheKey([CACHE_VERSION, conn.kind, conn.baseUrl, model, prompt, route.temperature, route.effort])
      : null;
    if (key) {
      const hit = await getCached(key, ai.cacheTtlDays);
      if (hit) {
        opts.onDelta?.(hit.text);
        void recordRequest(model, hit.usage, true);
        return hit;
      }
    }
    await assertWithinLimit(ai.dailyRequestLimit);
    const { text, usage } = await streamWithParamFallback(conn, req, opts.onDelta);
    void recordRequest(model, usage, false);
    if (!text.trim()) throw new AIError('unknown', 'The model returned an empty answer. Try again or pick another model.');
    const result: AIResult = { text, model, provider: conn.kind, cached: false, usage };
    if (key && validate(text)) await putCached(key, result);
    return result;
  };

  try {
    return await attempt(primary, true);
  } catch (raw) {
    const err = toAIError(raw, primary);
    const fallback = ai.fallbackConnectionId ? ai.connections.find((c) => c.id === ai.fallbackConnectionId) : undefined;
    if (fallback && fallback.id !== primary.id && RETRY_ON_FALLBACK.has(err.code) && !signal.aborted) {
      try {
        return await attempt(fallback, false);
      } catch (fallbackErr) {
        throw toAIError(fallbackErr, fallback);
      }
    }
    throw err;
  }
}

export async function listModels(conn: ProviderConnection): Promise<string[]> {
  const info = PROVIDERS[conn.kind];
  const apiKey = await getApiKey(conn.id);
  if (info.requiresKey && !apiKey) throw new AIError('missing_key', `Add your ${info.name} API key first.`);
  await ensureHostPermission(conn);
  try {
    return await ADAPTERS[info.protocol].listModels({ connection: conn, apiKey }, AbortSignal.timeout(20_000));
  } catch (err) {
    throw toAIError(err, conn);
  }
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  models?: string[];
  reply?: string;
  error?: string;
}

/**
 * Verify a connection. Listing models is free, so it is tried first; a tiny completion
 * is used only when the list endpoint is missing (some OpenAI-compatible servers).
 */
export async function testConnection(conn: ProviderConnection, model?: string): Promise<TestResult> {
  const started = performance.now();
  try {
    const models = await listModels(conn);
    return { ok: true, latencyMs: Math.round(performance.now() - started), models };
  } catch (err) {
    const e = toAIError(err, conn);
    if (e.code !== 'bad_request') return { ok: false, latencyMs: Math.round(performance.now() - started), error: e.message };
  }
  try {
    const { text } = await streamOnce(
      conn,
      {
        model: model || conn.defaultModel || PROVIDERS[conn.kind].defaultModel,
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'Ping' }],
        temperature: null,
        maxOutputTokens: 16,
        effort: 'default',
        signal: AbortSignal.timeout(30_000),
        timeoutMs: 30_000,
        maxRetries: 0,
      },
      undefined,
    );
    return { ok: true, latencyMs: Math.round(performance.now() - started), reply: text.trim() };
  } catch (err) {
    return { ok: false, latencyMs: Math.round(performance.now() - started), error: toAIError(err, conn).message };
  }
}
