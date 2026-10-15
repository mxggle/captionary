/** Netflix player manifest handling (pure functions, used by the page-world hook). */

export interface NetflixTrack {
  id: string;
  lang: string;
  label: string;
  forced: boolean;
  closedCaptions: boolean;
  vtt?: string;
  dfxp?: string;
}

export const VTT_PROFILE = 'webvtt-lssdh-ios8';
const DFXP_PROFILES = ['dfxp-ls-sdh', 'simplesdh'];

type Downloadable = { urls?: { url?: string }[]; downloadUrls?: Record<string, string> } | undefined;

function firstUrl(downloadable: Downloadable): string | undefined {
  if (!downloadable) return undefined;
  const fromList = Array.isArray(downloadable.urls) ? downloadable.urls.find((u) => u?.url)?.url : undefined;
  if (fromList) return String(fromList);
  const fromMap = downloadable.downloadUrls ? Object.values(downloadable.downloadUrls).find(Boolean) : undefined;
  return fromMap ? String(fromMap) : undefined;
}

interface RawTrack {
  language?: string;
  languageDescription?: string;
  isNoneTrack?: boolean;
  isForcedNarrative?: boolean;
  rawTrackType?: string;
  new_track_id?: string;
  id?: string;
  ttDownloadables?: Record<string, Downloadable>;
}

/**
 * Read subtitle tracks from a manifest response. Newer manifests list download URLs
 * under `urls[]`, older ones under `downloadUrls{cdnId: url}`; both are supported.
 */
export function extractNetflixTracks(manifest: unknown): { movieId: string; tracks: NetflixTrack[] } | null {
  const root = manifest as { result?: unknown } | null;
  const result = (root?.result ?? root) as { movieId?: string | number; timedtexttracks?: RawTrack[] } | null;
  const list = result?.timedtexttracks;
  if (!Array.isArray(list) || result?.movieId === undefined) return null;
  const tracks: NetflixTrack[] = [];
  for (const t of list) {
    if (!t || t.isNoneTrack || !t.ttDownloadables) continue;
    const vtt = firstUrl(t.ttDownloadables[VTT_PROFILE]);
    const dfxp = DFXP_PROFILES.map((p) => firstUrl(t.ttDownloadables![p])).find(Boolean);
    if (!vtt && !dfxp) continue;
    tracks.push({
      id: String(t.new_track_id ?? t.id ?? `${t.language}-${tracks.length}`),
      lang: String(t.language ?? ''),
      label: String(t.languageDescription ?? t.language ?? ''),
      forced: !!t.isForcedNarrative,
      closedCaptions: t.rawTrackType === 'closedcaptions',
      vtt,
      dfxp,
    });
  }
  return { movieId: String(result.movieId), tracks };
}

/**
 * Adjust an outgoing manifest request so the response includes WebVTT downloads and
 * every subtitle language (including those for dubbed audio). Returns true if changed.
 */
export function patchManifestRequest(value: unknown): boolean {
  const params = (value as { params?: { profiles?: unknown; showAllSubDubTracks?: boolean } } | null)?.params;
  if (!params || !Array.isArray(params.profiles)) return false;
  if (!params.profiles.includes(VTT_PROFILE)) params.profiles.push(VTT_PROFILE);
  params.showAllSubDubTracks = true;
  return true;
}
