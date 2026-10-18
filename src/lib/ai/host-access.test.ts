import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { updateAISettings } from '../settings';
import { SIGN_IN_ORIGINS } from './chatgpt-auth';
import { releaseOrigins } from './host-access';
import { newConnection } from './registry';

describe('releaseOrigins', () => {
  const remove = vi.fn();
  beforeEach(() => {
    fakeBrowser.reset();
    remove.mockReset().mockResolvedValue(true);
    Object.assign(fakeBrowser, { permissions: { remove } });
  });
  const removed = () => remove.mock.calls.map(([p]) => p.origins[0]);

  it('gives back localhost after a ChatGPT sign-in but keeps the hosts the connection uses', async () => {
    await updateAISettings((s) => void s.connections.push(newConnection('chatgpt')));
    await releaseOrigins(SIGN_IN_ORIGINS);
    expect(removed()).toEqual(['http://localhost/*']);
  });

  it('keeps localhost while a local model server uses it', async () => {
    await updateAISettings((s) => void s.connections.push(newConnection('chatgpt'), newConnection('ollama')));
    await releaseOrigins(SIGN_IN_ORIGINS);
    expect(removed()).toEqual([]);
  });

  it('gives back every sign-in host once the connection is gone, even if one was never granted', async () => {
    remove.mockRejectedValueOnce(new Error('not granted'));
    await releaseOrigins(SIGN_IN_ORIGINS);
    expect(removed()).toEqual(SIGN_IN_ORIGINS);
  });
});
