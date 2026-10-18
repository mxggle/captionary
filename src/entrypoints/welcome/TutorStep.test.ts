import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { newConnection } from '@/lib/ai/registry';
import { getApiKey, setApiKey } from '@/lib/ai/secrets';
import { getAISettings, updateAISettings } from '@/lib/settings';
import { setAsTutor, undoTutor } from './TutorStep';

describe('undoTutor', () => {
  beforeEach(() => fakeBrowser.reset());

  it('leaves AI off when a new tutor fails and AI was off before', async () => {
    const existing = newConnection('openai');
    await updateAISettings((s) => {
      s.connections = [existing];
      s.defaultConnectionId = existing.id;
      s.enabled = false;
    });
    const before = await getAISettings();

    const added = newConnection('anthropic');
    await setApiKey(added.id, 'sk-bad');
    await setAsTutor(added);
    expect((await getAISettings()).enabled).toBe(true);

    await undoTutor(added, true, before, async () => {});
    const after = await getAISettings();
    expect(after.connections.map((c) => c.id)).toEqual([existing.id]);
    expect(after.defaultConnectionId).toBe(existing.id);
    expect(after.enabled).toBe(false);
    expect(await getApiKey(added.id)).toBe('');
  });
});
