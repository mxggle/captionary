import { getCurrentUILocale, getMessages } from '../../i18n';
import { ORIGINATOR } from '../chatgpt-auth';
import { PROVIDERS } from '../registry';
import { AIError, type ProviderAdapter, type ProviderContext } from '../types';
import { fetchWithRetry, HttpError, parseSSE, TRANSLATION_SCHEMA } from './shared';

/** The models endpoint lists what a client of this Codex version may use. */
const CODEX_CLIENT_VERSION = '0.163.0';

interface ResponsesEvent {
  type?: string;
  delta?: string;
  response?: {
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { code?: string; message?: string };
    incomplete_details?: { reason?: string };
  };
  error?: { code?: string; message?: string };
  message?: string;
}

interface CodexModel {
  slug: string;
  visibility?: string;
  priority?: number;
}

function headers(ctx: ProviderContext): Record<string, string> {
  return {
    authorization: `Bearer ${ctx.apiKey}`,
    'chatgpt-account-id': ctx.accountId ?? '',
    originator: ORIGINATOR,
    ...(ctx.fedramp ? { 'x-openai-fedramp': 'true' } : {}),
  };
}

/**
 * Always the fixed backend, never the connection's base URL: the token and account id
 * must not follow a base URL changed by a settings import.
 */
const BASE_URL = PROVIDERS.chatgpt.defaultBaseUrl;

interface PlanErrorDetail {
  type?: string;
  code?: string;
  resets_at?: number;
}

function planErrorKind(body: string | undefined): { kind?: string; detail?: PlanErrorDetail } {
  if (!body) return {};
  try {
    const detail = (JSON.parse(body) as { error?: PlanErrorDetail }).error;
    return { kind: detail?.type ?? detail?.code, detail };
  } catch {
    return {};
  }
}

const PLAN_LIMITS = new Set(['usage_limit_reached', 'usage_not_included']);

/** A plan limit doesn't lift within a retry's wait, so it is reported at once. */
const isPlanLimit = (body: string) => PLAN_LIMITS.has(planErrorKind(body).kind ?? '');

/** Turn the backend's structured errors (plan limits, plan without Codex) into clear messages. */
function planError(err: unknown): unknown {
  if (!(err instanceof HttpError)) return err;
  const m = getMessages(getCurrentUILocale()).runtime.ai;
  const { kind, detail } = planErrorKind(err.body);
  if (kind === 'usage_limit_reached') {
    const resets = detail?.resets_at ? new Date(detail.resets_at * 1000).toLocaleString() : undefined;
    return new AIError('quota', m.chatgptUsageLimitReached(resets), err.status);
  }
  if (kind === 'usage_not_included') {
    return new AIError('quota', m.chatgptPlanNoCodex, err.status);
  }
  return err;
}

/** Why the backend stopped an answer partway (`response.incomplete`). */
function incompleteError(reason: string | undefined): AIError {
  const m = getMessages(getCurrentUILocale()).runtime.ai;
  if (reason === 'content_filter') return new AIError('refusal', m.chatgptContentFilter);
  if (reason === 'max_output_tokens') {
    return new AIError('unknown', m.chatgptMaxOutputTokens);
  }
  return new AIError('unknown', m.chatgptIncomplete);
}

/**
 * ChatGPT's Codex backend: the OpenAI Responses API, authorised by a ChatGPT sign-in.
 * It is stateless (store: false), streams only, and rejects an output limit and
 * sampling parameters, so those are left out.
 */
export const chatgptAdapter: ProviderAdapter = {
  async *stream(ctx, req) {
    const m = getMessages(getCurrentUILocale()).runtime.ai;
    const body: Record<string, unknown> = {
      model: req.model,
      instructions: req.system,
      input: req.messages.map((msg) => ({
        type: 'message',
        role: msg.role,
        content: [{ type: msg.role === 'assistant' ? 'output_text' : 'input_text', text: msg.content }],
      })),
      stream: true,
      store: false,
    };
    if (req.effort !== 'default') body.reasoning = { effort: req.effort };
    if (req.json) body.text = { format: { type: 'json_schema', name: 'translations', schema: TRANSLATION_SCHEMA, strict: true } };

    let res: Response;
    try {
      res = await fetchWithRetry(
        `${BASE_URL}/responses`,
        {
          method: 'POST',
          headers: { ...headers(ctx), 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify(body),
          // Never attach the browser's chatgpt.com cookies; the token is the only credential.
          credentials: 'omit',
        },
        { signal: req.signal, timeoutMs: req.timeoutMs, maxRetries: req.maxRetries, isFinal: isPlanLimit },
      );
    } catch (err) {
      throw planError(err);
    }
    if (!res.body) throw new AIError('network', m.chatgptEmptyResponse);
    for await (const msg of parseSSE(res.body)) {
      if (msg.data === '[DONE]') break;
      const event = JSON.parse(msg.data) as ResponsesEvent;
      const type = event.type ?? msg.event;
      if (type === 'response.output_text.delta' && event.delta) {
        yield { type: 'text', text: event.delta };
      } else if (type === 'response.refusal.done') {
        throw new AIError('refusal', m.modelDeclined);
      } else if (type === 'response.completed') {
        const usage = event.response?.usage;
        if (usage) yield { type: 'usage', usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
      } else if (type === 'response.incomplete') {
        // A cut-off answer must not pass for a whole one, or it is cached (and a translation is malformed).
        throw incompleteError(event.response?.incomplete_details?.reason);
      } else if (type === 'response.failed' || type === 'error') {
        const error = event.response?.error ?? event.error;
        throw new AIError('unavailable', error?.message ?? event.message ?? m.chatgptFailed);
      }
    }
  },

  async listModels(ctx, signal) {
    const res = await fetchWithRetry(
      `${BASE_URL}/models?client_version=${CODEX_CLIENT_VERSION}`,
      { headers: headers(ctx), credentials: 'omit' },
      { signal, timeoutMs: 20_000, maxRetries: 1, isFinal: isPlanLimit },
    ).catch((err) => {
      throw planError(err);
    });
    const json = (await res.json()) as { models?: CodexModel[] };
    return (json.models ?? [])
      .filter((m) => m.slug && m.visibility !== 'hide')
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.slug.localeCompare(b.slug))
      .map((m) => m.slug);
  },
};
