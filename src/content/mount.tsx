import { createShadowRootUi, type ContentScriptContext } from '#imports';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

type Append = 'first' | 'last' | 'before' | 'after' | ((anchor: Element, host: Element) => void);

interface MountOptions {
  name: string;
  /** Element to mount next to; re-evaluated whenever the site's DOM changes. */
  anchor: string | (() => Element | null | undefined);
  append: Append;
  hostStyle?: string;
  /** Whether the host still sits where `append` put it for this anchor (defaults per append mode). */
  placed?: (anchor: Element, host: Element) => boolean;
  render: () => ReactNode;
}

function defaultPlaced(append: Append) {
  return (anchor: Element, host: Element) => {
    switch (append) {
      case 'first':
      case 'last':
        return host.parentElement === anchor;
      case 'before':
        return anchor.previousElementSibling === host;
      case 'after':
        return anchor.nextElementSibling === host;
      default:
        return host.parentElement === anchor.parentElement || anchor.contains(host);
    }
  };
}

/**
 * Mount a React tree in an isolated shadow root next to a site element, and keep it there: when the
 * site re-renders or replaces that element (SPA navigation, controls that come and go, fullscreen),
 * the UI is mounted again at the new place, and removed while the element is gone.
 */
export async function mountShadowUi(ctx: ContentScriptContext, opts: MountOptions) {
  const resolve = () => (typeof opts.anchor === 'string' ? document.querySelector(opts.anchor) : opts.anchor());
  const placed = opts.placed ?? defaultPlaced(opts.append);
  let current: Element | null = null;
  const ui = await createShadowRootUi(ctx, {
    name: opts.name,
    position: 'inline',
    anchor: () => current,
    append: opts.append,
    onMount(container, _shadow, host) {
      // Note: WXT resets the host with `:host { all: initial !important }`, which beats inline styles;
      // layout therefore comes from the positioned elements inside the shadow root (they resolve
      // against the site's nearest positioned ancestor).
      if (opts.hostStyle) host.setAttribute('style', opts.hostStyle);
      // Keep site keyboard shortcuts from firing while typing in our inputs.
      for (const type of ['keydown', 'keyup', 'keypress'] as const) {
        host.addEventListener(type, (e) => {
          const t = e.composedPath()[0] as HTMLElement | undefined;
          if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) e.stopPropagation();
        });
      }
      const root = ReactDOM.createRoot(container);
      root.render(opts.render());
      return root;
    },
    onRemove(root) {
      root?.unmount();
    },
  });

  let scheduled = 0;
  const check = () => {
    scheduled = 0;
    const anchor = resolve();
    const host = ui.shadowHost;
    if (!anchor) {
      if (host.isConnected) ui.remove();
      current = null;
      return;
    }
    if (host.isConnected && anchor === current && placed(anchor, host)) return;
    if (host.isConnected) ui.remove();
    current = anchor;
    ui.mount();
  };
  const schedule = () => {
    scheduled ||= requestAnimationFrame(check);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('fullscreenchange', schedule);
  ctx.onInvalidated(() => {
    observer.disconnect();
    document.removeEventListener('fullscreenchange', schedule);
    cancelAnimationFrame(scheduled);
    if (ui.shadowHost.isConnected) ui.remove();
  });
  check();
  return { ui, refresh: schedule };
}
