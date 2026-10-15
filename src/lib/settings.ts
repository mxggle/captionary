import { storage } from '#imports';
import type { AISettings, AITask, TaskRoute } from './ai/types';

export type ShortcutAction =
  | 'prevLine'
  | 'nextLine'
  | 'repeatLine'
  | 'togglePlay'
  | 'toggleAutoPause'
  | 'toggleTranslation'
  | 'toggleOriginal'
  | 'toggleSidebar'
  | 'slower'
  | 'faster'
  | 'explainLine'
  | 'saveLine';

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  prevLine: 'Previous subtitle',
  nextLine: 'Next subtitle',
  repeatLine: 'Repeat current subtitle',
  togglePlay: 'Play / pause',
  toggleAutoPause: 'Pause after each line',
  toggleTranslation: 'Show / hide translation',
  toggleOriginal: 'Show / hide original subtitle',
  toggleSidebar: 'Show / hide subtitle list',
  slower: 'Slower playback',
  faster: 'Faster playback',
  explainLine: 'Explain current subtitle with the tutor',
  saveLine: 'Save current subtitle as a phrase',
};

export type WordStatusHighlight = 'learning' | 'all' | 'none';

/** Colour scheme of the extension's own pages; video sites always follow the site. */
export type PageTheme = 'system' | 'light' | 'dark';

export interface Settings {
  enabled: boolean;
  sites: { youtube: boolean; netflix: boolean; appletv: boolean };
  /** Language being learned. 'auto' = use the video's original language. */
  targetLanguage: string;
  /** The learner's language (translations, explanations). */
  nativeLanguage: string;
  learnerLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  pageTheme: PageTheme;
  subtitles: {
    showOriginal: boolean;
    showTranslation: boolean;
    /** Pinyin / romaji / romanization line for non-Latin scripts. */
    showRomanization: boolean;
    /** Underline words by how rare they are (downloads a frequency list per language). */
    frequencyColors: boolean;
    blurTranslation: boolean;
    fontSize: number;
    translationScale: number;
    bottomOffset: number;
    hideNativeSubtitles: boolean;
    /** Where translations come from when the platform has none. */
    translationEngine: 'platform' | 'chrome' | 'ai' | 'none';
    highlight: WordStatusHighlight;
  };
  playback: {
    autoPause: boolean;
    pauseOnHover: boolean;
    rateStep: number;
  };
  sidebar: {
    open: boolean;
    width: number;
    showTranslations: boolean;
    autoScroll: boolean;
  };
  shortcuts: Record<ShortcutAction, string>;
  dictionary: {
    wiktionary: boolean;
    quickTranslate: boolean;
    speechRate: number;
  };
}

