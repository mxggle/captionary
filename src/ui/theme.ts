import { getSettings, watchSettings, type PageTheme } from '@/lib/settings';

const CACHE_KEY = 'captionary.pageTheme';

function resolve(theme: PageTheme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply the Light / Dark / System choice to an extension page (data-theme on <html>) and keep it in
 * sync with Settings and the browser's colour scheme. The last choice is cached so the page paints in
 * the right theme before storage answers.
 */
export function initPageTheme() {
  let current: PageTheme = 'system';
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached === 'light' || cached === 'dark' || cached === 'system') current = cached;
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
  apply();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  void getSettings().then((s) => set(s.pageTheme));
  watchSettings((s) => s.pageTheme !== current && set(s.pageTheme));
}
