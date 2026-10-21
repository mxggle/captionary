import { getCurrentUILocale, getMessages } from '@/lib/i18n';
import { bg } from '@/lib/messaging';
import { parseTtml, parseVttOrSrt } from '@/lib/subtitles/parse';
import type { NetflixTrack } from '@/lib/subtitles/netflix';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { FROM_MAIN, onMessageFrom, postToMain, requestMain } from '../bridge';
import type { SiteAdapter } from '../controller';

const HIDE_STYLE_ID = 'lr-hide-native-captions';
const ROOM_STYLE_ID = 'lr-drawer-room';

export class NetflixAdapter implements SiteAdapter {
  readonly site = 'netflix' as const;
  /** Rendered only while the controls show, so the captions rise with them like Netflix's own. */
  readonly controlBars = ['[data-uia="controls-standard"]', '[data-uia="timeline"]'];
  private tracks = new Map<string, NetflixTrack>();
  private listeners = new Set<(movieId: string, tracks: NetflixTrack[]) => void>();

  constructor() {
    onMessageFrom(FROM_MAIN, (msg) => {
      if (msg.type !== 'nf.tracks' || !Array.isArray(msg.tracks)) return;
      this.listeners.forEach((l) => l(String(msg.movieId), msg.tracks as NetflixTrack[]));
    });
  }

  static currentMovieId(): string | null {
    return location.pathname.match(/^\/watch\/(\d+)/)?.[1] ?? null;
  }

  getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>('.watch-video video') ?? document.querySelector('video');
  }

  seek(seconds: number) {
    postToMain({ type: 'nf.seek', time: seconds });
  }

  play() {
    postToMain({ type: 'nf.play' });
  }

  pause() {
    postToMain({ type: 'nf.pause' });
  }

  setNativeSubtitlesHidden(hidden: boolean) {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (hidden && !style) {
      style = document.createElement('style');
      style.id = HIDE_STYLE_ID;
      style.textContent = '.player-timedtext { visibility: hidden !important; }';
      (document.head ?? document.documentElement).append(style);
    } else if (!hidden && style) {
      style.remove();
    }
  }

  /**
   * `[data-uia="player"]` (video, timed text and controls) is absolutely positioned at inset 0 in
   * the player view, next to Captionary's overlay; pulling its right edge in letterboxes the video
   * (`object-fit: contain`) and lays the control bar out in the narrower width. Netflix writes the
   * video's pixel width itself and redoes it on window resize, not when the player grows back, so a
   * resize is sent after each change.
   */
  reserveRight(px: number) {
    let style = document.getElementById(ROOM_STYLE_ID);
    if (px <= 0) {
      if (!style) return;
      style.remove();
    } else {
      if (!style) {
        style = document.createElement('style');
        style.id = ROOM_STYLE_ID;
        (document.head ?? document.documentElement).append(style);
      }
      style.textContent = `.watch-video--player-view > [data-uia="player"] { right: ${px}px !important; }`;
    }
    window.dispatchEvent(new Event('resize'));
  }

  title(): string {
    const el = document.querySelector('[data-uia="video-title"]');
    if (el) {
      const parts = [...el.querySelectorAll('h4, span')].map((n) => n.textContent?.trim()).filter(Boolean);
      if (parts.length) return parts.join(' · ');
      if (el.textContent?.trim()) return el.textContent.trim();
    }
    return document.title.replace(/ ?[-|] ?Netflix$/, '') || 'Netflix';
  }

  /** Wait for the manifest of the given title (it arrives as the player starts). */
  async waitForTracks(movieId: string, timeoutMs = 15000): Promise<NetflixTrack[] | null> {
    try {
      const cached = await requestMain<NetflixTrack[] | null>({ type: 'nf.getTracks', movieId }, 1500);
      if (cached) return this.setTracks(cached);
    } catch {
      // main-world script not ready yet
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        resolve(null);
      }, timeoutMs);
      const listener = (id: string, tracks: NetflixTrack[]) => {
        if (id !== movieId) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(this.setTracks(tracks));
      };
      this.listeners.add(listener);
    });
  }

  private setTracks(tracks: NetflixTrack[]): NetflixTrack[] {
    this.tracks.clear();
    for (const t of tracks) this.tracks.set(t.id, t);
    return tracks;
  }

  trackInfos(tracks: NetflixTrack[]): TrackInfo[] {
    // Netflix can list the same language twice (one track per audio language); menus show it once.
    const seen = new Set<string>();
    return tracks
      .filter((t) => {
        const key = [t.lang.toLowerCase(), t.label, t.closedCaptions, t.forced].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => ({
        id: t.id,
        lang: t.lang,
        label: `${t.label}${t.closedCaptions ? ' (CC)' : ''}`,
        forced: t.forced,
        cc: t.closedCaptions,
        namedByLang: true,
      }));
  }

  async loadTrack(trackId: string): Promise<Cue[]> {
    const track = this.tracks.get(trackId);
    if (!track) throw new Error(getMessages(getCurrentUILocale()).content.errors.unknownSubtitleTrack);
    // Subtitle files live on Netflix's CDN; the background downloads them.
    if (track.vtt) return parseVttOrSrt(await bg({ type: 'fetch.text', url: track.vtt }));
    if (track.dfxp) return parseTtml(await bg({ type: 'fetch.text', url: track.dfxp }));
    throw new Error(getMessages(getCurrentUILocale()).content.errors.netflixNoDownloadableFormat);
  }
}
