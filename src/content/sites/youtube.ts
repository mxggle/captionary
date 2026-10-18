import { getCurrentUILocale, getMessages } from '@/lib/i18n';
import { sameLang } from '@/lib/languages';
import { parseYouTubeJson3 } from '@/lib/subtitles/parse';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { FROM_MAIN, onMessageFrom, postToMain, requestMain } from '../bridge';
import type { SiteAdapter } from '../controller';

interface YtTrack {
  baseUrl: string;
  lang: string;
  name: string;
  kind: string;
  vssId: string;
}

export interface YtPlayerData {
  videoId: string | null;
  title: string;
  /** The player's latest caption request with a token, if it made one before we asked. */
  tokenUrl?: string | null;
  tracks: YtTrack[];
  defaultIndex: number | null;
  translationLanguages: { code: string; name: string }[];
}

/** Query parameters carrying YouTube's proof-of-origin token and client identity. */
const TOKEN_PARAMS = ['pot', 'potc', 'c', 'cver', 'cplayer', 'cos', 'cosver', 'cbr', 'cbrver', 'cplatform', 'xorb', 'xobt', 'xovt'];

const HIDE_STYLE_ID = 'lr-hide-native-captions';

/** How long a preroll ad may hold up the first caption request. */
const AD_WAIT_MS = 5 * 60_000;

export class YouTubeAdapter implements SiteAdapter {
  readonly site = 'youtube' as const;
  private tracks = new Map<string, YtTrack>();
  private translationLanguages: YtPlayerData['translationLanguages'] = [];
  private videoId: string | null = null;
  /** Token params captured from the player's own caption request, per video. */
  private tokens = new Map<string, URLSearchParams>();
  private tokenWaiters: (() => void)[] = [];
  /** Called with the video id whenever the player makes a caption request with a token. */
  onToken: ((videoId: string) => void) | null = null;

  constructor() {
    onMessageFrom(FROM_MAIN, (msg) => {
      if (msg.type === 'yt.timedtext' && typeof msg.url === 'string') this.takeToken(msg.url);
    });
  }

  private takeToken(raw: string) {
    try {
      const url = new URL(raw);
      const v = url.searchParams.get('v');
      if (!v || !url.searchParams.has('pot')) return;
      this.tokens.set(v, url.searchParams);
      this.tokenWaiters.splice(0).forEach((w) => w());
      this.onToken?.(v);
    } catch {
      // ignore malformed URLs
    }
  }

  adShowing(): boolean {
    return !!document.querySelector('#movie_player.ad-showing');
  }

  getVideo(): HTMLVideoElement | null {
    return (
      document.querySelector<HTMLVideoElement>('#movie_player video.html5-main-video') ??
      document.querySelector<HTMLVideoElement>('#movie_player video')
    );
  }

  seek(seconds: number) {
    const video = this.getVideo();
    if (video) video.currentTime = seconds;
  }

  play() {
    void this.getVideo()
      ?.play()
      .catch(() => undefined);
  }

  pause() {
    this.getVideo()?.pause();
  }

  setNativeSubtitlesHidden(hidden: boolean) {
    let style = document.getElementById(HIDE_STYLE_ID);
    if (hidden && !style) {
      style = document.createElement('style');
      style.id = HIDE_STYLE_ID;
      style.textContent = '.ytp-caption-window-container, .caption-window { display: none !important; }';
      (document.head ?? document.documentElement).append(style);
    } else if (!hidden && style) {
      style.remove();
    }
  }

  /** Current video id from the URL (watch pages and shorts are not the same layout). */
  static currentVideoId(): string | null {
    if (location.pathname !== '/watch') return null;
    return new URLSearchParams(location.search).get('v');
  }

  /** Read the player data for the current video, waiting for the player to catch up after navigation. */
  async loadPlayerData(videoId: string, timeoutMs = 8000): Promise<YtPlayerData | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const data = await requestMain<YtPlayerData>({ type: 'yt.getPlayerData' }, 1500);
        if (data?.videoId === videoId) {
          this.setPlayerData(data);
          return data;
        }
      } catch {
        // main-world script not ready yet
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return null;
  }

  private setPlayerData(data: YtPlayerData) {
    this.videoId = data.videoId;
    if (data.tokenUrl) this.takeToken(data.tokenUrl);
    this.translationLanguages = data.translationLanguages;
    this.tracks.clear();
    for (const t of data.tracks) this.tracks.set(t.vssId || `${t.lang}:${t.kind}`, t);
  }

  trackInfos(data: YtPlayerData): { tracks: TrackInfo[]; defaultId: string | null } {
    const tracks = data.tracks.map((t) => ({
      id: t.vssId || `${t.lang}:${t.kind}`,
      lang: t.lang,
      label: t.name || t.lang,
      auto: t.kind === 'asr',
    }));
    const def = data.defaultIndex !== null ? tracks[data.defaultIndex] : undefined;
    return { tracks, defaultId: def?.id ?? null };
  }

  private buildUrl(track: YtTrack, tlang?: string): URL {
    const url = new URL(track.baseUrl, location.origin);
    url.searchParams.set('fmt', 'json3');
    if (tlang) url.searchParams.set('tlang', tlang);
    else url.searchParams.delete('tlang');
    const token = this.videoId ? this.tokens.get(this.videoId) : undefined;
    if (token) {
      for (const key of TOKEN_PARAMS) {
        const value = token.get(key);
        if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
    }
    return url;
  }

  private waitForToken(videoId: string, timeoutMs: number): Promise<boolean> {
    if (this.tokens.has(videoId)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(this.tokens.has(videoId)), timeoutMs);
      this.tokenWaiters.push(() => {
        if (this.tokens.has(videoId)) {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  private async fetchCues(track: YtTrack, tlang?: string): Promise<Cue[]> {
    const get = async () => {
      const res = await fetch(this.buildUrl(track, tlang), { credentials: 'include' });
      return res.ok ? res.text() : '';
    };
    let body = await get();
    const videoId = this.videoId;
    if (!body.trim() && videoId && !this.tokens.has(videoId)) {
      // Captions need the player's token: have the player load captions once. It fetches the
      // video's captions only after a preroll ad, so wait that out first.
      const deadline = Date.now() + AD_WAIT_MS;
      while (this.adShowing() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
      postToMain({ type: 'yt.enableCaptions', lang: track.lang });
      if (await this.waitForToken(videoId, 8000)) body = await get();
    }
    if (!body.trim()) {
      throw new Error(getMessages(getCurrentUILocale()).content.errors.youtubeNoSubtitlesReturned);
    }
    return parseYouTubeJson3(JSON.parse(body));
  }

  async loadTrack(trackId: string): Promise<Cue[]> {
    const track = this.tracks.get(trackId);
    if (!track) throw new Error(getMessages(getCurrentUILocale()).content.errors.unknownSubtitleTrack);
    return this.fetchCues(track);
  }

  async loadPlatformTranslation(trackId: string, lang: string): Promise<Cue[]> {
    const track = this.tracks.get(trackId);
    if (!track) throw new Error(getMessages(getCurrentUILocale()).content.errors.unknownSubtitleTrack);
    const code = this.translationLanguages.find((l) => sameLang(l.code, lang))?.code ?? ytLangCode(lang);
    return this.fetchCues(track, code);
  }
}

function ytLangCode(lang: string): string {
  if (lang === 'zh-CN') return 'zh-Hans';
  if (lang === 'zh-TW') return 'zh-Hant';
  return lang;
}
