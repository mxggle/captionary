import { openDB, type IDBPDatabase } from 'idb';
import type { AIResult } from './types';

interface CacheEntry {
  key: string;
  result: AIResult;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  // Pre-rename database name, kept so existing installs keep their data.
  dbPromise ??= openDB('language-react-ai', 1, {
    upgrade(database) {
      const store = database.createObjectStore('responses', { keyPath: 'key' });
      store.createIndex('createdAt', 'createdAt');
    },
  });
  return dbPromise;
}

/** SHA-256 over a stable JSON encoding of everything that influences the answer. */
export async function cacheKey(parts: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getCached(key: string, ttlDays: number): Promise<AIResult | null> {
  try {
    const entry = (await (await db()).get('responses', key)) as CacheEntry | undefined;
    if (!entry) return null;
    if (Date.now() - entry.createdAt > ttlDays * 86_400_000) return null;
    return { ...entry.result, cached: true };
  } catch {
    return null;
  }
}

export async function putCached(key: string, result: AIResult): Promise<void> {
  try {
    const entry: CacheEntry = { key, result: { ...result, cached: false }, createdAt: Date.now() };
    await (await db()).put('responses', entry);
  } catch {
    // Caching is best-effort.
  }
}

export async function pruneCache(ttlDays: number): Promise<number> {
  const database = await db();
  const tx = database.transaction('responses', 'readwrite');
  const cutoff = Date.now() - ttlDays * 86_400_000;
  let removed = 0;
  let cursor = await tx.store.index('createdAt').openCursor(IDBKeyRange.upperBound(cutoff));
  while (cursor) {
    await cursor.delete();
    removed++;
    cursor = await cursor.continue();
  }
  await tx.done;
  return removed;
}

export async function clearCache(): Promise<void> {
  await (await db()).clear('responses');
}

export async function cacheSize(): Promise<number> {
  try {
    return await (await db()).count('responses');
  } catch {
    return 0;
  }
}
