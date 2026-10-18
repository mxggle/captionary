import { useEffect, useState } from 'react';
import { normalizeLang } from '../languages';
import { getSettings, watchSettings, type Settings, type UILanguage } from '../settings';
import { en, type Messages } from './en';
import { ja } from './ja';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';

export type UILocale = 'en' | 'zh-CN' | 'zh-TW' | 'ja';
export type { Messages };

export const UI_LANGUAGE_OPTIONS: { value: UILanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
];

const DICTIONARIES: Record<UILocale, Messages> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
};

function isSupportedLocale(code: string): code is UILocale {
  return code === 'en' || code === 'zh-CN' || code === 'zh-TW' || code === 'ja';
}

function isNonEnglishLocale(code: string): code is Exclude<UILocale, 'en'> {
  return code === 'zh-CN' || code === 'zh-TW' || code === 'ja';
}

export function resolveUILocale(settings?: Partial<Pick<Settings, 'uiLanguage' | 'nativeLanguage'>> | null): UILocale {
  if (settings) {
    const ui = settings.uiLanguage;
    if (ui && ui !== 'auto') {
      const normUI = normalizeLang(ui);
      if (isSupportedLocale(normUI)) return normUI;
    }
    const native = normalizeLang(settings.nativeLanguage);
    if (isNonEnglishLocale(native)) return native;
  } else {
    try {
      const cached = globalThis.localStorage?.getItem('captionary.uiLocale');
      if (cached && isSupportedLocale(cached)) return cached;
    } catch {
      // ignore
    }
  }
  const browserLang = normalizeLang(globalThis.navigator?.language);
  if (isNonEnglishLocale(browserLang)) return browserLang;
  return 'en';
}

export function getMessages(locale: UILocale): Messages {
  return DICTIONARIES[locale] ?? en;
}

export function formatAIError(err: unknown, m: Messages): { primary: string; detail?: string } {
  if (!err) return { primary: m.runtime.ai.networkError };
  const info = err as { code?: string; message?: string; status?: number };
  const code = info.code;
  const msg = typeof info.message === 'string' ? info.message : String(err);
  const status = info.status;

  let primary = m.runtime.ai.networkError;
  let detail: string | undefined = msg;

  switch (code) {
    case 'not_configured':
      primary = m.runtime.ai.noProviderConfigured;
      break;
    case 'disabled':
      primary = m.runtime.ai.aiDisabled;
      break;
    case 'missing_key':
      primary = msg || m.runtime.ai.apiKeyRejected;
      break;
    case 'permission':
      primary = msg || m.welcome.tutor.errors.permission('AI');
      break;
    case 'auth':
      primary = msg || m.runtime.ai.apiKeyRejected;
      break;
    case 'quota':
      primary = m.runtime.ai.outOfQuota;
      break;
    case 'rate_limit':
      primary = m.runtime.ai.rateLimited;
      break;
    case 'limit_reached':
      primary = msg || m.runtime.ai.outOfQuota;
      break;
    case 'timeout':
      primary = m.runtime.ai.providerTimeout;
      break;
    case 'unavailable':
      primary = status ? m.runtime.ai.providerProblems(status) : m.runtime.ai.providerProblems(503);
      break;
    case 'bad_request':
      primary = status ? m.runtime.ai.clientError(status) : msg || m.runtime.ai.networkError;
      break;
    case 'aborted':
      primary = m.runtime.ai.requestCancelled;
      break;
    case 'network':
      primary = m.runtime.ai.networkError;
      break;
    default:
      primary = msg || m.runtime.ai.networkError;
      break;
  }

  if (detail === primary || !detail.trim()) detail = undefined;
  return { primary, detail };
}

// Reactive global store for UI locale across extension pages and content scripts
let currentLocale: UILocale = resolveUILocale();
let initialized = false;
const listeners = new Set<(locale: UILocale) => void>();

export function setCurrentUILocale(locale: UILocale) {
  try {
    globalThis.localStorage?.setItem('captionary.uiLocale', locale);
  } catch {
    // ignore
  }
  if (locale === currentLocale) return;
  currentLocale = locale;
  listeners.forEach((l) => l(locale));
}

export function syncUILocaleFromSettings(settings?: Partial<Pick<Settings, 'uiLanguage' | 'nativeLanguage'>> | null): UILocale {
  const next = resolveUILocale(settings);
  setCurrentUILocale(next);
  return next;
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  try {
    void getSettings()
      .then((s) => syncUILocaleFromSettings(s))
      .catch(() => undefined);
    watchSettings((s) => syncUILocaleFromSettings(s));
  } catch {
    // Fallback if storage is unavailable in a test environment
  }
}

export function getCurrentUILocale(): UILocale {
  ensureInitialized();
  return currentLocale;
}

export function useLocale(settingsOverride?: Partial<Pick<Settings, 'uiLanguage' | 'nativeLanguage'>> | null): UILocale {
  const [locale, setLocale] = useState<UILocale>(() => {
    ensureInitialized();
    return settingsOverride ? resolveUILocale(settingsOverride) : currentLocale;
  });

  useEffect(() => {
    ensureInitialized();
    if (settingsOverride) {
      const next = resolveUILocale(settingsOverride);
      setLocale(next);
      return;
    }
    setLocale(currentLocale);
    listeners.add(setLocale);
    return () => {
      listeners.delete(setLocale);
    };
  }, [settingsOverride?.uiLanguage, settingsOverride?.nativeLanguage]);

  return settingsOverride ? resolveUILocale(settingsOverride) : locale;
}

export function useI18n(settingsOverride?: Partial<Pick<Settings, 'uiLanguage' | 'nativeLanguage'>> | null): {
  locale: UILocale;
  m: Messages;
} {
  const locale = useLocale(settingsOverride);
  return { locale, m: DICTIONARIES[locale] };
}
