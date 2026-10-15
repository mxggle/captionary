import { sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { parseMasterPlaylist, parseMediaPlaylist, type MasterPlaylist, type SubtitleRendition } from '@/lib/subtitles/hls';
import { parseVttOrSrt } from '@/lib/subtitles/parse';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { postToMain, requestMain } from '../bridge';
import type { SiteAdapter } from '../controller';

export interface AppleTvCurrent {
  master: { url: string; text: string } | null;
  nowPlaying: { id: string; title: string } | null;
}

const HIDE_STYLE_ID = 'lr-hide-native-captions';
export const PLAYER_DIALOG = 'dialog.playback-view[open]';

/** Apple's subtitle CDN allows any origin; fall back to the background if that ever changes. */
async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (res.ok) return await res.text();
  } catch {
    // CORS or network error: retry from the background
  }
  return bg({ type: 'fetch.text', url });
}

export class AppleTvAdapter implements SiteAdapter {
  readonly site = 'appletv' as const;
  private renditions = new Map<string, SubtitleRendition>();

  getVideo(): HTMLVideoElement | null {
    // Only the main player; show pages also autoplay a muted hero trailer elsewhere.
    return document.querySelector<HTMLVideoElement>(`${PLAYER_DIALOG} #main-video-container video`);
  }

  seek(seconds: number) {
    postToMain({ type: 'atv.seek', time: seconds });
  }

  play() {
    postToMain({ type: 'atv.play' });
  }

  pause() {
    postToMain({ type: 'atv.pause' });
  }

  setNativeSubtitlesHidden(hidden: boolean) {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (hidden && !style) {
      style = document.createElement('style');
      style.id = HIDE_STYLE_ID;
      style.textContent = '#main-video-container video::cue { opacity: 0 !important; }';
      (document.head ?? document.documentElement).append(style);
    } else if (!hidden && style) {
      style.remove();
    }
  }

  current(): Promise<AppleTvCurrent> {
    return requestMain<AppleTvCurrent>({ type: 'atv.getCurrent' }, 1500);
  }

  /** Read the subtitle renditions of a master playlist. */
  useMaster(url: string, text: string): { master: MasterPlaylist; tracks: TrackInfo[]; defaultId: string | null } {
    const master = parseMasterPlaylist(text, url);
    this.renditions.clear();
    for (const r of master.subtitles) this.renditions.set(r.id, r);
    const tracks = master.subtitles.map((r) => ({
      id: r.id,
      lang: r.lang,
      label: `${r.name}${r.sdh ? ' [SDH]' : ''}`,
      forced: r.forced,
    }));
    // The original language is the default audio language.
    const original = master.audioLang
      ? (master.subtitles.find((r) => !r.forced && !r.sdh && sameLang(r.lang, master.audioLang)) ??
        master.subtitles.find((r) => !r.forced && sameLang(r.lang, master.audioLang)))
      : undefined;
    return { master, tracks, defaultId: original?.id ?? null };
  }

  async loadTrack(trackId: string): Promise<Cue[]> {
    const rendition = this.renditions.get(trackId);
    if (!rendition) throw new Error('Unknown subtitle track');
    const playlist = await fetchText(rendition.uri);
    const files = parseMediaPlaylist(playlist, rendition.uri);
    if (!files.length) throw new Error('Empty subtitle playlist');
    const parts = await Promise.all(files.map(fetchText));
    // Segments may each carry a WEBVTT header; the parser skips blocks without timings.
    return parseVttOrSrt(parts.join('\n\n'));
  }
}
