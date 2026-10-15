import { useEffect, useState } from 'react';
import { bg, type AIStatus } from '@/lib/messaging';
import { listVocab, watchVocab, type VocabItem } from '@/lib/vocab';

/** All saved vocabulary as a map, kept live across tabs. */
export function useVocabMap(): Record<string, VocabItem> {
  const [vocab, setVocab] = useState<Record<string, VocabItem>>({});
  useEffect(() => {
    const load = () => void listVocab().then((items) => setVocab(Object.fromEntries(items.map((i) => [i.id, i]))));
    load();
    return watchVocab(load);
  }, []);
  return vocab;
}

export function useAIStatus(): AIStatus | null {
  const [status, setStatus] = useState<AIStatus | null>(null);
  useEffect(() => {
    void bg({ type: 'ai.status' })
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  return status;
}
