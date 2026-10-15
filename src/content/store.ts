import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { AIStatus } from '@/lib/messaging';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import type { Cue, TrackInfo, TranslationSource } from '@/lib/subtitles/types';
import type { VocabItem } from '@/lib/vocab';

/** Where a look-up was opened: captions on the video, the subtitle panel, the fullscreen drawer, a page. */
export type Surface = 'overlay' | 'sidebar' | 'drawer' | 'reader';

/** The skin a surface wears: page themes, or the host's own look on video sites. */
export type HostTheme = 'light' | 'dark' | 'youtube-dark' | 'youtube-light' | 'netflix' | 'appletv';

export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** What the pop-up is showing. */
export interface PopupTarget {
  kind: 'word' | 'sentence';
  text: string;
  lang: string;
  cueIndex: number;
  sentence: string;
  translation?: string;
  before: string[];
  after: string[];
  /** Viewport coordinates of the clicked element. */
  rect: AnchorRect;
  surface: Surface;
  /** Seconds into the media, for saving context. */
  time?: number;
  /** Token range of the selection in its line, kept marked while the look-up is open. */
  tokenRange?: [number, number];
}

export interface MediaInfo {
  id: string;
  title: string;
  url: string;
}

export interface SessionState {
  site: 'youtube' | 'netflix' | 'appletv' | 'local' | 'reader';
  settings: Settings;
  aiStatus: AIStatus | null;
  media: MediaInfo | null;
  tracks: TrackInfo[];
  originalTrackId: string | null;
  /** Language of the original track. */
  lang: string;
  translationSource: TranslationSource;
  cues: Cue[];
  translations: (string | undefined)[];
  /** Romanized original lines (pinyin, romaji…), empty when not applicable. */
  romanizations: string[];
  /** Normalized word -> frequency rank (1 = most common) for the current language. */
  frequency: Map<string, number> | null;
  status: 'idle' | 'loading' | 'ready' | 'none' | 'error';
  message?: string;
  translationStatus: 'idle' | 'loading' | 'ready' | 'error';
  translationMessage?: string;
  activeIndex: number;
  /** Last cue that was active (stays set during gaps between cues). */
  lastIndex: number;
  playing: boolean;
  rate: number;
  adShowing: boolean;
  fullscreen: boolean;
  vocab: Record<string, VocabItem>;
  popup: PopupTarget | null;
  /** Whether the site layout currently has room to show the subtitle list. */
  sidebarVisible: boolean;
  /** Skin for the shadow-root UIs; undefined on extension pages (they inherit the page theme). */
  theme?: HostTheme;
  /** The player's computed font-family, so Captionary draws in the host's font. */
  hostFont: string;
  /** Captionary turned off for this video from the player menu (the host's captions come back). */
  off: boolean;
  /** The player menu, and the on-screen rectangle of the button that opened it. */
  menuOpen: boolean;
  menuAnchor: AnchorRect | null;
  /** The fullscreen subtitle drawer (opened with W or from the menu, never on its own). */
  drawerOpen: boolean;
  /** The Captionary button is in the host's control bar right now / was seen there on this page. */
  buttonMounted: boolean;
  buttonSeen: boolean;
}

export const sessionStore = createStore<SessionState>(() => ({
  site: 'youtube',
  settings: DEFAULT_SETTINGS,
  aiStatus: null,
  media: null,
  tracks: [],
  originalTrackId: null,
  lang: '',
  translationSource: { type: 'none' },
  cues: [],
  translations: [],
  romanizations: [],
  frequency: null,
  status: 'idle',
  translationStatus: 'idle',
  activeIndex: -1,
  lastIndex: -1,
  playing: false,
  rate: 1,
  adShowing: false,
  fullscreen: false,
  vocab: {},
  popup: null,
  sidebarVisible: true,
  hostFont: '',
  off: false,
  menuOpen: false,
  menuAnchor: null,
  drawerOpen: false,
  buttonMounted: false,
  buttonSeen: false,
}));

export function useSession<T>(selector: (s: SessionState) => T): T {
  return useStore(sessionStore, selector);
}

export const getSession = sessionStore.getState;
export const setSession = sessionStore.setState;
