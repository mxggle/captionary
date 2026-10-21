import { createElement, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { mountShadowUi } from './mount';

/** Waits for the mutation observer and the animation frame that re-checks the anchor. */
const nextFrame = () => new Promise((r) => setTimeout(r, 50));

describe('mountShadowUi', () => {
  it('unmounts the old tree when the site removes the element it was mounted in', async () => {
    const ctx = new ContentScriptContext('test');
    let live = 0;
    function Probe() {
      useEffect(() => {
        live++;
        return () => void live--;
      }, []);
      return null;
    }
    const player = () => {
      const el = document.createElement('div');
      el.className = 'player';
      document.body.append(el);
      return el;
    };

    const first = player();
    await mountShadowUi(ctx, { name: 'test-overlay', anchor: '.player', append: 'last', render: () => createElement(Probe) });
    await nextFrame();
    expect(live).toBe(1);

    // The next episode: the site drops its player, our host with it, and renders a new one.
    first.remove();
    const second = player();
    await nextFrame();
    expect(second.querySelector('test-overlay')).not.toBeNull();
    expect(live).toBe(1);

    second.remove();
    await nextFrame();
    expect(live).toBe(0);
    ctx.abort();
  });
});