/**
 * Single keys, case-insensitive. Chosen to avoid the sites' own shortcuts
 * (YouTube/Netflix use f, t, c, m, k, j, l, space and the arrow keys). '' = unassigned.
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  prevLine: 'a',
  nextLine: 'd',
  repeatLine: 's',
  togglePlay: '',
  toggleAutoPause: 'q',
  toggleTranslation: 'x',
  toggleOriginal: 'z',
  toggleSidebar: 'w',
  slower: '[',
  faster: ']',
  explainLine: 'e',
  saveLine: 'g',
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sites: { youtube: true, netflix: true, appletv: true },
  targetLanguage: 'auto',
  nativeLanguage: defaultNativeLanguage(),
  learnerLevel: 'B1',
  pageTheme: 'system',
  subtitles: {
    showOriginal: true,
    showTranslation: true,
    showRomanization: true,
    frequencyColors: false,
    blurTranslation: false,
    fontSize: 26,
    translationScale: 0.8,
    bottomOffset: 9,
    hideNativeSubtitles: true,
    translationEngine: 'platform',
    highlight: 'learning',
  },
  playback: {
    autoPause: false,
    pauseOnHover: true,
    rateStep: 0.1,
  },
  sidebar: {
    open: true,
    width: 380,
    showTranslations: true,
    autoScroll: true,
  },
  shortcuts: DEFAULT_SHORTCUTS,
  dictionary: {
    wiktionary: true,
    quickTranslate: true,
    speechRate: 0.9,
  },
};

const route = (r: Partial<TaskRoute>): TaskRoute => ({
  connectionId: null,
  model: '',
  temperature: null,
  maxOutputTokens: 1200,
  effort: 'low',
  ...r,
});

/**
 * Defaults follow a few principles:
 *  - AI is opt-in: nothing is sent until the user adds a provider.
 *  - Explanations are generated on demand (autoExplain off) to keep cost and data flow
 *    under the user's control.
 *  - Temperature is left to the provider (null) because current reasoning models reject
 *    non-default values; translation explicitly requests 0 when the model allows it.
 *  - Quick tasks use low reasoning effort for latency; chat gets more room.
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  connections: [],
  defaultConnectionId: null,
  fallbackConnectionId: null,
  routes: {
    word: route({ maxOutputTokens: 900 }),
    sentence: route({ maxOutputTokens: 1500 }),
    chat: route({ maxOutputTokens: 2000, effort: 'default' }),
    translate: route({ maxOutputTokens: 4000, temperature: 0, effort: 'minimal' }),
  },
  explanationLanguage: 'native',
  contextScope: 'surrounding',
  shareMediaTitle: true,
  autoExplain: false,
  stream: true,
  timeoutSec: 60,
  maxRetries: 2,
  cacheEnabled: true,
  cacheTtlDays: 30,
  dailyRequestLimit: 300,
  prompts: {},
};

export const TASK_LABELS: Record<AITask, { name: string; description: string }> = {
  word: { name: 'Word look-up', description: 'Explains a clicked word or phrase in its sentence.' },
  sentence: { name: 'Sentence breakdown', description: 'Translates a line and explains its grammar.' },
  chat: { name: 'Follow-up chat', description: 'Answers your questions in the look-up card and the side panel.' },
  translate: {
    name: 'Subtitle translation',
    description: 'Translates whole subtitle tracks when the site has none in your language. Long videos make many requests.',
  },
};

function defaultNativeLanguage(): string {
  try {
    const lang = (globalThis.navigator?.language ?? 'en').split('-')[0];
    return lang === 'zh' ? 'zh-CN' : lang;
  } catch {
    return 'en';
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge stored values over defaults so new settings fields get default values. */
export function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) {
    return (stored === undefined || stored === null ? defaults : stored) as T;
  }
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(stored)) {
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = isPlainObject(d) && isPlainObject(v) ? mergeDefaults(d, v) : v;
  }
  return out as T;
}

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export const aiSettingsItem = storage.defineItem<AISettings>('local:aiSettings', {
  fallback: DEFAULT_AI_SETTINGS,
  version: 1,
});

export async function getSettings(): Promise<Settings> {
  return mergeDefaults(DEFAULT_SETTINGS, await settingsItem.getValue());
}

export async function getAISettings(): Promise<AISettings> {
  return mergeDefaults(DEFAULT_AI_SETTINGS, await aiSettingsItem.getValue());
}

export async function updateSettings(patch: (s: Settings) => Settings | void): Promise<Settings> {
  const draft = structuredClone(await getSettings());
  const next = patch(draft) ?? draft;
  await settingsItem.setValue(next);
  return next;
}

export async function updateAISettings(patch: (s: AISettings) => AISettings | void): Promise<AISettings> {
  const current = await getAISettings();
  const draft = structuredClone(current);
  const next = patch(draft) ?? draft;
  await aiSettingsItem.setValue(next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return settingsItem.watch((v) => cb(mergeDefaults(DEFAULT_SETTINGS, v)));
}

export function watchAISettings(cb: (s: AISettings) => void): () => void {
  return aiSettingsItem.watch((v) => cb(mergeDefaults(DEFAULT_AI_SETTINGS, v)));
}
