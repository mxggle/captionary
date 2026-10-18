import { getMessages, resolveUILocale, syncUILocaleFromSettings } from '@/lib/i18n';
import { normalizeLang, sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { getSettings, updateSettings, watchSettings, type Settings, type ShortcutAction } from '@/lib/settings';
import { alignTracks, cueIndexAt, cueIndexBefore } from '@/lib/subtitles/parse';
import { buildRankMap } from '@/lib/text/frequency-map';
import { canRomanize } from '@/lib/text/romanize';
import type { Cue, TrackInfo, TranslationSource } from '@/lib/subtitles/types';
import { chromeTranslatorState, translateLines } from '@/lib/translate';
import { listVocab, saveVocab, watchVocab, type SaveInput, type VocabItem } from '@/lib/vocab';
import { getSession, setSession, type AnchorRect, type MediaInfo, type PopupTarget } from './store';

export interface SiteAdapter {
  site: 'youtube' | 'netflix' | 'appletv' | 'local';
  getVideo(): HTMLVideoElement | null;
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  loadTrack(trackId: string): Promise<Cue[]>;
  /** Platform machine translation (YouTube's auto-translate). */
  loadPlatformTranslation?(trackId: string, lang: string): Promise<Cue[]>;
  setNativeSubtitlesHidden(hidden: boolean): void;
}

/** Seconds before a cue's end at which auto-pause triggers (one animation frame of slack). */
const AUTO_PAUSE_LEAD = 0.06;

/** A short confirmation over the video (`VideoToast`); one at a time, a new one replaces the old. */
export interface ToastMessage {
  text: string;
  /** The key that triggered the change, shown after the text. */
  key?: string;
  /** A dot before the text: the highlighter for something switched on, warn for a problem. */
  tone?: 'learn' | 'warn';
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const toastListeners = new Set<(message: ToastMessage | null) => void>();
export function toast(text: string, opts: Omit<ToastMessage, 'text'> = {}) {
  const message = { text, ...opts };
  toastListeners.forEach((l) => l(message));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastListeners.forEach((l) => l(null)), 1600);
}

/** What the toolbar pop-up shows under "On this tab". */
export interface TabStatus {
  site: SiteAdapter['site'];
  /** Captionary is on, globally and for this site. */
  enabled: boolean;
  title: string | null;
  status: 'idle' | 'loading' | 'ready' | 'none' | 'error';
  message?: string;
  lines: number;
  off: boolean;
  listOpen: boolean;
  autoPause: boolean;
}

/** Provides the on-screen rectangle of the current subtitle line (set by the overlay). */
export const lineAnchor: { get: (() => AnchorRect | null) | null } = { get: null };

/** Provides the on-screen rectangle of the subtitle drawer while it is open (set by the drawer). */
export const drawerAnchor: { get: (() => AnchorRect | null) | null } = { get: null };

export class SessionController {
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  /** Cue index for which auto-pause is armed; -1 = none. */
  private armed = -1;
  private pausedByHover = false;
  private generation = 0;
  private translationAbort: AbortController | null = null;
  private cleanups: (() => void)[] = [];

  constructor(public adapter: SiteAdapter) {}

  async init(): Promise<void> {
    const settings = await getSettings();
    syncUILocaleFromSettings(settings);
    setSession({ settings, site: this.adapter.site });
    this.applyNativeHidden();
    this.cleanups.push(
      watchSettings((next) => {
        const prev = getSession().settings;
        syncUILocaleFromSettings(next);
        setSession({ settings: next });
        this.applyNativeHidden();
        if (
          prev.nativeLanguage !== next.nativeLanguage ||
          prev.targetLanguage !== next.targetLanguage ||
          prev.subtitles.translationEngine !== next.subtitles.translationEngine
        ) {
          void this.reloadForSettings(prev);
        }
        if (!prev.subtitles.showRomanization && next.subtitles.showRomanization) void this.loadRomanizations(this.generation);
        if (!prev.subtitles.frequencyColors && next.subtitles.frequencyColors) void this.loadFrequency();
      }),
    );
    const items = await listVocab();
    setSession({ vocab: Object.fromEntries(items.map((i) => [i.id, i])) });
    this.cleanups.push(
      watchVocab((changes) => {
        const vocab = { ...getSession().vocab };
        for (const { id, item } of changes) {
          if (item) vocab[id] = item;
          else delete vocab[id];
        }
        setSession({ vocab });
      }),
    );
    void this.refreshAIStatus();
    const onKey = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener('keydown', onKey, true);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey, true));
    const onFs = () => setSession({ fullscreen: !!document.fullscreenElement });
    document.addEventListener('fullscreenchange', onFs);
    this.cleanups.push(() => document.removeEventListener('fullscreenchange', onFs));
  }

  destroy() {
    this.detachVideo();
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.translationAbort?.abort();
  }

  async refreshAIStatus() {
    try {
      setSession({ aiStatus: await bg({ type: 'ai.status' }) });
    } catch {
      setSession({ aiStatus: null });
    }
  }

  // ---------- video binding & sync loop ----------

  attachVideo(video: HTMLVideoElement | null) {
    if (video === this.video) return;
    this.detachVideo();
    this.video = video;
    if (!video) return;
    const onPlay = () => {
      setSession({ playing: true });
      this.startLoop();
    };
    const onPause = () => {
      setSession({ playing: false });
      this.sync();
    };
    const onRate = () => setSession({ rate: video.playbackRate });
    const onSeeked = () => {
      this.sync();
      // Arm auto-pause for the cue we landed in, so it pauses at its end.
      const idx = cueIndexAt(getSession().cues, video.currentTime);
      this.armed = idx;
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ratechange', onRate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', this.sync);
    this.cleanupVideo = () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', this.sync);
    };
    setSession({ playing: !video.paused, rate: video.playbackRate });
    if (!video.paused) this.startLoop();
  }

  private cleanupVideo: (() => void) | null = null;

  private detachVideo() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanupVideo?.();
    this.cleanupVideo = null;
    this.video = null;
  }

  private startLoop() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0;
      this.sync();
      if (this.video && !this.video.paused) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  currentTime(): number {
    return this.video?.currentTime ?? 0;
  }

  private sync = () => {
    const video = this.video;
    if (!video) return;
    const state = getSession();
    const { cues, activeIndex, settings } = state;
    const t = video.currentTime;
    if (state.adShowing) return;

    // Auto-pause at the end of the armed cue (checked before switching cues so
    // back-to-back subtitles still pause between them).
    if (settings.playback.autoPause && !video.paused && this.armed >= 0 && this.armed < cues.length) {
      const cue = cues[this.armed];
      if (t >= cue.end - AUTO_PAUSE_LEAD && t < cue.end + 1.5) {
        this.armed = -1;
        this.adapter.pause();
        return;
      }
    }

    const idx = cueIndexAt(cues, t);
    if (idx !== activeIndex) {
      const patch: Partial<typeof state> = { activeIndex: idx };
      if (idx >= 0) {
        patch.lastIndex = idx;
        if (!video.paused) this.armed = idx;
      }
      setSession(patch);
    }
  };

  // ---------- navigation ----------

  /** The cue the learner is "on": the active one, or the last one heard during a gap. */
  currentCueIndex(): number {
    const { activeIndex, cues } = getSession();
    if (activeIndex >= 0) return activeIndex;
    return cueIndexBefore(cues, this.currentTime());
  }

  playCue(index: number) {
    const { cues } = getSession();
    if (index < 0 || index >= cues.length) return;
    this.armed = index;
    this.adapter.seek(cues[index].start + 0.01);
    setSession({ activeIndex: index, lastIndex: index });
    this.adapter.play();
  }

  prev() {
    this.playCue(Math.max(0, this.currentCueIndex() - 1));
  }

  next() {
    const { cues } = getSession();
    this.playCue(Math.min(cues.length - 1, this.currentCueIndex() + 1));
  }

  repeat() {
    this.playCue(Math.max(0, this.currentCueIndex()));
  }

  togglePlay() {
    if (!this.video) return;
    if (this.video.paused) this.adapter.play();
    else this.adapter.pause();
  }

  setRate(rate: number) {
    if (!this.video) return;
    const clamped = Math.round(Math.min(4, Math.max(0.25, rate)) * 100) / 100;
    this.video.playbackRate = clamped;
    setSession({ rate: clamped });
    const m = getMessages(resolveUILocale(getSession().settings));
    toast(m.content.toast.speed(clamped));
  }

  hoverStart() {
    const { settings } = getSession();
    if (settings.playback.pauseOnHover && this.video && !this.video.paused) {
      this.pausedByHover = true;
      this.adapter.pause();
    }
  }

  hoverEnd() {
    if (this.pausedByHover && !getSession().popup) {
      this.pausedByHover = false;
      this.adapter.play();
    }
  }

  /** Stop the hover logic from resuming playback (e.g. after a click). */
  keepPaused() {
    this.pausedByHover = false;
    if (this.video && !this.video.paused) this.adapter.pause();
  }

  // ---------- Captionary on/off for this video, the player menu, the subtitle list ----------

  /** Hide the site's own captions while Captionary draws its own. */
  applyNativeHidden() {
    const { settings, off } = getSession();
    this.adapter.setNativeSubtitlesHidden(settings.enabled && !off && settings.subtitles.hideNativeSubtitles);
  }

  /** Turn Captionary off (or back on) for the video being watched; off restores the host's captions. */
  setOff(off: boolean) {
    setSession({ off, popup: null, drawerOpen: off ? false : getSession().drawerOpen });
    this.applyNativeHidden();
  }

  openMenu(anchor: AnchorRect | null) {
    setSession({ menuOpen: true, menuAnchor: anchor, popup: null });
  }

  closeMenu() {
    if (getSession().menuOpen) setSession({ menuOpen: false });
  }

  toggleMenu(anchor: AnchorRect | null) {
    if (getSession().menuOpen) this.closeMenu();
    else this.openMenu(anchor);
  }

  /**
   * Where the subtitle list lives right now: YouTube's side column (and the reader's), or a drawer
   * over the video in fullscreen and on Netflix and Apple TV+.
   */
  listMode(): 'panel' | 'drawer' {
    const { site, fullscreen } = getSession();
    if (site === 'local') return 'panel';
    return site === 'youtube' && !fullscreen ? 'panel' : 'drawer';
  }

  isListOpen(): boolean {
    const { settings, drawerOpen } = getSession();
    return this.listMode() === 'panel' ? settings.sidebar.open : drawerOpen;
  }

  toggleList() {
    if (this.listMode() === 'panel') void updateSettings((s) => void (s.sidebar.open = !s.sidebar.open));
    else setSession({ drawerOpen: !getSession().drawerOpen, popup: null });
  }

  tabStatus(): TabStatus {
    const { settings, media, status, message, cues, off } = getSession();
    const site = this.adapter.site;
    return {
      site,
      enabled: settings.enabled && (site === 'local' || settings.sites[site]),
      title: media?.title ?? null,
      status,
      message,
      lines: cues.length,
      off,
      listOpen: this.isListOpen(),
      autoPause: settings.playback.autoPause,
    };
  }

  // ---------- pop-up ----------

  openPopup(target: Omit<PopupTarget, 'lang' | 'before' | 'after' | 'sentence' | 'translation' | 'time'> & Partial<PopupTarget>) {
    const { cues, translations, lang } = getSession();
    const i = target.cueIndex;
    const cue = cues[i];
    this.keepPaused();
    setSession({
      menuOpen: false,
      popup: {
        lang,
        sentence: cue?.text ?? target.text,
        translation: translations[i],
        before: i > 0 ? cues.slice(Math.max(0, i - 2), i).map((c) => c.text) : [],
        after: cue ? cues.slice(i + 1, i + 3).map((c) => c.text) : [],
        time: cue?.start,
        ...target,
      },
    });
  }

  closePopup() {
    setSession({ popup: null });
  }

  private fallbackAnchor(): AnchorRect {
    const r = this.video?.getBoundingClientRect();
    if (!r) return { left: innerWidth / 2 - 100, top: innerHeight - 160, width: 200, height: 40 };
    return { left: r.left + r.width / 2 - 150, top: r.bottom - r.height * 0.2, width: 300, height: 40 };
  }

  explainCurrentLine() {
    const i = this.currentCueIndex();
    const cue = getSession().cues[i];
    if (!cue) return;
    this.openPopup({
      kind: 'sentence',
      text: cue.text,
      cueIndex: i,
      rect: lineAnchor.get?.() ?? this.fallbackAnchor(),
      surface: 'overlay',
    });
  }

  async saveCurrentLine() {
    await this.saveLine(this.currentCueIndex());
  }

  /** Save a subtitle line as a phrase. */
  async saveLine(i: number) {
    const { cues, translations, lang, media, settings } = getSession();
    const cue = cues[i];
    if (!cue || !lang) return;
    await saveVocab({
      lang,
      text: cue.text,
      translation: translations[i],
      context: this.contextFor(i, media),
    });
    const m = getMessages(resolveUILocale(settings));
    toast(m.content.toast.lineSaved, { key: keyName(settings.shortcuts.saveLine, m.common.space), tone: 'learn' });
  }

  /** Load the subtitles again after an error. */
  retry() {
    const { originalTrackId } = getSession();
    if (originalTrackId) void this.selectOriginalTrack(originalTrackId);
    else location.reload();
  }

  contextFor(i: number, media: MediaInfo | null) {
    const { cues, translations, site } = getSession();
    return {
      sentence: cues[i]?.text ?? '',
      translation: translations[i],
      title: media?.title,
      url: media?.url ?? location.href,
      time: cues[i]?.start,
      site,
    };
  }

  // ---------- keyboard ----------

  private onKeyDown(e: KeyboardEvent) {
    const { settings, cues } = getSession();
    if (!settings.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    // Esc closes the look-up (even while typing a follow-up question in it), then the menu, then the drawer.
    if (e.key === 'Escape') {
      const { popup, menuOpen, drawerOpen } = getSession();
      if (popup) this.closePopup();
      else if (menuOpen) this.closeMenu();
      else if (drawerOpen) setSession({ drawerOpen: false });
      else return;
      e.stopPropagation();
      return;
    }
    const target = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const key = e.key.toLowerCase();
    const action = (Object.entries(settings.shortcuts) as [ShortcutAction, string][]).find(([, k]) => k && k.toLowerCase() === key)?.[0];
    if (!action) return;
    // Subtitle navigation only makes sense once subtitles are loaded.
    if (!cues.length && ['prevLine', 'nextLine', 'repeatLine', 'explainLine', 'saveLine'].includes(action)) return;
    // While Captionary is off for this video, only the key that shows the list still works.
    if (getSession().off && action !== 'toggleSidebar') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.runAction(action);
  }

  runAction(action: ShortcutAction) {
    const { settings } = getSession();
    const m = getMessages(resolveUILocale(settings));
    const patchSettings = (fn: (s: Settings) => void) => void updateSettings(fn);
    const key = keyName(settings.shortcuts[action], m.common.space);
    switch (action) {
      case 'prevLine':
        return this.prev();
      case 'nextLine':
        return this.next();
      case 'repeatLine':
        return this.repeat();
      case 'togglePlay':
        return this.togglePlay();
      case 'toggleAutoPause': {
        const on = !settings.playback.autoPause;
        toast(on ? m.content.toast.autoPauseOn : m.content.toast.autoPauseOff, { key, tone: on ? 'learn' : undefined });
        return patchSettings((s) => void (s.playback.autoPause = on));
      }
      case 'toggleTranslation':
        toast(settings.subtitles.showTranslation ? m.content.toast.translationHidden : m.content.toast.translationShown, { key });
        return patchSettings((s) => void (s.subtitles.showTranslation = !s.subtitles.showTranslation));
      case 'toggleOriginal':
        toast(settings.subtitles.showOriginal ? m.content.toast.originalHidden : m.content.toast.originalShown, { key });
        return patchSettings((s) => void (s.subtitles.showOriginal = !s.subtitles.showOriginal));
      case 'toggleSidebar':
        if (getSession().off) this.setOff(false);
        return this.toggleList();
      case 'slower':
        return this.setRate((this.video?.playbackRate ?? 1) - settings.playback.rateStep);
      case 'faster':
        return this.setRate((this.video?.playbackRate ?? 1) + settings.playback.rateStep);
      case 'explainLine':
        return this.explainCurrentLine();
      case 'saveLine':
        return void this.saveCurrentLine();
    }
  }

  // ---------- tracks & translations ----------

  /** Pick the subtitle track for the language being learned. */
  pickOriginalTrack(tracks: TrackInfo[], defaultTrackId: string | null, settings: Settings): TrackInfo | null {
    const usable = tracks.filter((t) => !t.forced);
    const byPreference = (list: TrackInfo[]) => list.find((t) => !t.auto) ?? list[0] ?? null;
    if (settings.targetLanguage !== 'auto') {
      const match = byPreference(usable.filter((t) => sameLang(t.lang, settings.targetLanguage)));
      if (match) return match;
    }
    const def = usable.find((t) => t.id === defaultTrackId);
    if (def) {
      // Prefer a human track in the same language over automatic captions.
      return byPreference(usable.filter((t) => sameLang(t.lang, def.lang))) ?? def;
    }
    return byPreference(usable.filter((t) => t.auto)) ?? byPreference(usable);
  }

  /** Start a new video. */
  async startMedia(media: MediaInfo, tracks: TrackInfo[], defaultTrackId: string | null) {
    const gen = ++this.generation;
    this.translationAbort?.abort();
    const { settings } = getSession();
    const m = getMessages(resolveUILocale(settings));
    setSession({
      media,
      tracks,
      cues: [],
      translations: [],
      romanizations: [],
      activeIndex: -1,
      lastIndex: -1,
      popup: null,
      off: false,
      translationStatus: 'idle',
      translationMessage: undefined,
      translationSource: { type: 'none' },
    });
    this.applyNativeHidden();
    const track = this.pickOriginalTrack(tracks, defaultTrackId, settings);
    if (!track) {
      setSession({ status: 'none', message: m.content.errors.noSubtitles, originalTrackId: null, lang: '' });
      return;
    }
    await this.selectOriginalTrack(track.id, gen);
  }

  async selectOriginalTrack(trackId: string, gen = ++this.generation) {
    const track = getSession().tracks.find((t) => t.id === trackId);
    if (!track) return;
    this.translationAbort?.abort();
    const m = getMessages(resolveUILocale(getSession().settings));
    setSession({
      status: 'loading',
      message: undefined,
      originalTrackId: trackId,
      lang: normalizeLang(track.lang),
      cues: [],
      translations: [],
      romanizations: [],
      activeIndex: -1,
    });
    try {
      const cues = await this.adapter.loadTrack(trackId);
      if (gen !== this.generation) return;
      if (!cues.length) {
        setSession({ status: 'none', message: m.content.errors.emptyTrack });
        return;
      }
      setSession({ cues, status: 'ready', translations: new Array(cues.length).fill(undefined) });
      this.sync();
      void this.loadRomanizations(gen);
      void this.loadFrequency();
      await this.selectTranslation(await this.defaultTranslationSource(), gen);
    } catch (err) {
      if (gen !== this.generation) return;
      const raw = (err as Error)?.message;
      const message = raw ? `${m.content.errors.loadSubtitlesFailed} (${raw})` : m.content.errors.loadSubtitlesFailed;
      setSession({ status: 'error', message });
    }
  }

  private frequencyCache = new Map<string, Map<string, number> | null>();

  /** Frequency ranks for the current language (downloaded once per language). */
  async loadFrequency() {
    const { lang, settings } = getSession();
    if (!settings.subtitles.frequencyColors || !lang) return setSession({ frequency: null });
    if (!this.frequencyCache.has(lang)) {
      try {
        const words = await bg({ type: 'freq.list', lang });
        this.frequencyCache.set(lang, words ? buildRankMap(words, lang) : null);
      } catch {
        return; // offline: try again next time
      }
    }
    if (getSession().lang === lang) setSession({ frequency: this.frequencyCache.get(lang) ?? null });
  }

  /** Pinyin / romanization for the whole track, computed in the background. */
  async loadRomanizations(gen: number) {
    const { cues, lang, settings, romanizations } = getSession();
    if (!settings.subtitles.showRomanization || !cues.length || !canRomanize(lang) || romanizations.length) return;
    try {
      const out: string[] = [];
      for (let i = 0; i < cues.length; i += 500) {
        out.push(...(await bg({ type: 'text.romanize', lang, lines: cues.slice(i, i + 500).map((c) => c.text) })));
        if (gen !== this.generation) return;
      }
      setSession({ romanizations: out });
    } catch {
      // Romanization is optional.
    }
  }

  async defaultTranslationSource(): Promise<TranslationSource> {
    const { settings, tracks, lang, originalTrackId, aiStatus } = getSession();
    const native = settings.nativeLanguage;
    if (!lang || sameLang(lang, native)) return { type: 'none' };
    const engine = settings.subtitles.translationEngine;
    if (engine === 'none') return { type: 'none' };
    // A human subtitle track in the learner's language always comes first.
    const human = tracks.find((t) => !t.forced && !t.auto && t.id !== originalTrackId && sameLang(t.lang, native));
    if (human) return { type: 'track', trackId: human.id };
    if (engine === 'ai') return { type: 'ai', lang: native };
    if (engine === 'chrome') return { type: 'chrome', lang: native };
    // 'platform': platform MT → on-device → AI
    if (this.adapter.loadPlatformTranslation) return { type: 'platform-mt', lang: native };
    // Only when the language pack is already on the device: downloading one needs a click.
    if ((await chromeTranslatorState(lang, native)) === 'available') return { type: 'chrome', lang: native };
    if (aiStatus?.configured) return { type: 'ai', lang: native };
    return { type: 'none' };
  }

  async selectTranslation(source: TranslationSource, gen = this.generation) {
    this.translationAbort?.abort();
    const abort = new AbortController();
    this.translationAbort = abort;
    const { cues, lang, originalTrackId, settings } = getSession();
    const m = getMessages(resolveUILocale(settings));
    setSession({
      translationSource: source,
      translations: new Array(cues.length).fill(undefined),
      translationStatus: source.type === 'none' ? 'idle' : 'loading',
      translationMessage: undefined,
    });
    if (source.type === 'none' || !cues.length) return;
    const stale = () => abort.signal.aborted || gen !== this.generation;
    try {
      if (source.type === 'track') {
        const other = await this.adapter.loadTrack(source.trackId);
        if (stale()) return;
        setSession({ translations: alignTracks(cues, other), translationStatus: 'ready' });
      } else if (source.type === 'platform-mt') {
        const other = await this.adapter.loadPlatformTranslation!(originalTrackId!, source.lang);
        if (stale()) return;
        setSession({ translations: alignTracks(cues, other), translationStatus: 'ready' });
      } else {
        await translateLines(
          cues.map((c) => c.text),
          {
            engine: source.type,
            sourceLang: lang,
            targetLang: source.lang,
            startIndex: Math.max(0, this.currentCueIndex()),
            signal: abort.signal,
            onBatch: (start, out) => {
              if (stale()) return;
              const translations = [...getSession().translations];
              out.forEach((t, k) => (translations[start + k] = t));
              setSession({ translations });
            },
          },
        );
        if (stale()) return;
        setSession({ translationStatus: 'ready' });
      }
    } catch (err) {
      if (stale()) return;
      setSession({ translationStatus: 'error', translationMessage: (err as Error).message || m.content.errors.translationFailed });
    }
  }

  private async reloadForSettings(prev: Settings) {
    const { tracks, media, settings } = getSession();
    if (!media) return;
    if (prev.targetLanguage !== settings.targetLanguage) {
      const track = this.pickOriginalTrack(tracks, getSession().originalTrackId, settings);
      if (track && track.id !== getSession().originalTrackId) return this.selectOriginalTrack(track.id);
    }
    await this.selectTranslation(await this.defaultTranslationSource());
  }

  // ---------- vocabulary ----------

  async saveWord(entry: Pick<SaveInput, 'text' | 'form' | 'translation' | 'notes'>, status: VocabItem['status'], cueIndex: number) {
    const { lang, media } = getSession();
    if (!lang) return;
    await saveVocab({ lang, ...entry, status, context: cueIndex >= 0 ? this.contextFor(cueIndex, media) : undefined });
  }
}

/** A shortcut key as it is shown next to a label ("Q", "Space"); empty when unassigned. */
export function keyName(key: string | undefined, spaceLabel = 'Space'): string | undefined {
  if (!key) return undefined;
  return key === ' ' ? spaceLabel : key.toUpperCase();
}
