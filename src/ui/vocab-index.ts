import { useMemo } from 'react';
import { normalizeLang } from '@/lib/languages';
import { phraseBucket } from '@/lib/text/tokenize';
import type { VocabItem, VocabStatus } from '@/lib/vocab';

export interface VocabIndex {
  words: Map<string, VocabStatus>;
  /** First word of a phrase -> full phrase keys. */
  phrases: Map<string, string[]>;
  phraseStatus: Map<string, VocabStatus>;
}

export function buildVocabIndex(vocab: Record<string, VocabItem>, lang: string): VocabIndex {
  const target = normalizeLang(lang);
  const words = new Map<string, VocabStatus>();
  const phrases = new Map<string, string[]>();
  const phraseStatus = new Map<string, VocabStatus>();
  for (const item of Object.values(vocab)) {
    if (item.lang !== target) continue;
    if (item.kind === 'phrase') {
      const k = phraseBucket(item.key, target);
      phrases.set(k, [...(phrases.get(k) ?? []), item.key]);
      phraseStatus.set(item.key, item.status);
    } else {
      words.set(item.key, item.status);
    }
  }
  return { words, phrases, phraseStatus };
}

export function useVocabIndex(vocab: Record<string, VocabItem>, lang: string): VocabIndex {
  return useMemo(() => buildVocabIndex(vocab, lang), [vocab, lang]);
}
