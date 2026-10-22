import { getCurrentUILocale, getMessages } from '@/lib/i18n';
import { sameLang } from '@/lib/languages';
import { parseYouTubeJson3 } from '@/lib/subtitles/parse';
import { type Cue, type TrackInfo, SubtitleLoadError } from '@/lib/subtitles/types';
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
  readonly controlBars = ['.ytp-chrome-bottom', '.ytp-progress-bar-container'];
  private tracks = new Map<string, YtTrack>();
  private translationLanguages: YtPlayerData['translationLanguages'] = [];
  private videoId: string | null = null;
  /** Token params captured from the player's own caption request, per video. */
  private tokens = new Map<string, URLSearchParams>();
  /** Each returns true once it is done with. */
  private tokenWaiters: (() => boolean)[] = [];
  /**
   * The captions Captionary asked the player to load, until a request brings their token. The player
   * can't sign the request before its token minter is ready: it then comes back empty and the player
   * doesn't fetch the track again by itself.
   */
  private awaiting: { videoId: string; lang: string } | null = null;
  /** Called with the video id whenever the player makes a caption request with a token. */
  onToken: ((videoId: string) => void) | null = null;

  constructor() {
    onMessageFrom(FROM_MAIN, (msg) => {
      if (msg.type === 'yt.timedtext' && typeof msg.url === 'string') this.takeToken(msg.url);
      else if (msg.type === 'yt.potReady') this.onPotReady();
    });
  }

  private takeToken(raw: string) {
    try {
      const url = new URL(raw);
      const v = url.searchParams.get('v');
      if (!v || !url.searchParams.has('pot')) return;
      this.tokens.set(v, url.searchParams);
      if (this.awaiting?.videoId === v) this.awaiting = null;
      this.tokenWaiters = this.tokenWaiters.filter((done) => !done());
      this.onToken?.(v);
    } catch {
      // ignore malformed URLs
    }
  }

  /** The player can sign caption requests now: ask again for captions it loaded before it could. */
  private onPotReady() {
    const awaiting = this.awaiting;
    if (awaiting && awaiting.videoId === this.videoId) this.askPlayer(awaiting.videoId, awaiting.lang);
  }

  /** Have the player load captions, to reuse the token its request carries. */
  private askPlayer(videoId: string, lang: string) {
    this.awaiting = { videoId, lang };
    postToMain({ type: 'yt.enableCaptions', lang });
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
      // ".ja" and "a.en" are standard tracks named after their language; a named track ("English – SDH")
      // has an id of its own after the language and keeps the name the uploader gave it.
      namedByLang: /^a?\.[^.]+$/.test(t.vssId),
    }));
    const def = data.defaultIndex !== null ? tracks[data.defaultIndex] : undefined;
    return { tracks, defaultId: def?.id ?? null };
  }

  private buildUrl(track: YtTrack, tlang: string | undefined, token: URLSearchParams | undefined): URL {
    const url = new URL(track.baseUrl, location.origin);
    url.searchParams.set('fmt', 'json3');
    if (tlang) url.searchParams.set('tlang', tlang);
    else url.searchParams.delete('tlang');
    if (token) {
      for (const key of TOKEN_PARAMS) {
        const value = token.get(key);
        if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
    }
    return url;
  }

  /** Wait for a token for the video other than `used`, which a request just got no captions with. */
  private waitForToken(videoId: string, used: URLSearchParams | undefined, timeoutMs: number): Promise<boolean> {
    const fresh = () => this.tokens.get(videoId) !== used;
    if (fresh()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = () => {
        if (!fresh()) return false;
        clearTimeout(timer);
        resolve(true);
        return true;
      };
      const timer = setTimeout(() => {
        this.tokenWaiters = this.tokenWaiters.filter((w) => w !== done);
        resolve(false);
      }, timeoutMs);
      this.tokenWaiters.push(done);
    });
  }

  private async fetchCues(track: YtTrack, tlang?: string): Promise<Cue[]> {
    const videoId = this.videoId;
    let askedPlayer = false;
    for (;;) {
      const token = videoId ? this.tokens.get(videoId) : undefined;
      const res = await fetch(this.buildUrl(track, tlang, token), { credentials: 'include' });
      const body = res.ok ? await res.text() : '';
      if (body.trim()) return parseYouTubeJson3(JSON.parse(body));
      if (!videoId) break;
      // Captions need the player's token. One that came in while this request was out (the player
      // fetched captions itself) is what it lacked.
      if (this.tokens.get(videoId) !== token) continue;
      if (askedPlayer) break;
      askedPlayer = true;
      // Otherwise have the player load captions once and reuse the token its request carries. It
      // fetches the video's captions only after a preroll ad, so wait that out first.
      const deadline = Date.now() + AD_WAIT_MS;
      while (this.adShowing() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
      if (this.tokens.get(videoId) === token) this.askPlayer(videoId, track.lang);
      if (!(await this.waitForToken(videoId, token, 8000))) break;
    }
    throw new SubtitleLoadError(getMessages(getCurrentUILocale()).content.errors.youtubeNoSubtitlesReturned);
  }

  async loadTrack(trackId: string): Promise<Cue[]> {
    const track = this.tracks.get(trackId);
    if (!track) throw new SubtitleLoadError(getMessages(getCurrentUILocale()).content.errors.unknownSubtitleTrack);
    return this.fetchCues(track);
  }

  async loadPlatformTranslation(trackId: string, lang: string): Promise<Cue[]> {
    const track = this.tracks.get(trackId);
    if (!track) throw new SubtitleLoadError(getMessages(getCurrentUILocale()).content.errors.unknownSubtitleTrack);
    const code = this.translationLanguages.find((l) => sameLang(l.code, lang))?.code ?? ytLangCode(lang);
    return this.fetchCues(track, code);
  }
}

function ytLangCode(lang: string): string {
  if (lang === 'zh-CN') return 'zh-Hans';
  if (lang === 'zh-TW') return 'zh-Hant';
  return lang;
}
