import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useSession } from '../store';

/**
 * Root of every Captionary UI on a video site: the host's skin (data-theme) and the player's own
 * font, so one set of components takes each site's look. On extension pages the theme is inherited.
 */
export function HostRoot({
  className = '',
  children,
  rootRef,
  style,
}: {
  className?: string;
  children?: ReactNode;
  rootRef?: RefObject<HTMLDivElement | null>;
  style?: CSSProperties;
}) {
  const theme = useSession((s) => s.theme);
  const font = useSession((s) => s.hostFont);
  return (
    <div
      ref={rootRef}
      className={`cap-root cap-native ${className}`.trim()}
      data-theme={theme}
      style={font ? ({ '--font-host': font, ...style } as CSSProperties) : style}
    >
      {children}
    </div>
  );
}
