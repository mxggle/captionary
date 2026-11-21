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
/** The player's token minter is ready to sign requests, as relayed by the MAIN-world script. */
const minterReady = () => bridge.listeners.forEach((l) => l({ type: 'yt.potReady' }));

function captionsButton(pressed: string) {
  const button = document.createElement('button');
  button.className = 'ytp-subtitles-button';
  button.setAttribute('aria-pressed', pressed);
  document.getElementById('movie_player')!.append(button);
  return button;
}

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

  it('never switches CC on while the learner has it off: their pressing it brings the token', async () => {
    vi.useFakeTimers();
    const adapter = await setup();
    captionsButton('false');
    const load = adapter.loadTrack('.en');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(bridge.posted).toEqual([]);

    playerRequest();
    await expect(load).resolves.toHaveLength(1);
  });

  it('asks again when the token arrives while its first request is under way', async () => {
    const adapter = await setup();
    fetchMock.mockImplementationOnce(async () => {
      playerRequest();
      return new Response('');
    });
    await expect(adapter.loadTrack('.en')).resolves.toHaveLength(1);
    expect(bridge.posted).toEqual([]);
    expect(String(fetchMock.mock.calls[1][0])).toContain('pot=TOKEN');
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

  it('uses a token that comes in while its own request is out', async () => {
    const adapter = await setup();
    let answer!: (res: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    const load = adapter.loadTrack('.en');

    // The player fetches captions itself (CC was on) before the unsigned request comes back empty.
    playerRequest();
    answer(new Response(''));
    await expect(load).resolves.toHaveLength(1);
    expect(bridge.posted).toEqual([]);
    expect(String(fetchMock.mock.calls[1][0])).toContain('pot=TOKEN');
  });

  it('asks the player for a new token when the one it has gets no captions', async () => {
    const adapter = await setup({ tokenUrl: TOKEN_URL.replace('TOKEN', 'STALE') });
    fetchMock.mockImplementationOnce(async () => new Response(''));
    const load = adapter.loadTrack('.en');

    await vi.waitFor(() => expect(bridge.posted).toEqual([{ type: 'yt.enableCaptions', lang: 'en' }]));
    playerRequest();
    await expect(load).resolves.toHaveLength(1);
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain('pot=TOKEN');
  });

  it('asks the player again once it can sign the caption request it sent without a token', async () => {
    vi.useFakeTimers();
    const adapter = await setup();
    const onToken = vi.fn();
    adapter.onToken = onToken;
    const load = adapter.loadTrack('.en');
    const failed = expect(load).rejects.toThrow(SubtitleLoadError);

    // Its token minter isn't ready yet: the request goes out unsigned, and the player won't send another.
    await vi.advanceTimersByTimeAsync(0);
    playerRequest('https://www.youtube.com/api/timedtext?v=vid1&lang=en&c=WEB');
    await vi.advanceTimersByTimeAsync(8_500);
    await failed;
    expect(bridge.posted).toHaveLength(1);

    minterReady();
    expect(bridge.posted).toEqual([
      { type: 'yt.enableCaptions', lang: 'en' },
      { type: 'yt.enableCaptions', lang: 'en' },
    ]);
    playerRequest();
    expect(onToken).toHaveBeenCalledWith('vid1');
    await expect(adapter.loadTrack('.en')).resolves.toHaveLength(1);

    // Nothing is awaited any more.
    minterReady();
    expect(bridge.posted).toHaveLength(2);
  });
});

describe('YouTubeAdapter CC button', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="movie_player"></div>';
  });

  it('says what the button says', () => {
    const adapter = new YouTubeAdapter();
    const button = captionsButton('false');
    expect(adapter.hostCaptionsOn()).toBe(false);
    button.setAttribute('aria-pressed', 'true');
    expect(adapter.hostCaptionsOn()).toBe(true);
  });

  it("cannot say during an ad, whose captions are not the video's", () => {
    const adapter = new YouTubeAdapter();
    captionsButton('false');
    document.getElementById('movie_player')!.classList.add('ad-showing');
    expect(adapter.hostCaptionsOn()).toBe(null);
  });

  it('counts as on without a button, so a changed player does not turn Captionary off for good', () => {
    expect(new YouTubeAdapter().hostCaptionsOn()).toBe(true);
  });

  it('presses the button', () => {
    const adapter = new YouTubeAdapter();
    const button = captionsButton('false');
    const click = vi.fn();
    button.addEventListener('click', click);
    adapter.showHostCaptions();
    expect(click).toHaveBeenCalledOnce();
  });
});
