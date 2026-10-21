import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

/** Everything in a surface that takes focus, in document order. */
export const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const MENU_ITEM = '[role^="menuitem"]:not([disabled]):not([aria-disabled="true"])';

/** The focused element, looking into shadow roots (every Captionary surface on a video site is in one). */
export function deepActiveElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/** Move focus without scrolling: the player or the column it lands in may sit anywhere on the page. */
export function focusQuietly(el: Element | null | undefined) {
  if (el instanceof HTMLElement || el instanceof SVGElement) el.focus({ preventScroll: true });
}

/**
 * Give focus back to `opener` after `surface` (a menu, a look-up) has closed, when focus went with it:
 * it was inside, or the surface's removal left it nowhere. A click elsewhere keeps focus where it landed.
 */
export function returnFocus(opener: Element | null, surface: Element | null) {
  const active = deepActiveElement();
  const lost = !active || active === document.body || !!surface?.contains(active);
  if (lost && opener && opener !== document.body && opener.isConnected) focusQuietly(opener);
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(MENU_ITEM)].filter((el) => el.getClientRects().length > 0);
}

/**
 * The keyboard of a `role="menu"`, as in the hosts' own menus: opening it moves focus to its first item
 * (so does a sub-page, `page`, replacing the item that had it), ↑/↓ move through the items and wrap,
 * Home/End go to the ends, Esc and Tab close it, and focus returns to what opened it. Returns the
 * menu's keydown handler.
 */
export function useMenuKeys(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, page?: string | null) {
  const opener = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!open || !menu) return;
    opener.current = deepActiveElement();
    focusQuietly(menuItems(menu)[0]);
    return () => returnFocus(opener.current, menu);
  }, [open]);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!open || !menu) return;
    const active = deepActiveElement();
    if (!active || active === document.body) focusQuietly(menuItems(menu)[0]);
  }, [open, page]);

  return (e: KeyboardEvent<HTMLElement>) => {
    const menu = ref.current;
    if (!menu) return;
    const items = menuItems(menu);
    const at = items.indexOf(deepActiveElement() as HTMLElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = (at + 1) % items.length;
        break;
      case 'ArrowUp':
        next = at <= 0 ? items.length - 1 : at - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'Escape':
      case 'Tab':
        // Back on the opener first, so Tab carries on from there once the menu is gone.
        focusQuietly(opener.current);
        onClose();
        if (e.key === 'Escape') e.preventDefault();
        e.stopPropagation();
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    focusQuietly(items[next]);
  };
}
