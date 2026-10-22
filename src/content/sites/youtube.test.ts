import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeMessage } from '../bridge';
import { YouTubeAdapter, type YtPlayerData } from './youtube';
import { SubtitleLoadError } from '@/lib/subtitles/types';

const bridge = vi.hoisted(() => ({
  listeners: [] as ((msg: BridgeMessage) => void)[],
  posted: [] as BridgeMessage[],
  playerData: null as unknown,
}));

vi.mock('../bridge', () => ({
  FROM_MAIN: 'lr-main',
  onMessageFrom: (_source: string, cb: (msg: BridgeMessage) => void) => {
    bridge.listeners.push(cb);
    return () => undefined;
  },
  postToMain: (msg: BridgeMessage) => void bridge.posted.push(msg),
  requestMain: async () => bridge.playerData,
}));

const TOKEN_URL = 'https://www.youtube.com/api/timedtext?v=vid1&lang=en&pot=TOKEN&c=WEB';
const BODY = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] }] });

/** Caption requests get a body only when they carry the token, as on YouTube. */
const fetchMock = vi.fn(async (url: URL | string) => new Response(new URL(String(url)).searchParams.has('pot') ? BODY : ''));

function playerData(extra: Partial<YtPlayerData> = {}): YtPlayerData {
  return {
    videoId: 'vid1',
    title: 'Video',
    tracks: [{ baseUrl: '/api/timedtext?v=vid1&lang=en', lang: 'en', name: 'English', kind: '', vssId: '.en' }],
    defaultIndex: 0,
    translationLanguages: [],
    ...extra,
  };
}

/** The player's own caption request, as relayed by the MAIN-world script. */
const playerRequest = (url = TOKEN_URL) => bridge.listeners.forEach((l) => l({ type: 'yt.timedtext', url }));

async function setup(extra?: Partial<YtPlayerData>) {
  bridge.playerData = playerData(extra);
  const adapter = new YouTubeAdapter();
  await adapter.loadPlayerData('vid1');
  return adapter;
}

describe('YouTubeAdapter caption token', () => {
  beforeEach(() => {
    bridge.listeners = [];
    bridge.posted = [];
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    document.body.innerHTML = '<div id="movie_player"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses a token the player fetched before the content script listened', async () => {
    const adapter = await setup({ tokenUrl: TOKEN_URL });
    const cues = await adapter.loadTrack('.en');
    expect(cues.map((c) => c.text)).toEqual(['Hello']);
    expect(bridge.posted).toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('pot=TOKEN');
  });

  it('waits for a preroll ad to end before asking the player for captions', async () => {
    vi.useFakeTimers();
    const adapter = await setup();
    document.getElementById('movie_player')!.classList.add('ad-showing');
    const load = adapter.loadTrack('.en');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(bridge.posted).toEqual([]);

    document.getElementById('movie_player')!.classList.remove('ad-showing');
    await vi.advanceTimersByTimeAsync(600);
    expect(bridge.posted).toEqual([{ type: 'yt.enableCaptions', lang: 'en' }]);

    playerRequest();
    await expect(load).resolves.toHaveLength(1);
  });

  it('reports a token that arrives after a failed load', async () => {
    vi.useFakeTimers();
    const adapter = await setup();
    const onToken = vi.fn();
    adapter.onToken = onToken;
    const load = adapter.loadTrack('.en');
    const failed = expect(load).rejects.toThrow(SubtitleLoadError);
    await vi.advanceTimersByTimeAsync(8_500);
    await failed;

    playerRequest();
    expect(onToken).toHaveBeenCalledWith('vid1');
    await expect(adapter.loadTrack('.en')).resolves.toHaveLength(1);
  });
});
