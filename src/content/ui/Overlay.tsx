import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/lib/i18n';
import { IconClose, IconGlyph } from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useVocabIndex } from '@/ui/vocab-index';
import { lineAnchor, toastListeners, type SessionController, type ToastMessage } from '../controller';
import { useSession } from '../store';
import { playerOf, useControlsClearance } from './clearance';
import { HostRoot } from './HostRoot';
import { LookupHost } from './LookupHost';
import { PlayerMenu } from './PlayerMenu';
import { SubtitleDrawer } from './SubtitleDrawer';

export function useToast(): ToastMessage | null {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  useEffect(() => {
    toastListeners.add(setMessage);
    return () => void toastListeners.delete(setMessage);
  }, []);
  return message;
}

/** Size of the player (subtitle sizes are tuned for a ~1000px wide player). */
function useSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 1000, height: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth || 1000, height: el.clientHeight || 560 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * True while the pointer moves over the player, like the host's controls; used to fade the fallback
 * button in and out with them.
 */
function usePointerActivity(rootRef: React.RefObject<HTMLElement | null>): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const player = playerOf(rootRef.current);
    if (!player) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 2500);
    };
    player.addEventListener('pointermove', on);
    player.addEventListener('pointerdown', on);
    return () => {
      clearTimeout(timer);
      player.removeEventListener('pointermove', on);
      player.removeEventListener('pointerdown', on);
    };
  }, [rootRef]);
  return active;
}

/**
 * The status badge over the video: loading, no subtitles (fades after a few seconds) and errors
 * (stay until dismissed and say what to do).
 */
function useStatusBadge(status: string, message: string | undefined, mediaId: string | undefined) {
  const key = `${mediaId}:${status}:${message}`;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'none') return;
    const t = setTimeout(() => setDismissed(key), 5000);
    return () => clearTimeout(t);
  }, [key, status]);
  const visible = dismissed !== key && (status === 'loading' || status === 'error' || status === 'none');
  return { visible, dismiss: () => setDismissed(key) };
}

