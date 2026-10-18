import { getCurrentUILocale, getMessages } from '../../i18n';
import { AIError, type ProviderAdapter } from '../types';
import { TRANSLATION_SCHEMA } from './shared';

/** Minimal typing for Chrome's built-in Prompt API (Gemini Nano). */
interface LanguageModelSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal; responseConstraint?: unknown }): AsyncIterable<string>;
  destroy(): void;
}
interface LanguageModelStatic {
  availability(opts?: unknown): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts?: unknown): Promise<LanguageModelSession>;
}

const OUTPUT_LANGS = ['en', 'es', 'ja'];

export function getLanguageModel(): LanguageModelStatic | undefined {
  return (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
}

export function builtinOptions(outputLang = 'en') {
  const lang = OUTPUT_LANGS.includes(outputLang) ? outputLang : 'en';
  return {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: [lang] }],
  };
}

/**
 * Chrome's on-device model. Free and private (nothing leaves the machine), but small:
 * good for quick glosses, weaker for detailed grammar. The first download needs a user
 * gesture, so the settings page offers a "Download model" button.
 */
export const chromeAdapter: ProviderAdapter = {
  async *stream(_ctx, req) {
    const m = getMessages(getCurrentUILocale()).runtime.ai;
    const LM = getLanguageModel();
    if (!LM) throw new AIError('unavailable', m.chromeNotAvailable);
    const availability = await LM.availability(builtinOptions());
    if (availability === 'unavailable') {
      throw new AIError('unavailable', m.chromeNotSupported);
    }
    if (availability !== 'available') {
      throw new AIError('unavailable', m.chromeNotDownloaded);
    }
    const history = req.messages.slice(0, -1);
    const last = req.messages[req.messages.length - 1];
    const session = await LM.create({
      ...builtinOptions(),
      initialPrompts: [{ role: 'system', content: req.system }, ...history],
      signal: req.signal,
    });
    try {
      const stream = session.promptStreaming(last.content, {
        signal: req.signal,
        responseConstraint: req.json ? TRANSLATION_SCHEMA : undefined,
      });
      for await (const chunk of stream) yield { type: 'text', text: chunk };
    } finally {
      session.destroy();
    }
  },

  async listModels() {
    const LM = getLanguageModel();
    if (!LM) return [];
    const availability = await LM.availability(builtinOptions());
    return availability === 'unavailable' ? [] : ['gemini-nano'];
  },
};
