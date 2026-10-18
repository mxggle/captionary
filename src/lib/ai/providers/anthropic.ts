import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { getCurrentUILocale, getMessages } from '../../i18n';
import { AIError, type ProviderAdapter, type ProviderContext, type ProviderRequest } from '../types';
import { TRANSLATION_SCHEMA, withThinkingHeadroom } from './shared';

function client(ctx: ProviderContext, req?: Pick<ProviderRequest, 'timeoutMs' | 'maxRetries'>) {
  return new Anthropic({
    apiKey: ctx.apiKey,
    baseURL: ctx.connection.baseUrl.replace(/\/+$/, '') || undefined,
    // The SDK sends `anthropic-dangerous-direct-browser-access` with this flag. The call
    // is made from the extension service worker with the user's own key.
    dangerouslyAllowBrowser: true,
    timeout: req?.timeoutMs ?? 30_000,
    maxRetries: req?.maxRetries ?? 1,
  });
}

const id = (model: string) => model.toLowerCase();

/** Claude 4.6+ / 5 family think adaptively by default; thinking counts toward max_tokens. */
const thinksByDefault = (m: string) => /claude-(opus-(4-[6-9]|5)|sonnet-(4-6|5)|haiku-5|fable|mythos)/.test(id(m));
/** Models that reject non-default sampling parameters (temperature/top_p). */
const rejectsSampling = (m: string) => /claude-(opus-(4-[78]|5)|sonnet-5|haiku-5|fable|mythos)/.test(id(m));
/** output_config.effort: Opus 4.5+, Sonnet 4.6+, and the 5 family. */
const supportsEffort = (m: string) => /claude-(opus-(4-[5-9]|5)|sonnet-(4-6|5)|haiku-5|fable|mythos)/.test(id(m));
/** Structured JSON outputs. */
const supportsJsonSchema = (m: string) => /claude-(opus-(4-[1-9]|5)|sonnet-(4-[5-9]|5)|haiku-(4-5|5)|fable|mythos)/.test(id(m));
/** Server-side refusal fallback ("default" routing) is offered on these models. */
const supportsFallbacks = (m: string) => /claude-(opus-5(-5)?|sonnet-5-5|fable-5-1)$/.test(id(m));

export const anthropicAdapter: ProviderAdapter = {
  async *stream(ctx, req) {
    const params: MessageCreateParamsStreaming = {
      model: req.model,
      max_tokens: withThinkingHeadroom(req.maxOutputTokens, thinksByDefault(req.model)),
      system: req.system,
      messages: req.messages,
      stream: true,
    };
    if (req.temperature !== null && !rejectsSampling(req.model)) params.temperature = req.temperature;
    const outputConfig: NonNullable<MessageCreateParamsStreaming['output_config']> = {};
    if (req.effort !== 'default' && supportsEffort(req.model)) {
      outputConfig.effort = req.effort === 'minimal' ? 'low' : req.effort;
    }
    if (req.json && supportsJsonSchema(req.model)) {
      outputConfig.format = { type: 'json_schema', schema: TRANSLATION_SCHEMA as unknown as Record<string, unknown> };
    }
    if (Object.keys(outputConfig).length) params.output_config = outputConfig;
    if (supportsFallbacks(req.model)) {
      // Let the API retry a declined request on a suitable model instead of failing.
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }

    const stream = client(ctx, req).beta.messages.stream(params, { signal: req.signal });
    let inputTokens: number | undefined;
    for await (const event of stream) {
      if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason === 'refusal') {
          throw new AIError('refusal', getMessages(getCurrentUILocale()).runtime.ai.modelDeclined);
        }
        yield { type: 'usage', usage: { inputTokens, outputTokens: event.usage.output_tokens } };
      }
    }
  },

  async listModels(ctx) {
    const ids: string[] = [];
    for await (const model of client(ctx).models.list()) ids.push(model.id);
    return ids;
  },
};
