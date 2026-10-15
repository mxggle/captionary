import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIErrorInfo, AIJob, ProviderKind } from '@/lib/ai/types';
import { streamJob } from '@/lib/messaging';

export interface AIStreamState {
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
  text: string;
  error?: AIErrorInfo;
  model?: string;
  provider?: ProviderKind;
  cached?: boolean;
}

const IDLE: AIStreamState = { status: 'idle', text: '' };

/** Stream an AI job; cancels automatically on unmount or when a new job starts. */
export function useAIStream() {
  const [state, setState] = useState<AIStreamState>(IDLE);
  const cancelRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  const start = useCallback(
    (job: AIJob) => {
      cancel();
      setState({ status: 'loading', text: '' });
      cancelRef.current = streamJob(job, {
        onMeta: (m) => setState((s) => ({ ...s, model: m.model, provider: m.provider, cached: m.cached })),
        onDelta: (t) => setState((s) => ({ ...s, status: 'streaming', text: s.text + t })),
        onDone: (r) => setState((s) => ({ ...s, status: 'done', text: r.text, model: r.model, provider: r.provider, cached: r.cached })),
        onError: (error) => {
          if (error.code === 'aborted') return;
          setState((s) => ({ ...s, status: 'error', error }));
        },
      });
    },
    [cancel],
  );

  const reset = useCallback(() => {
    cancel();
    setState(IDLE);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { ...state, start, cancel, reset };
}
