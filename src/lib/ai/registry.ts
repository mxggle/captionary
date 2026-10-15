import type { ProviderConnection, ProviderKind, ProviderProtocol } from './types';

export interface ProviderInfo {
  kind: ProviderKind;
  name: string;
  protocol: ProviderProtocol;
  defaultBaseUrl: string;
  /** Whether the base URL is something users normally change. */
  editableBaseUrl: boolean;
  requiresKey: boolean;
  keyPlaceholder?: string;
  /** Where to create an API key. */
  keyUrl?: string;
  /** Used only until the live model list has been fetched. */
  suggestedModels: string[];
  defaultModel: string;
  local?: boolean;
  /** Short hint shown in settings. */
  hint?: string;
}

export const PROVIDERS: Record<ProviderKind, ProviderInfo> = {
  openai: {
    kind: 'openai',
    name: 'OpenAI',
    protocol: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    suggestedModels: ['gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'gpt-4.1-mini'],
    defaultModel: 'gpt-5-mini',
  },
  anthropic: {
    kind: 'anthropic',
    name: 'Anthropic (Claude)',
    protocol: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    defaultModel: 'claude-opus-5-5',
    hint: 'Claude Haiku 5.5 is the fastest and cheapest choice for quick word look-ups.',
  },
  gemini: {
    kind: 'gemini',
    name: 'Google Gemini',
    protocol: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    suggestedModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash',
  },
  openrouter: {
    kind: 'openrouter',
    name: 'OpenRouter',
    protocol: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    suggestedModels: ['openrouter/auto'],
    defaultModel: 'openrouter/auto',
    hint: 'One key for hundreds of models. Pick a model after fetching the list.',
  },
  deepseek: {
    kind: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  groq: {
    kind: 'groq',
    name: 'Groq',
    protocol: 'openai',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    suggestedModels: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  mistral: {
    kind: 'mistral',
    name: 'Mistral',
    protocol: 'openai',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
    suggestedModels: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    defaultModel: 'mistral-small-latest',
  },
  xai: {
    kind: 'xai',
    name: 'xAI (Grok)',
    protocol: 'openai',
    defaultBaseUrl: 'https://api.x.ai/v1',
    editableBaseUrl: false,
    requiresKey: true,
    keyPlaceholder: 'xai-…',
    keyUrl: 'https://console.x.ai',
    suggestedModels: ['grok-4', 'grok-3-mini'],
    defaultModel: 'grok-3-mini',
  },
  ollama: {
    kind: 'ollama',
    name: 'Ollama (local)',
    protocol: 'openai',
    defaultBaseUrl: 'http://localhost:11434/v1',
    editableBaseUrl: true,
    requiresKey: false,
    suggestedModels: ['llama3.2', 'qwen2.5', 'gemma3'],
    defaultModel: 'llama3.2',
    local: true,
    hint: 'Runs on your computer; nothing leaves your machine. Start Ollama with OLLAMA_ORIGINS="chrome-extension://*" so the extension may connect.',
  },
  lmstudio: {
    kind: 'lmstudio',
    name: 'LM Studio (local)',
    protocol: 'openai',
    defaultBaseUrl: 'http://localhost:1234/v1',
    editableBaseUrl: true,
    requiresKey: false,
    suggestedModels: [],
    defaultModel: '',
    local: true,
    hint: 'Enable the local server in LM Studio (Developer tab), then fetch models.',
  },
  'openai-compatible': {
    kind: 'openai-compatible',
    name: 'OpenAI-compatible (custom)',
    protocol: 'openai',
    defaultBaseUrl: 'https://',
    editableBaseUrl: true,
    requiresKey: false,
    suggestedModels: [],
    defaultModel: '',
    hint: 'Any server implementing /v1/chat/completions (vLLM, LiteLLM, Together, Fireworks, Azure AI Foundry, …).',
  },
  'chrome-builtin': {
    kind: 'chrome-builtin',
    name: 'Chrome built-in AI (Gemini Nano)',
    protocol: 'chrome',
    defaultBaseUrl: '',
    editableBaseUrl: false,
    requiresKey: false,
    suggestedModels: ['gemini-nano'],
    defaultModel: 'gemini-nano',
    local: true,
    hint: 'Free and on-device. Needs a recent desktop Chrome with enough disk/GPU; the model downloads on first use.',
  },
};

export const PROVIDER_ORDER: ProviderKind[] = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'deepseek',
  'groq',
  'mistral',
  'xai',
  'ollama',
  'lmstudio',
  'openai-compatible',
  'chrome-builtin',
];

export function providerInfo(kind: ProviderKind): ProviderInfo {
  return PROVIDERS[kind];
}

/**
 * Validate a base URL: HTTPS is required for remote hosts so API keys never travel in
 * clear text; plain HTTP is allowed only for loopback (local model servers).
 */
export function validateBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Enter a full URL, e.g. https://api.example.com/v1';
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'http:' && !loopback) return 'Use https:// (plain http is only allowed for localhost).';
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Only http(s) URLs are supported.';
  if (url.username || url.password) return 'Do not put credentials in the URL; use the API key field.';
  return null;
}

/** Host-permission pattern needed to call a connection from the service worker. */
export function originPattern(conn: Pick<ProviderConnection, 'kind' | 'baseUrl'>): string | null {
  const info = PROVIDERS[conn.kind];
  if (info.protocol === 'chrome') return null;
  try {
    const url = new URL(conn.baseUrl || info.defaultBaseUrl);
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return null;
  }
}

/** Heuristic filter that drops embedding/audio/image models from list endpoints. */
export function isChatModel(id: string): boolean {
  return !/(embed|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|davinci|babbage|search|computer-use|rerank|guard|vision-preview|imagen|veo|aqa)/i.test(
    id,
  );
}

export function newConnection(kind: ProviderKind): ProviderConnection {
  const info = PROVIDERS[kind];
  return {
    id: crypto.randomUUID(),
    kind,
    label: info.name,
    baseUrl: info.defaultBaseUrl,
    defaultModel: info.defaultModel,
    models: [],
    extraHeaders: kind === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/mxggle/captionary', 'X-Title': 'Captionary' } : undefined,
  };
}
