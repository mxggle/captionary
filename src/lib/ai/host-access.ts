import { browser } from '#imports';
import { getAISettings } from '../settings';
import { SIGN_IN_ORIGINS } from './chatgpt-auth';
import { providerOrigins, PROVIDERS } from './registry';
import type { ProviderConnection } from './types';

/** Host access a connection asks for when added; a sign-in also needs it to finish signing in. */
export function originsToRequest(conn: Pick<ProviderConnection, 'kind' | 'baseUrl'>): string[] {
  return PROVIDERS[conn.kind].signIn ? SIGN_IN_ORIGINS : providerOrigins(conn);
}

/** Ask Chrome for host access. Call it inside the click so Chrome shows its prompt (none if already granted). */
export async function requestOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    return await browser.permissions.request({ origins });
  } catch {
    return false;
  }
}

/**
 * Give back host access that no saved connection needs: after a connection is removed, and
 * after a ChatGPT sign-in, which needs localhost only to read the redirect. Call it once the
 * settings are saved, so a connection that was just removed no longer counts.
 */
export async function releaseOrigins(origins: string[]): Promise<void> {
  const needed = new Set((await getAISettings()).connections.flatMap((c) => providerOrigins(c)));
  for (const origin of origins) {
    if (needed.has(origin)) continue;
    // One at a time: an origin that was never granted must not stop the others.
    await browser.permissions.remove({ origins: [origin] }).catch(() => false);
  }
}
