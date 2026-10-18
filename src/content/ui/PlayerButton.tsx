import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/lib/i18n';
import { IconGlyph } from '@/ui/icons';
import { keyName, type SessionController } from '../controller';
import { setSession, useSession } from '../store';
import { HostRoot } from './HostRoot';

/**
 * The Captionary glyph in the host's own control bar (`PlayerButton`), sized like the host's buttons
 * next to it. It opens the player menu; the underline shows that Captionary's captions are on.
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
      off: st.off,
      status: st.status,
      menuOpen: st.menuOpen,
      adShowing: st.adShowing,
      listKey: st.settings.shortcuts.toggleSidebar,
    })),
  );
  const ref = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    for (const el of sizeFrom?.() ?? []) {
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    }
  }, [sizeFrom]);

  useEffect(() => {
    setSession({ buttonMounted: true, buttonSeen: true });
    return () => setSession({ buttonMounted: false });
  }, []);

  if (s.adShowing) return null;
  const key = keyName(s.listKey, m.common.space);
  return (
    <HostRoot className="cap-playerbtn-root" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <button
        ref={ref}
        className="cap-playerbtn"
        aria-label="Captionary"
        aria-pressed={!s.off && s.status === 'ready'}
        aria-haspopup="menu"
        aria-expanded={s.menuOpen}
        title={key ? m.content.playerButton.titleWithKey(key) : 'Captionary'}
        style={{ ...size, ...style }}
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
    </HostRoot>
  );
}
