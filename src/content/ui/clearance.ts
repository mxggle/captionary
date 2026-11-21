import { useEffect, useState } from 'react';

/** The player element the overlay covers (the shadow host's parent, or the parent in the reader). */
export function playerOf(root: HTMLElement | null): Element | null {
  if (!root) return null;
  const node = root.getRootNode();
  return node instanceof ShadowRoot ? node.host.parentElement : root.parentElement;
}

/**
 * How far up from the player's bottom edge something must sit to clear the host's progress bar and
 * control bar (`SiteAdapter.controlBars`) as they are on screen right now; 0 while they are hidden.
 */
export function measureClearance(player: Element | null, controlBars: readonly string[] | undefined): number {
  if (!player || !controlBars?.length) return 0;
  const bottom = player.getBoundingClientRect().bottom;
  const tops = controlBars
    .map((q) => player.querySelector(q)?.getBoundingClientRect())
    .filter((r): r is DOMRect => !!r && r.height > 0)
    .map((r) => r.top);
  return tops.length ? Math.max(0, Math.round(bottom - Math.min(...tops))) : 0;
}

/**
 * {@link measureClearance}, kept current. YouTube keeps its bar laid out while it fades, so the
 * captions stay put; Netflix mounts its bar only while it shows, so the captions rise and fall with it.
 */
export function useControlsClearance(rootRef: React.RefObject<HTMLElement | null>, controlBars: readonly string[] | undefined): number {
  const [px, setPx] = useState(0);
  useEffect(() => {
    if (!controlBars?.length) return setPx(0);
    const player = playerOf(rootRef.current);
    if (!player) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setPx(measureClearance(player, controlBars));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(player);
    // Control bars that are added and removed, or shown and hidden by a class (Apple TV+), as they come and go.
    const mo = new MutationObserver(schedule);
    mo.observe(player, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // A bar that slides into place is measured again once it has arrived.
    player.addEventListener('transitionend', schedule, true);
    player.addEventListener('animationend', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      player.removeEventListener('transitionend', schedule, true);
      player.removeEventListener('animationend', schedule, true);
    };
  }, [rootRef, controlBars]);
  return px;
}
