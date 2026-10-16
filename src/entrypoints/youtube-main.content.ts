import { defineContentScript } from '#imports';
import { FROM_ISOLATED, onMessageFrom, postToIsolated } from '@/content/bridge';

interface YtPlayer extends HTMLElement {
  getPlayerResponse?: () => any;
  loadModule?: (name: string) => void;
  unloadModule?: (name: string) => void;
  setOption?: (module: string, option: string, value: unknown) => void;
  getOption?: (module: string, option: string) => any;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
}

const text = (v: any): string => v?.simpleText ?? v?.runs?.map((r: any) => r.text).join('') ?? '';

/**
 * The player's latest caption request URL with a proof-of-origin token, per video. The player may
 * fetch captions before the isolated script listens, so the token also travels with the player data.
 */
const tokenUrls = new Map<string, string>();

function rememberToken(url: string) {
  const u = new URL(url);
  const v = u.searchParams.get('v');
  if (v && u.searchParams.has('pot')) tokenUrls.set(v, url);
}

function readPlayerData(player: YtPlayer | null) {
  const resp = player?.getPlayerResponse?.() ?? (window as any).ytInitialPlayerResponse;
  const details = resp?.videoDetails;
  const renderer = resp?.captions?.playerCaptionsTracklistRenderer;
  const audio = renderer?.audioTracks?.[renderer?.defaultAudioTrackIndex ?? 0];
  return {
    videoId: details?.videoId ?? null,
    title: details?.title ?? document.title,
    tokenUrl: tokenUrls.get(details?.videoId) ?? null,
    tracks: (renderer?.captionTracks ?? []).map((t: any) => ({
      baseUrl: String(t.baseUrl ?? ''),
      lang: String(t.languageCode ?? ''),
      name: text(t.name),
      kind: String(t.kind ?? ''),
      vssId: String(t.vssId ?? ''),
    })),
    defaultIndex: audio?.defaultCaptionTrackIndex ?? renderer?.defaultCaptionTrackIndex ?? null,
    translationLanguages: (renderer?.translationLanguages ?? []).map((l: any) => ({
      code: String(l.languageCode ?? ''),
      name: text(l.languageName),
    })),
  };
}

/**
 * Runs in the page's JavaScript world. It reads the player's caption track list and
 * observes the player's own /api/timedtext requests: YouTube now rejects caption
 * requests without a proof-of-origin token, so the isolated script reuses the token
 * from the player's request.
 */
export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const isTimedText = (u: string) => u.includes('/api/timedtext');
    const absolute = (u: string) => new URL(u, location.origin).toString();
    const report = (url: string, body: string) => {
      rememberToken(absolute(url));
      postToIsolated({ type: 'yt.timedtext', url: absolute(url), body });
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
      const u = String(url);
      if (isTimedText(u)) {
        this.addEventListener('load', () => {
          try {
            report(u, this.responseType === '' || this.responseType === 'text' ? this.responseText : '');
          } catch {
            // ignore
          }
        });
      }
      return (origOpen as any).call(this, method, url, ...rest);
    } as typeof XMLHttpRequest.prototype.open;

    const origFetch = window.fetch;
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const promise = origFetch.call(this ?? window, input, init);
      try {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (isTimedText(u)) {
          promise
            .then((r) => r.clone().text())
            .then((body) => report(u, body))
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
      return promise;
    } as typeof window.fetch;

    onMessageFrom(FROM_ISOLATED, (msg) => {
      const player = document.getElementById('movie_player') as YtPlayer | null;
      try {
        switch (msg.type) {
          case 'yt.getPlayerData':
            postToIsolated({ type: 'yt.playerData', reqId: msg.reqId, data: readPlayerData(player) });
            break;
          case 'yt.enableCaptions':
            // Makes the player fetch a caption track (with its token). Native captions
            // stay hidden by our stylesheet.
            player?.loadModule?.('captions');
            if (msg.lang) player?.setOption?.('captions', 'track', { languageCode: msg.lang });
            break;
          case 'yt.seek':
            player?.seekTo?.(Number(msg.time), true);
            break;
        }
      } catch {
        // Player API changes must never break the page.
      }
    });
  },
});
