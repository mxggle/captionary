import { sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import {
  parseMasterPlaylist,
  parseMediaPlaylist,
  planSubtitleParts,
  type MasterPlaylist,
  type SubtitleRendition,
  type TimelineDomain,
} from '@/lib/subtitles/hls';
import { normalizeCues, parseVttOrSrt } from '@/lib/subtitles/parse';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { postToMain, requestMain } from '../bridge';
import type { SiteAdapter } from '../controller';

export interface AppleTvCurrent {
  /** `text` is empty when the master is the one the caller already has. */
  master: { url: string; text: string } | null;
  nowPlaying: { id: string; title: string } | null;
}

/** How long to wait for the player to load its video playlist before falling back to subtitle timing. */
const TIMELINE_WAIT_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs of the player's video playlist, as reported by the page (untrusted, so checked). */
function readTimeline(data: unknown): TimelineDomain[] | null {
  if (!Array.isArray(data)) return null;
  const runs = data.filter(
    (d): d is TimelineDomain =>
      !!d && Number.isFinite(d.start) && Number.isFinite(d.duration) && (d.asset === null || typeof d.asset === 'string'),
  );
  return runs.length === data.length && runs.length ? runs : null;
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
  /** Apple's id of the episode or film (the stream also carries promos for other titles). */
  private featureAsset: string | null = null;
  private timeline: Promise<TimelineDomain[] | null> | null = null;

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

  /** The playing title's master playlist; its text is left out when it is still `knownUrl`. */
  current(knownUrl: string | null = null): Promise<AppleTvCurrent> {
    return requestMain<AppleTvCurrent>({ type: 'atv.getCurrent', knownUrl }, 1500);
  }

  /** Read the subtitle renditions of a master playlist. */
  useMaster(url: string, text: string): { master: MasterPlaylist; tracks: TrackInfo[]; defaultId: string | null } {
    const master = parseMasterPlaylist(text, url);
    this.renditions.clear();
    for (const r of master.subtitles) this.renditions.set(r.id, r);
    if ((master.adamId ?? null) !== this.featureAsset) {
      this.featureAsset = master.adamId ?? null;
      this.timeline = null;
    }
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
    this.timeline ??= this.videoTimeline(this.featureAsset);
    const [playlist, timeline] = await Promise.all([fetchText(rendition.uri), this.timeline]);
    if (!timeline) this.timeline = null; // look again on the next load
    const segments = parseMediaPlaylist(playlist, rendition.uri);
    if (!segments.length) throw new Error('Empty subtitle playlist');
    const parts = planSubtitleParts(segments, this.featureAsset, timeline);
    const cues = await Promise.all(
      parts.map(async ({ uris, offset }) => {
        // Segments may each carry a WEBVTT header; the parser skips blocks without timings.
        const text = (await Promise.all(uris.map(fetchText))).join('\n\n');
        return parseVttOrSrt(text).map((c) => ({ ...c, start: c.start + offset, end: c.end + offset }));
      }),
    );
    return normalizeCues(cues.flat());
  }

  /**
   * The runs of the video playlist the player is streaming, which define its clock. The player
   * loads it just after the master playlist, so wait a little for one that contains this title.
   */
  private async videoTimeline(asset: string | null): Promise<TimelineDomain[] | null> {
    const until = Date.now() + TIMELINE_WAIT_MS;
    for (;;) {
      const runs = readTimeline(await requestMain<unknown>({ type: 'atv.getTimeline' }, 1000).catch(() => null));
      if (runs && (!asset || runs.some((d) => d.asset === asset))) return runs;
      if (Date.now() >= until) return null;
      await sleep(400);
    }
  }
}
