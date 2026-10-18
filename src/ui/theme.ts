import { setCurrentUILocale, syncUILocaleFromSettings, type UILocale } from '@/lib/i18n';
import { getSettings, watchSettings, type PageTheme, type Settings } from '@/lib/settings';

const CACHE_KEY = 'captionary.pageTheme';
const LOCALE_CACHE_KEY = 'captionary.uiLocale';

function resolve(theme: PageTheme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply the Light / Dark / System choice to an extension page (data-theme on <html>) and keep it in
 * sync with Settings and the browser's colour scheme. Also syncs <html lang> with the resolved UI locale.
 */
export function initPageTheme() {
  let current: PageTheme = 'system';
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached === 'light' || cached === 'dark' || cached === 'system') current = cached;
    const cachedLocale = localStorage.getItem(LOCALE_CACHE_KEY);
    if (cachedLocale === 'en' || cachedLocale === 'zh-CN' || cachedLocale === 'zh-TW' || cachedLocale === 'ja') {
      setCurrentUILocale(cachedLocale);
      document.documentElement.lang = cachedLocale;
    }
  } catch {
    // storage blocked: fall back to the system scheme
  }
  const apply = () => {
    document.documentElement.dataset.theme = resolve(current);
  };
  const set = (theme: PageTheme) => {
    current = theme;
    apply();
    try {
      localStorage.setItem(CACHE_KEY, theme);
    } catch {
      // not cached; the next page load reads storage again
    }
  };
  const syncLocale = (s: Settings) => {
    const locale: UILocale = syncUILocaleFromSettings(s);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_CACHE_KEY, locale);
    } catch {
      // ignore
    }
  };
  apply();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  void getSettings().then((s) => {
    set(s.pageTheme);
    syncLocale(s);
  });
  watchSettings((s) => {
    if (s.pageTheme !== current) set(s.pageTheme);
    syncLocale(s);
  });
}
