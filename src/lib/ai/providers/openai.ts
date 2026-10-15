import OpenAI from 'openai';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
import { isChatModel } from '../registry';
import { withThinkingHeadroom } from './shared';
import type { ProviderAdapter, ProviderContext, ProviderRequest } from '../types';

/** Providers that accept stream_options.include_usage on chat completions. */
const USAGE_IN_STREAM = new Set(['openai', 'openrouter', 'deepseek', 'groq', 'xai']);

function client(ctx: ProviderContext, req?: Pick<ProviderRequest, 'timeoutMs' | 'maxRetries'>) {
  return new OpenAI({
    // Local servers (Ollama, LM Studio) ignore the key but the SDK requires a value.
    apiKey: ctx.apiKey || 'not-needed',
    baseURL: ctx.connection.baseUrl.replace(/\/+$/, ''),
    defaultHeaders: ctx.connection.extraHeaders,
    // Runs in the extension service worker, never in a web page. The key is supplied
    // by the user for their own account and is not shipped with the extension.
    dangerouslyAllowBrowser: true,
    timeout: req?.timeoutMs ?? 30_000,
    maxRetries: req?.maxRetries ?? 1,
  });
}

/** OpenAI reasoning models (gpt-5*, o-series) take reasoning_effort and reject temperature. */
function isOpenAIReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model.replace(/^openai\//, ''));
}

export const openaiAdapter: ProviderAdapter = {
  async *stream(ctx, req) {
    const kind = ctx.connection.kind;
    const reasoning = isOpenAIReasoningModel(req.model);
    const params: ChatCompletionCreateParamsStreaming = {
      model: req.model,
      stream: true,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
    };
    // Reasoning tokens count against the completion limit; leave room so a lookup is
    // never cut off before any visible text is produced.
    const maxTokens = withThinkingHeadroom(req.maxOutputTokens, reasoning);
    if (kind === 'openai') params.max_completion_tokens = maxTokens;
    else params.max_tokens = maxTokens;
    if (req.temperature !== null && !(kind === 'openai' && reasoning)) params.temperature = req.temperature;
    if (req.effort !== 'default' && (kind === 'openai' || kind === 'openrouter') && reasoning) {
      params.reasoning_effort = req.effort;
    }
    if (req.json && kind !== 'ollama' && kind !== 'lmstudio') params.response_format = { type: 'json_object' };
    if (USAGE_IN_STREAM.has(kind)) params.stream_options = { include_usage: true };

    const stream = await client(ctx, req).chat.completions.create(params, { signal: req.signal });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: 'text', text: delta };
      if (chunk.usage) {
        yield {
          type: 'usage',
          usage: { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens },
        };
      }
    }
  },

  async listModels(ctx, signal) {
    const ids: string[] = [];
    for await (const model of client(ctx).models.list({ signal })) ids.push(model.id);
    return ids.filter(isChatModel).sort();
  },
};