/** Everything Captionary draws over the video: captions, toasts, the look-up, the menu and the drawer. */
export function Overlay({ controller }: { controller: SessionController }) {
  const { m } = useI18n();
  const s = useSession(
    useShallow((st) => ({
      settings: st.settings,
      site: st.site,
      theme: st.theme,
      cues: st.cues,
      translations: st.translations,
      romanizations: st.romanizations,
      frequency: st.frequency,
      activeIndex: st.activeIndex,
      lang: st.lang,
      vocab: st.vocab,
      status: st.status,
      message: st.message,
      media: st.media,
      adShowing: st.adShowing,
      translationStatus: st.translationStatus,
      popup: st.popup,
      off: st.off,
      drawerOpen: st.drawerOpen,
      fullscreen: st.fullscreen,
      buttonMounted: st.buttonMounted,
    })),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const { width } = useSize(rootRef);
  const index = useVocabIndex(s.vocab, s.lang);
  const toastMessage = useToast();
  const pointerActive = usePointerActivity(rootRef);
  const controlsClearance = useControlsClearance(rootRef, controller.adapter.controlBars);
  const badge = useStatusBadge(s.status, s.message, s.media?.id);
  const [fabArmed, setFabArmed] = useState(false);

  useEffect(() => {
    lineAnchor.get = () => {
      const r = linesRef.current?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };
    return () => {
      lineAnchor.get = null;
    };
  }, []);

  // The look-up closes when the next line starts, unless playback pauses after each line.
  const popupCue = s.popup?.surface === 'overlay' ? s.popup.cueIndex : null;
  const autoPause = s.settings.playback.autoPause;
  useEffect(() => {
    if (popupCue !== null && s.activeIndex >= 0 && s.activeIndex !== popupCue && !autoPause) controller.closePopup();
    // Only a change of line closes it, not opening it.
  }, [s.activeIndex]);

  // The fallback button appears only when the host's controls are up (pointer moving) and the
  // control-bar button has not mounted by then.
  const wantFab = s.site !== 'local' && !!s.media && !s.buttonMounted && pointerActive;
  useEffect(() => {
    if (!wantFab) return setFabArmed(false);
    const t = setTimeout(() => setFabArmed(true), 800);
    return () => clearTimeout(t);
  }, [wantFab]);

  const { subtitles } = s.settings;
  if (!s.settings.enabled) return null;
  if (s.adShowing) return <HostRoot className="cap-overlay" rootRef={rootRef} />;

  const cue = s.activeIndex >= 0 ? s.cues[s.activeIndex] : undefined;
  const translation = s.activeIndex >= 0 ? s.translations[s.activeIndex] : undefined;
  const romanized = subtitles.showRomanization && s.activeIndex >= 0 ? s.romanizations[s.activeIndex] : '';
  const scale = Math.min(1.6, Math.max(0.55, width / 1000));
  const fontSize = Math.round(subtitles.fontSize * scale);
  const drawerMode = controller.listMode() === 'drawer';
  const drawerVisible = drawerMode && s.drawerOpen && !s.off && s.site !== 'local';
  const drawerWidth = drawerVisible ? Math.round(Math.min(400, width * 0.42)) : 0;
  const drawerSpace = drawerVisible ? drawerWidth + (s.theme === 'appletv' ? 16 : 0) : 0;
  const selected = s.popup?.surface === 'overlay' && s.popup.cueIndex === s.activeIndex ? s.popup.tokenRange : undefined;

  return (
    <HostRoot className="cap-overlay" rootRef={rootRef}>
      {toastMessage ? (
        <div className="cap-toast cap-overlay__toast" role="status">
          {toastMessage.tone && (
            <span
              className={`cap-dot${toastMessage.tone === 'warn' ? ' cap-dot--warn' : ''}`}
              style={toastMessage.tone === 'learn' ? { background: 'var(--learn)' } : undefined}
            />
          )}
          {toastMessage.text}
          {toastMessage.key && <span className="cap-toast__key">{toastMessage.key}</span>}
        </div>
      ) : (
        badge.visible &&
        !s.off && (
          <div className={`cap-toast cap-overlay__toast${s.status === 'error' ? ' is-wrapping' : ''}`} role="status">
            {s.status === 'loading' ? <span className="cap-spinner" /> : <span className="cap-dot cap-dot--warn" />}
            <span className="cap-spacer">
              {s.status === 'loading'
                ? m.content.overlay.loadingSubtitles
                : s.status === 'none'
                  ? s.site === 'youtube'
                    ? m.content.overlay.noSubtitlesVideo
                    : m.content.overlay.noSubtitlesTitle
                  : s.message}
            </span>
            {s.status !== 'loading' && (
              <button className="cap-toast__close" aria-label={m.content.overlay.dismiss} onClick={badge.dismiss}>
                <IconClose className="cap-ico" />
              </button>
            )}
          </div>
        )
      )}

      {cue && !s.off && (
        <div
          className="cap-captions cap-overlay__captions"
          style={{
            bottom: controlsClearance ? `max(${subtitles.bottomOffset}%, ${controlsClearance + 8}px)` : `${subtitles.bottomOffset}%`,
            left: `calc((100% - ${drawerSpace}px) / 2)`,
            maxWidth: `min(1100px, calc((100% - ${drawerSpace}px) * 0.92))`,
          }}
          onMouseEnter={() => controller.hoverStart()}
          onMouseLeave={() => controller.hoverEnd()}
          ref={linesRef}
        >
          {subtitles.showOriginal && (
            <div className="cap-cap" style={{ fontSize }}>
              <TokenizedText
                text={cue.text}
                lang={s.lang}
                index={index}
                highlight={subtitles.highlight}
                freq={s.frequency}
                selected={selected}
                onSelect={(sel) =>
                  controller.openPopup({
                    kind: 'word',
                    text: sel.text,
                    cueIndex: s.activeIndex,
                    rect: sel.rect,
                    surface: 'overlay',
                    tokenRange: sel.range,
                  })
                }
              />
            </div>
          )}
          {romanized && (
            <div className="cap-cap cap-cap--roman" style={{ fontSize: Math.round(fontSize * 0.62) }}>
              {romanized}
            </div>
          )}
          {subtitles.showTranslation && translation && (
            <div
              className={`cap-cap cap-cap--tr${subtitles.blurTranslation ? ' is-blurred' : ''}`}
              style={{ fontSize: Math.round(fontSize * subtitles.translationScale) }}
            >
              {translation}
            </div>
          )}
          {subtitles.showTranslation && !translation && s.translationStatus === 'loading' && (
            <div className="cap-cap cap-cap--pending" style={{ fontSize: Math.round(fontSize * subtitles.translationScale * 0.8) }}>
              {m.common.translating}
            </div>
          )}
        </div>
      )}

      {s.site !== 'local' && (wantFab || fabArmed) && (
        <button
          className={`cap-fab cap-overlay__fab${fabArmed && wantFab ? '' : ' is-hidden'}`}
          aria-label="Captionary"
          aria-haspopup="menu"
          title="Captionary"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            controller.toggleMenu({ left: r.left, top: r.top, width: r.width, height: r.height });
          }}
        >
          <IconGlyph />
        </button>
      )}

      {drawerVisible && <SubtitleDrawer controller={controller} width={drawerWidth} />}
      {s.site !== 'local' && <PlayerMenu controller={controller} boundsRef={rootRef} />}
      <LookupHost controller={controller} surfaces={['overlay', 'drawer']} hostRef={rootRef} />
    </HostRoot>
  );
}
