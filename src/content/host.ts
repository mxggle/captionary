import { browser, type ContentScriptContext } from '#imports';
import type { SessionController } from './controller';
import { getSession, setSession, type HostTheme } from './store';

/** Fallbacks after the player's own font, so Chinese, Japanese and Korean lines use the system's CJK fonts. */
const FONT_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Noto Sans CJK JP", sans-serif';

/**
 * Wear the host's skin: pick the theme for the site (YouTube follows its own dark mode, live) and
 * read the player's computed font, so captions, menus and the look-up use the site's typeface.
 * No font is ever loaded from the network on a video site.
 */
export function watchHost(ctx: ContentScriptContext, site: 'youtube' | 'netflix' | 'appletv', player: () => Element | null) {
  const theme = (): HostTheme => {
    if (site === 'netflix') return 'netflix';
    if (site === 'appletv') return 'appletv';
    return document.documentElement.hasAttribute('dark') ? 'youtube-dark' : 'youtube-light';
  };
  const apply = () => {
    const next = theme();
    if (getSession().theme !== next) setSession({ theme: next });
  };
  apply();
  if (site === 'youtube') {
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
    ctx.onInvalidated(() => observer.disconnect());
  }

  const readFont = () => {
    const el = player();
    if (!el) return;
    const family = getComputedStyle(el).fontFamily;
    if (!family) return;
    const font = `${family}, ${FONT_FALLBACK}`;
    if (getSession().hostFont !== font) setSession({ hostFont: font });
  };
  readFont();
  // The player appears after navigation and may be replaced; its font rarely changes.
  ctx.setInterval(readFont, 3000);
}

/**
 * Answer the toolbar pop-up: what Captionary is doing on this tab ("On this tab"), and the two
 * quick actions it offers (show the list, pause after each line).
 */
export function listenToPopup(ctx: ContentScriptContext, controller: SessionController) {
  const listener = (raw: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
    const msg = raw as { type?: string; action?: string } | undefined;
    if (msg?.type === 'captionary.tabStatus') {
      sendResponse(controller.tabStatus());
    } else if (msg?.type === 'captionary.toggleList') {
      if (getSession().off) controller.setOff(false);
      const wasOpen = controller.isListOpen();
      controller.toggleList();
      // The panel setting is written asynchronously; report the state it is about to have.
      sendResponse({ ...controller.tabStatus(), listOpen: !wasOpen });
    }
  };
  browser.runtime.onMessage.addListener(listener);
  ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(listener));
}
