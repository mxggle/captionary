/** Minimal HLS playlist parsing for subtitle renditions (Apple TV+). */

/** Parse an attribute list such as `TYPE=SUBTITLES,NAME="English",URI="a,b.m3u8"`. */
export function parseAttributes(list: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(list))) attrs[m[1]] = m[3] !== undefined ? m[3] : m[2];
  return attrs;
}

export interface SubtitleRendition {
  id: string;
  lang: string;
  name: string;
  forced: boolean;
  /** Subtitles for the deaf and hard of hearing (sound descriptions included). */
  sdh: boolean;
  uri: string;
}

export interface MasterPlaylist {
  title?: string;
  /** Apple's stable id for the title (episode or film). */
  adamId?: string;
  /** Language of the default audio track (the original language). */
  audioLang?: string;
  subtitles: SubtitleRendition[];
}

function resolve(uri: string, base: string): string {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

/**
 * Read subtitle renditions from a master playlist. Apple lists every rendition once per
 * CDN pathway; duplicates are dropped (by STABLE-RENDITION-ID, else language+variant).
 * Order: per language, regular track first, then SDH, then forced.
 */
export function parseMasterPlaylist(text: string, baseUrl: string): MasterPlaylist {
  const out: MasterPlaylist = { subtitles: [] };
  const seen = new Set<string>();
  let defaultAudio: string | undefined;
  let firstAudio: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-SESSION-DATA:')) {
      const a = parseAttributes(line.slice(20));
      if (a['DATA-ID'] === 'com.apple.hls.title' && a.VALUE) out.title = a.VALUE;
      if (a['DATA-ID'] === 'com.apple.hls.feature.adam-id' && a.VALUE) out.adamId = a.VALUE;
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      const a = parseAttributes(line.slice(13));
      if (a.TYPE === 'AUDIO' && a.LANGUAGE) {
        const describes = /describes-video/.test(a.CHARACTERISTICS ?? '');
        if (!describes) {
          firstAudio ??= a.LANGUAGE;
          if (a.DEFAULT === 'YES') defaultAudio ??= a.LANGUAGE;
        }
      }
      if (a.TYPE !== 'SUBTITLES' || !a.URI || !a.LANGUAGE) continue;
      const forced = a.FORCED === 'YES';
      const sdh = /transcribes-spoken-dialog|describes-music-and-sound/.test(a.CHARACTERISTICS ?? '');
      const key = a['STABLE-RENDITION-ID'] ?? `${a.LANGUAGE}|${forced}|${sdh}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.subtitles.push({
        id: key,
        lang: a.LANGUAGE,
        name: (a.NAME ?? a.LANGUAGE).trim(),
        forced,
        sdh,
        uri: resolve(a.URI, baseUrl),
      });
    }
  }
  out.audioLang = defaultAudio ?? firstAudio;
  const rank = (r: SubtitleRendition) => (r.forced ? 2 : r.sdh ? 1 : 0);
  const firstIndex = new Map<string, number>();
  out.subtitles.forEach((r, i) => firstIndex.has(r.lang) || firstIndex.set(r.lang, i));
  out.subtitles.sort((a, b) => firstIndex.get(a.lang)! - firstIndex.get(b.lang)! || rank(a) - rank(b));
  return out;
}

export interface MediaSegment {
  uri: string;
  /** Position on the playlist's timeline: the sum of the EXTINF durations before it. */
  start: number;
  duration: number;
  /** Number of EXT-X-DISCONTINUITY tags before it. */
  discontinuity: number;
}

/** Segments of a media playlist, in order, on the playlist's own timeline. */
export function parseMediaPlaylist(text: string, baseUrl: string): MediaSegment[] {
  const segments: MediaSegment[] = [];
  let start = 0;
  let duration = 0;
  let discontinuity = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) duration = parseFloat(line.slice(8)) || 0;
    else if (line === '#EXT-X-DISCONTINUITY') discontinuity++;
    else if (line && !line.startsWith('#')) {
      segments.push({ uri: resolve(line, baseUrl), start, duration, discontinuity });
      start += duration;
      duration = 0;
    }
  }
  return segments;
}

/**
 * A run of segments between two discontinuities. Apple TV+ episodes are stitched streams:
 * an Apple TV ident, a promo for another title, the episode, then post-roll slots, each its
 * own run on one timeline. `asset` is Apple's id of the title a run belongs to.
 */
export interface TimelineDomain {
  start: number;
  duration: number;
  asset: string | null;
}

/** Apple's id of the title a segment belongs to, from names like `P1451997785_A1600701943_en_subtitles_V2-0.webvtt`. */
export function assetOf(uri: string): string | null {
  const file = uri.split('?')[0].split('/').pop() ?? '';
  return file.match(/_A(\d+)_/)?.[1] ?? null;
}

export function timelineDomains(segments: MediaSegment[]): (TimelineDomain & { uris: string[] })[] {
  const domains: (TimelineDomain & { uris: string[]; discontinuity: number })[] = [];
  for (const s of segments) {
    const last = domains[domains.length - 1];
    if (last && last.discontinuity === s.discontinuity) {
      last.duration += s.duration;
      if (!last.uris.includes(s.uri)) last.uris.push(s.uri);
    } else {
      domains.push({ start: s.start, duration: s.duration, asset: assetOf(s.uri), uris: [s.uri], discontinuity: s.discontinuity });
    }
  }
  return domains;
}

export interface SubtitlePart {
  /** Subtitle files of this run, each fetched whole (byte ranges into one file included). */
  uris: string[];
  /** Seconds to add to the files' cue times to put them on the player's clock. */
  offset: number;
}

/**
 * Which subtitle files belong to the title being watched, and where their cues sit on the
 * player's clock. The episode's WebVTT files count from the episode's own start (every run
 * begins at MPEGTS 900000 = its first frame), so its cues move by the start of the episode's
 * run, e.g. +39 s after an 8 s ident and a 31 s promo. That start comes from the player's video
 * playlist when it is known, because subtitle playlists round run durations differently
 * (8.126 s vs 8.008 s for the same ident). Runs of other titles (promos) and filler are dropped.
 */
export function planSubtitleParts(segments: MediaSegment[], featureAsset?: string | null, video?: TimelineDomain[] | null): SubtitlePart[] {
  const domains = timelineDomains(segments);
  const named = domains.filter((d) => d.asset);
  if (!named.length) {
    // No title ids in the file names: keep every run, matched to the video's runs by position.
    const runs = video?.length === domains.length ? video : null;
    return domains.map((d, i) => ({ uris: d.uris, offset: runs?.[i].start ?? d.start }));
  }
  const feature = featureAsset && named.some((d) => d.asset === featureAsset) ? featureAsset : longest(named).asset;
  const videoRuns = (video ?? []).filter((d) => d.asset === feature);
  const parts: SubtitlePart[] = [];
  // The title's own clock at the start of its next run (a mid-roll would split it into several).
  let local = 0;
  for (const d of domains) {
    if (d.asset !== feature) continue;
    const ref = videoRuns[parts.length];
    parts.push({ uris: d.uris, offset: (ref?.start ?? d.start) - local });
    local += ref?.duration ?? d.duration;
  }
  return parts;
}

function longest<T extends { duration: number }>(items: T[]): T {
  return items.reduce((a, b) => (b.duration > a.duration ? b : a));
}

export function isSubtitleMaster(text: string): boolean {
  return text.startsWith('#EXTM3U') && text.includes('TYPE=SUBTITLES');
}
