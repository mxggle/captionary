import { createShadowRootUi, type ContentScriptContext } from '#imports';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

interface MountOptions {
  name: string;
  anchor: string | (() => Element | null | undefined);
  append: 'first' | 'last';
  hostStyle: string;
  render: () => ReactNode;
}

/**
 * Mount a React tree in an isolated shadow root next to a site element, re-mounting
 * automatically when the site re-renders that element (SPA navigation).
 */
export async function mountShadowUi(ctx: ContentScriptContext, opts: MountOptions) {
  const ui = await createShadowRootUi(ctx, {
    name: opts.name,
    position: 'inline',
    anchor: opts.anchor,
    append: opts.append,
    onMount(container, _shadow, host) {
      // Note: WXT resets the host with `:host { all: initial !important }`, which beats
      // inline styles; layout therefore comes from the positioned elements inside the
      // shadow root (they resolve against the site's nearest positioned ancestor).
      host.setAttribute('style', opts.hostStyle);
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
  ui.autoMount();
  return ui;
}
