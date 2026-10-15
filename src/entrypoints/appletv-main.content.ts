import { defineContentScript } from '#imports';
import { FROM_ISOLATED, onMessageFrom, postToIsolated } from '@/content/bridge';

interface Master {
  url: string;
  text: string;
  at: number;
}

interface HlsLike {
  url?: string;
  media?: HTMLMediaElement | null;
}

const isMaster = (text: unknown): text is string =>
  typeof text === 'string' && text.startsWith('#EXTM3U') && text.includes('TYPE=SUBTITLES');

function musicKit(): any {
  try {
    return (window as any).MusicKit?.getInstance?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Runs in tv.apple.com's page world:
 *  - keeps the HLS master playlists the player loads (subtitle renditions are listed there);
 *  - remembers which hls.js instance plays which <video>, so the master of the main player
 *    is not confused with the muted hero trailer on show pages;
 *  - plays, pauses and seeks through MusicKit, the player's own API.
 */
export default defineContentScript({
  matches: ['https://tv.apple.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const masters: Master[] = [];
    const players = new Set<HlsLike>();

    const remember = (url: string, text: string) => {
      const abs = new URL(url, location.href).toString();
      const existing = masters.findIndex((m) => m.url === abs);
      if (existing >= 0) masters.splice(existing, 1);
      masters.push({ url: abs, text, at: Date.now() });
      if (masters.length > 8) masters.shift();
      postToIsolated({ type: 'atv.master', url: abs });
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
      const u = String(url);
      if (u.includes('.m3u8')) {
        this.addEventListener('load', () => {
          try {
            const body = this.responseType === '' || this.responseType === 'text' ? this.responseText : '';
            if (isMaster(body)) remember(this.responseURL || u, body);
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
        if (u.includes('.m3u8')) {
          promise
            .then((r) =>
              r
                .clone()
                .text()
                .then((body) => isMaster(body) && remember(r.url || u, body)),
            )
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
      return promise;
    } as typeof window.fetch;

    // Track hls.js instances (loaded as the global `Hls`) to map masters to <video>s.
    const patchHls = (Hls: any) => {
      const proto = Hls?.prototype;
      if (!proto || proto.__lrPatched) return;
      proto.__lrPatched = true;
      const load = proto.loadSource;
      const attach = proto.attachMedia;
      if (typeof load === 'function') {
        proto.loadSource = function (this: HlsLike, url: string, ...rest: any[]) {
          this.url = new URL(url, location.href).toString();
          players.add(this);
          return load.call(this, url, ...rest);
        };
      }
      if (typeof attach === 'function') {
        proto.attachMedia = function (this: HlsLike, media: HTMLMediaElement, ...rest: any[]) {
          this.media = media;
          players.add(this);
          return attach.call(this, media, ...rest);
        };
      }
    };
    let hlsValue: unknown = (window as any).Hls;
    if (hlsValue) patchHls(hlsValue);
    try {
      Object.defineProperty(window, 'Hls', {
        configurable: true,
        get: () => hlsValue,
        set: (v) => {
          hlsValue = v;
          patchHls(v);
        },
      });
    } catch {
      // fall back to "latest master" matching
    }

    /** The master playlist of the video playing in the main player dialog. */
    const currentMaster = (): Master | null => {
      const video = document.querySelector('#main-video-container video');
      for (const p of players) {
        if (p.media && p.media === video && p.url) {
          const hit = masters.find((m) => m.url === p.url || m.url.split('?')[0] === p.url!.split('?')[0]);
          if (hit) return hit;
        }
      }
      // Fallback: masters loaded by other players (hero trailers) are excluded when known.
      const others = new Set([...players].filter((p) => p.media && p.media !== video).map((p) => p.url));
      return [...masters].reverse().find((m) => !others.has(m.url)) ?? null;
    };

    onMessageFrom(FROM_ISOLATED, (msg) => {
      try {
        switch (msg.type) {
          case 'atv.getCurrent': {
            const master = currentMaster();
            const item = musicKit()?.nowPlayingItem;
            postToIsolated({
              type: 'atv.reply',
              reqId: msg.reqId,
              data: { master, nowPlaying: item ? { id: String(item.id ?? ''), title: String(item.title ?? '') } : null },
            });
            break;
          }
          case 'atv.seek': {
            const mk = musicKit();
            if (mk?.seekToTime) void mk.seekToTime(Number(msg.time));
            else {
              const video = document.querySelector<HTMLVideoElement>('#main-video-container video');
              if (video) video.currentTime = Number(msg.time);
            }
            break;
          }
          case 'atv.play': {
            const mk = musicKit();
            if (mk?.play) void mk.play();
            else void document.querySelector<HTMLVideoElement>('#main-video-container video')?.play();
            break;
          }
          case 'atv.pause': {
            const mk = musicKit();
            if (mk?.pause) void mk.pause();
            else document.querySelector<HTMLVideoElement>('#main-video-container video')?.pause();
            break;
          }
        }
      } catch {
        // Player API changes must never break the page.
      }
    });
  },
});
