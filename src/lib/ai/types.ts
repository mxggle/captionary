/** Every provider the extension can talk to. */
export type ProviderKind =
  | 'openai'
  | 'chatgpt'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'xai'
  | 'ollama'
  | 'lmstudio'
  | 'openai-compatible'
  | 'chrome-builtin';

/** Wire protocol used to reach a provider. */
export type ProviderProtocol = 'openai' | 'chatgpt' | 'anthropic' | 'gemini' | 'chrome';

/** The jobs the extension asks an AI model to do. Each can be routed to a different model. */
export type AITask = 'word' | 'sentence' | 'chat' | 'translate';

export const AI_TASKS: AITask[] = ['word', 'sentence', 'chat', 'translate'];

/** "default" leaves reasoning effort to the provider. */
export type ReasoningEffort = 'default' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * A configured provider account. The API key is NOT part of this object: it lives in
 * a separate local-only storage key (see secrets.ts) so settings can be exported,
 * displayed and logged without leaking credentials.
 */
export interface ProviderConnection {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** Model ids returned by the provider's list endpoint (cached). */
  models: string[];
  modelsFetchedAt?: number;
  /** Non-secret headers (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
}

export interface TaskRoute {
  /** null = use the default connection. */
  connectionId: string | null;
  /** '' = the connection's default model. */
  model: string;
  /** null = provider default. Many reasoning models reject custom temperatures. */
  temperature: number | null;
  maxOutputTokens: number;
  effort: ReasoningEffort;
}

export type ContextScope = 'word' | 'sentence' | 'surrounding';

export interface AISettings {
  enabled: boolean;
  connections: ProviderConnection[];
  defaultConnectionId: string | null;
  /** Used when the primary connection fails with a retryable error. */
  fallbackConnectionId: string | null;
  routes: Record<AITask, TaskRoute>;
  /** Language the AI writes explanations in. */
  explanationLanguage: 'native' | 'target';
  /** How much surrounding text is sent with a lookup (privacy vs. quality). */
  contextScope: ContextScope;
  shareMediaTitle: boolean;
  /** Start an AI explanation as soon as a word is clicked (costs a request per click). */
  autoExplain: boolean;
  stream: boolean;
  timeoutSec: number;
  maxRetries: number;
  cacheEnabled: boolean;
  cacheTtlDays: number;
  /** 0 = unlimited. Guards against runaway cost (e.g. auto-translating long videos). */
  dailyRequestLimit: number;
  /** Custom system prompts per task; missing = built-in default. */
  prompts: Partial<Record<AITask, string>>;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Structured input for an AI job. Prompts are built in the background from this. */
export type AIJob =
  | {
      task: 'word';
      text: string;
      sentence: string;
      before?: string[];
      after?: string[];
      sentenceTranslation?: string;
      targetLang: string;
      mediaTitle?: string;
    }
  | {
      task: 'sentence';
      sentence: string;
      before?: string[];
      after?: string[];
      sentenceTranslation?: string;
      targetLang: string;
      mediaTitle?: string;
    }
  | {
      task: 'chat';
      /** What the conversation is about (word or sentence) — included as context. */
      subject: string;
      sentence?: string;
      targetLang: string;
      history: ChatTurn[];
      question: string;
    }
  | {
      task: 'translate';
      lines: string[];
      sourceLang: string;
      targetLang: string;
    };

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIResult {
  text: string;
  model: string;
  provider: ProviderKind;
  cached: boolean;
  usage?: AIUsage;
}

/** Messages streamed from the background over a runtime Port. */
export type AIStreamEvent =
  | { type: 'meta'; model: string; provider: ProviderKind; cached: boolean }
  | { type: 'delta'; text: string }
  | { type: 'done'; result: AIResult }
  | { type: 'error'; error: AIErrorInfo };

export type AIErrorCode =
  | 'not_configured'
  | 'disabled'
  | 'missing_key'
  | 'permission'
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'limit_reached'
  | 'bad_request'
  | 'network'
  | 'timeout'
  | 'refusal'
  | 'aborted'
  | 'unavailable'
  | 'unknown';

export interface AIErrorInfo {
  code: AIErrorCode;
  message: string;
  status?: number;
}

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
  toInfo(): AIErrorInfo {
    return { code: this.code, message: this.message, status: this.status };
  }
}

/** Normalized request handed to a provider adapter. */
export interface ProviderRequest {
  model: string;
  system: string;
  messages: ChatTurn[];
  temperature: number | null;
  maxOutputTokens: number;
  effort: ReasoningEffort;
  /** Ask for a JSON object response where the provider supports it. */
  json?: boolean;
  signal: AbortSignal;
  timeoutMs: number;
  maxRetries: number;
}

export interface ProviderContext {
  connection: ProviderConnection;
  /** API key, or the OAuth access token for sign-in providers. */
  apiKey: string;
  /** ChatGPT workspace the access token acts for (sign-in providers only). */
  accountId?: string;
  fedramp?: boolean;
}

export type ProviderChunk = { type: 'text'; text: string } | { type: 'usage'; usage: AIUsage };

export interface ProviderAdapter {
  stream(ctx: ProviderContext, req: ProviderRequest): AsyncIterable<ProviderChunk>;
  listModels(ctx: ProviderContext, signal: AbortSignal): Promise<string[]>;
}
