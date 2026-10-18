import { getCurrentUILocale, getMessages } from '@/lib/i18n';
import { bg } from '@/lib/messaging';
import { parseTtml, parseVttOrSrt } from '@/lib/subtitles/parse';
import type { NetflixTrack } from '@/lib/subtitles/netflix';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { FROM_MAIN, onMessageFrom, postToMain, requestMain } from '../bridge';
import type { SiteAdapter } from '../controller';

const HIDE_STYLE_ID = 'lr-hide-native-captions';

export class NetflixAdapter implements SiteAdapter {
  readonly site = 'netflix' as const;
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
    return tracks.map((t) => ({
      id: t.id,
      lang: t.lang,
      label: `${t.label}${t.closedCaptions ? ' [CC]' : ''}`,
      forced: t.forced,
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
