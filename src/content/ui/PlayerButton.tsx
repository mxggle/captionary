import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/lib/i18n';
import { IconGlyph } from '@/ui/icons';
import type { SessionController } from '../controller';
import { setSession, useSession } from '../store';
import { HostRoot } from './HostRoot';

/**
 * Height of the host's button when the glyph sizes in components.css apply (the first one measured on
 * this page); the glyph grows and shrinks from there with the host's buttons (fullscreen, a resized player).
 */
let baseHeight = 0;

/**
 * The Captionary glyph in the host's own control bar (`PlayerButton`), sized like the host's buttons
 * next to it and kept so as they resize. It opens the player menu; the underline shows that
 * Captionary's captions are on.
 */
export function PlayerButton({
  controller,
  sizeFrom,
  style,
}: {
  controller: SessionController;
  /** Host buttons to copy the size from, first visible one wins. */
  sizeFrom?: () => (Element | null | undefined)[];
  style?: CSSProperties;
}) {
  const { m } = useI18n();
  const s = useSession(
    useShallow((st) => ({
      theme: st.theme,
      off: st.off,
      status: st.status,
      menuOpen: st.menuOpen,
      adShowing: st.adShowing,
      fullscreen: st.fullscreen,
    })),
  );
  const ref = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // Follow the host's button: its size changes in fullscreen and with the player, without a remount.
  useLayoutEffect(() => {
    const candidates = (sizeFrom?.() ?? []).filter((el): el is Element => !!el);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const host = candidates.find(visible) ?? candidates[0];
    if (!host) return;
    const measure = () => {
      if (!visible(host)) return;
      const r = host.getBoundingClientRect();
      const next = { width: Math.round(r.width), height: Math.round(r.height) };
      baseHeight ||= next.height;
      setSize((prev) => (prev?.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [sizeFrom, s.fullscreen]);

  useEffect(() => {
    setSession({ buttonMounted: true, buttonSeen: true });
    return () => setSession({ buttonMounted: false });
  }, []);

  if (s.adShowing) return null;
  const on = !s.off && s.status === 'ready';
  // The state is part of the name: the button opens a menu, it does not toggle (no aria-pressed).
  const label = s.off ? m.content.playerButton.off : on ? m.content.playerButton.on : 'Captionary';
  const glyphScale = size && baseHeight ? size.height / baseHeight : 1;
  return (
    <HostRoot className="cap-playerbtn-root" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
      <button
        ref={ref}
        className={`cap-playerbtn${on ? ' is-on' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={s.menuOpen}
        // Netflix's buttons show no tooltip, YouTube's show their own (drawn below); Apple TV+ gets the browser's.
        title={s.theme === 'appletv' ? label : undefined}
        style={{ ...size, '--glyph-scale': glyphScale, ...style } as CSSProperties}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const r = ref.current!.getBoundingClientRect();
          controller.toggleMenu({ left: r.left, top: r.top, width: r.width, height: r.height });
        }}
      >
        <IconGlyph />
      </button>
      {s.theme?.startsWith('youtube') && !s.menuOpen && (
        <span className="cap-playerbtn__tip" aria-hidden="true">
          {label}
        </span>
      )}
    </HostRoot>
  );
}
