import { storage } from '#imports';

/**
 * API keys are stored apart from the rest of the settings:
 *  - in storage.local only (never storage.sync, so they do not leave the device);
 *  - under their own keys, so settings export/import and debugging never include them;
 *  - read only by the background service worker, which makes every provider request.
 *    Content scripts never receive a key.
 */
const keyName = (connectionId: string) => `local:aiKey:${connectionId}` as const;

export async function getApiKey(connectionId: string): Promise<string> {
  return (await storage.getItem<string>(keyName(connectionId))) ?? '';
}

export async function hasApiKey(connectionId: string): Promise<boolean> {
  return (await getApiKey(connectionId)).length > 0;
}

export async function setApiKey(connectionId: string, key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) return removeApiKey(connectionId);
  await storage.setItem(keyName(connectionId), trimmed);
}

export async function removeApiKey(connectionId: string): Promise<void> {
  await storage.removeItem(keyName(connectionId));
}

/** "sk-ant-api03-abcdef…wxyz" -> "sk-a…wxyz" for display. */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
