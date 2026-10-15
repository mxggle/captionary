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

/** Distinct segment files of a media playlist (byte ranges into one file are fetched whole). */
export function parseMediaPlaylist(text: string, baseUrl: string): string[] {
  const uris: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const uri = resolve(line, baseUrl);
    if (!uris.includes(uri)) uris.push(uri);
  }
  return uris;
}

export function isSubtitleMaster(text: string): boolean {
  return text.startsWith('#EXTM3U') && text.includes('TYPE=SUBTITLES');
}
