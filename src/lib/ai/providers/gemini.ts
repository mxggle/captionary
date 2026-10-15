import { isChatModel } from '../registry';
import { AIError, type ProviderAdapter, type ReasoningEffort } from '../types';
import { fetchWithRetry, parseSSE, TRANSLATION_SCHEMA, withThinkingHeadroom } from './shared';

interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiChunk {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const isThinkingModel = (m: string) => /gemini-(2\.5|[3-9])/.test(m);

function thinkingConfig(model: string, effort: ReasoningEffort): Record<string, unknown> | undefined {
  if (effort === 'default') return undefined;
  if (/gemini-2\.5/.test(model)) {
    const pro = /pro/.test(model);
    const budget = { minimal: pro ? 128 : 0, low: 512, medium: 2048, high: 8192 }[effort];
    return { thinkingBudget: budget };
  }
  if (/gemini-[3-9]/.test(model)) {
    return { thinkingLevel: effort === 'medium' || effort === 'high' ? 'high' : 'low' };
  }
  return undefined;
}

function base(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * Google Gemini over its REST API. The key travels in the x-goog-api-key header rather
 * than the URL so it never appears in logs or error messages.
 */
export const geminiAdapter: ProviderAdapter = {
  async *stream(ctx, req) {
    const model = req.model.replace(/^models\//, '');
    const thinking = thinkingConfig(model, req.effort);
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: withThinkingHeadroom(req.maxOutputTokens, isThinkingModel(model) && (thinking?.thinkingBudget ?? 1) !== 0),
    };
    if (req.temperature !== null) generationConfig.temperature = req.temperature;
    if (thinking) generationConfig.thinkingConfig = thinking;
    if (req.json) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = TRANSLATION_SCHEMA;
    }
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig,
    };
    const res = await fetchWithRetry(
      `${base(ctx.connection.baseUrl)}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': ctx.apiKey },
        body: JSON.stringify(body),
      },
      req,
    );
    if (!res.body) throw new AIError('network', 'Empty response from Gemini.');
    for await (const msg of parseSSE(res.body)) {
      const chunk = JSON.parse(msg.data) as GeminiChunk;
      if (chunk.promptFeedback?.blockReason) {
        throw new AIError('refusal', `Gemini blocked the request (${chunk.promptFeedback.blockReason}).`);
      }
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (part.text && !part.thought) yield { type: 'text', text: part.text };
      }
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
        throw new AIError('refusal', 'Gemini stopped the answer for safety reasons.');
      }
      if (chunk.usageMetadata) {
        yield {
          type: 'usage',
          usage: { inputTokens: chunk.usageMetadata.promptTokenCount, outputTokens: chunk.usageMetadata.candidatesTokenCount },
        };
      }
    }
  },

  async listModels(ctx, signal) {
    const res = await fetchWithRetry(
      `${base(ctx.connection.baseUrl)}/models?pageSize=1000`,
      { headers: { 'x-goog-api-key': ctx.apiKey } },
      { signal, timeoutMs: 20_000, maxRetries: 1 },
    );
    const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter(isChatModel)
      .sort();
  },
};
