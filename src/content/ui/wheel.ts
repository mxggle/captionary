import { useEffect, type RefObject } from 'react';

/** True when an element from `target` up to `root` can still scroll vertically by `dy`. */
function canScroll(target: EventTarget | null, root: Element, dy: number): boolean {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    if (el === root) break;
  }
  return false;
}

/**
 * Keep the wheel inside a card, menu or drawer over the video. The site never sees it: a wheel over
 * YouTube's fullscreen player pulls up its "more videos" grid, and `overscroll-behavior` cannot stop
 * that (it is the player's own listener, not scroll chaining). Where nothing under the pointer can
 * scroll further, the default is cancelled too, so the page behind stays put.
 */
export function useContainWheel(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      // Leave pinch-zoom (ctrl + wheel) to the browser.
      if (e.deltaY && !e.ctrlKey && !canScroll(e.target, el, e.deltaY)) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, active]);
}
