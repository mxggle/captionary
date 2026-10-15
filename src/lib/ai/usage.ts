import { storage } from '#imports';
import { AIError, type AIUsage } from './types';

export interface UsageCounter {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
}

export interface UsageStats {
  day: string;
  today: UsageCounter;
  total: UsageCounter;
  byModel: Record<string, UsageCounter>;
}

const empty = (): UsageCounter => ({ requests: 0, inputTokens: 0, outputTokens: 0, cacheHits: 0 });

export const usageItem = storage.defineItem<UsageStats>('local:aiUsage', {
  fallback: { day: '', today: empty(), total: empty(), byModel: {} },
});

function today(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

// Serialize read-modify-write cycles; several requests can finish at once.
let queue: Promise<unknown> = Promise.resolve();
function update(fn: (s: UsageStats) => void): Promise<void> {
  const next = queue.then(async () => {
    const stats = structuredClone(await usageItem.getValue());
    if (stats.day !== today()) {
      stats.day = today();
      stats.today = empty();
    }
    fn(stats);
    await usageItem.setValue(stats);
  });
  queue = next.catch(() => undefined);
  return next;
}

export async function getUsage(): Promise<UsageStats> {
  const stats = await usageItem.getValue();
  return stats.day === today() ? stats : { ...stats, day: today(), today: empty() };
}

/** Enforce the user's daily request cap before a paid request is made. */
export async function assertWithinLimit(dailyLimit: number): Promise<void> {
  if (!dailyLimit) return;
  const stats = await getUsage();
  if (stats.today.requests >= dailyLimit) {
    throw new AIError('limit_reached', `Daily AI limit reached (${dailyLimit} requests). Raise it in Settings → AI → Cost & privacy.`);
  }
}

export function recordRequest(model: string, usage: AIUsage | undefined, cached: boolean): Promise<void> {
  return update((s) => {
    const add = (c: UsageCounter) => {
      if (cached) {
        c.cacheHits++;
        return;
      }
      c.requests++;
      c.inputTokens += usage?.inputTokens ?? 0;
      c.outputTokens += usage?.outputTokens ?? 0;
    };
    add(s.today);
    add(s.total);
    s.byModel[model] ??= empty();
    add(s.byModel[model]);
  });
}

export async function resetUsage(): Promise<void> {
  await usageItem.setValue({ day: today(), today: empty(), total: empty(), byModel: {} });
}
