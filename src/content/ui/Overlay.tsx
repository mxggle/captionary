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
import { TranslationErrorAction } from './TranslationError';
import { sourceKey, translationLang } from './subtitles';

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
 * A badge over the video while `show` holds: until dismissed, or faded after `fadeMs`. It comes back
 * when `key` (what it reports) changes.
 */
function useBadge(key: string, show: boolean, fadeMs?: number) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  // A dismissal lasts until the badge goes away (a retry starts), so the same failure again shows again.
  useEffect(() => {
    if (!show) setDismissed(null);
  }, [show]);
  useEffect(() => {
    if (!show || !fadeMs) return;
    const t = setTimeout(() => setDismissed(key), fadeMs);
    return () => clearTimeout(t);
  }, [key, show, fadeMs]);
  return { visible: show && dismissed !== key, dismiss: () => setDismissed(key) };
}

/** Second and third lines (romanization, translation) shrink with the player, but not below this. */
const MIN_MINOR_LINE_PX = 12;

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
      playing: st.playing,
      tracks: st.tracks,
      translationSource: st.translationSource,
      translationStatus: st.translationStatus,
      translationMessage: st.translationMessage,
      popup: st.popup,
      off: st.off,
      drawerOpen: st.drawerOpen,
      fullscreen: st.fullscreen,
      buttonSeen: st.buttonSeen,
    })),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const { width } = useSize(rootRef);
  const index = useVocabIndex(s.vocab, s.lang);
  const toastMessage = useToast();
  const pointerActive = usePointerActivity(rootRef);
  const hostBarsClearance = useControlsClearance(rootRef, controller.adapter.controlBars);
  const { nativeControlsHeight } = controller.adapter;
  const controlsClearance = Math.max(hostBarsClearance, nativeControlsHeight && (!s.playing || pointerActive) ? nativeControlsHeight : 0);
  // Loading, no subtitles (fades after a few seconds) and errors (stay until dismissed and say what to do).
  const badge = useBadge(
    `${s.media?.id}:${s.status}:${s.message}`,
    s.status === 'loading' || s.status === 'error' || s.status === 'none',
    s.status === 'none' ? 5000 : undefined,
  );
  // A translation that failed, reported where it would have shown.
  const trBadge = useBadge(
    `${s.media?.id}:${sourceKey(s.translationSource)}:${s.translationMessage}`,
    s.translationStatus === 'error' && s.settings.subtitles.showTranslation,
  );
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

  // The fallback button appears only while the pointer moves over the player and the control-bar
  // button has never mounted on this page. Once it has, the host's own bar is the way in, even while
  // the host hides it (Netflix unmounts its bar whenever the pointer is over Captionary's captions).
  const wantFab = s.site !== 'local' && !!s.media && !s.buttonSeen && pointerActive;
  useEffect(() => {
    if (!wantFab) return setFabArmed(false);
    const t = setTimeout(() => setFabArmed(true), 800);
    return () => clearTimeout(t);
  }, [wantFab]);

  const drawerMode = controller.listMode() === 'drawer';
  const drawerVisible = s.settings.enabled && !s.adShowing && drawerMode && s.drawerOpen && !s.off && s.site !== 'local';
  const drawerWidth = drawerVisible ? Math.round(Math.min(400, width * 0.42)) : 0;
  const drawerSpace = drawerVisible ? drawerWidth + (s.theme === 'appletv' ? 16 : 0) : 0;

  // Where the site supports it, the player makes room so the drawer sits beside the video.
  useEffect(() => {
    controller.adapter.reserveRight?.(drawerSpace);
  }, [controller, drawerSpace]);
  useEffect(() => () => controller.adapter.reserveRight?.(0), [controller]);

  const { subtitles } = s.settings;
  if (!s.settings.enabled) return null;
  if (s.adShowing) return <HostRoot className="cap-overlay" rootRef={rootRef} />;

  const cue = s.activeIndex >= 0 ? s.cues[s.activeIndex] : undefined;
  const translation = s.activeIndex >= 0 ? s.translations[s.activeIndex] : undefined;
  const romanized = subtitles.showRomanization && s.activeIndex >= 0 ? s.romanizations[s.activeIndex] : '';
  const scale = Math.min(1.6, Math.max(0.55, width / 1000));
  const fontSize = Math.round(subtitles.fontSize * scale);
  const minor = (factor: number) => Math.max(MIN_MINOR_LINE_PX, Math.round(fontSize * factor));
  const selected = s.popup?.surface === 'overlay' && s.popup.cueIndex === s.activeIndex ? s.popup.tokenRange : undefined;
  const blurred = subtitles.blurTranslation;
  // A drawer over the video stops above the host's controls; one beside it (reserveRight) runs full height.
  const drawerBottom = controller.adapter.reserveRight ? 0 : controlsClearance;

  // One notice at a time over the video: a toast, else the subtitles' status, else a failed translation.
  let notice = null;
  let said = '';
  if (toastMessage) {
    said = toastMessage.key ? `${toastMessage.text} (${toastMessage.key})` : toastMessage.text;
    notice = (
      <div className="cap-toast cap-overlay__toast">
        {toastMessage.tone && (
          <span
            className={`cap-dot${toastMessage.tone === 'warn' ? ' cap-dot--warn' : ''}`}
            style={toastMessage.tone === 'learn' ? { background: 'var(--learn)' } : undefined}
          />
        )}
        {toastMessage.text}
        {toastMessage.key && <span className="cap-toast__key">{toastMessage.key}</span>}
      </div>
    );
  } else if (badge.visible && !s.off) {
    said =
      (s.status === 'loading'
        ? m.content.overlay.loadingSubtitles
        : s.status === 'none'
          ? s.site === 'youtube'
            ? m.content.overlay.noSubtitlesVideo
            : m.content.overlay.noSubtitlesTitle
          : s.message) ?? '';
    notice = (
      <div className={`cap-toast cap-overlay__toast${s.status === 'error' ? ' is-wrapping' : ''}`}>
        {s.status === 'loading' ? <span className="cap-spinner" /> : <span className="cap-dot cap-dot--warn" />}
        <span className="cap-spacer">{said}</span>
        {s.status !== 'loading' && (
          <button className="cap-toast__close" aria-label={m.content.overlay.dismiss} onClick={badge.dismiss}>
            <IconClose className="cap-ico" />
          </button>
        )}
      </div>
    );
  } else if (trBadge.visible && !s.off && s.status === 'ready') {
    said = m.content.panel.translationFailed(s.translationMessage);
    notice = (
      <div className="cap-toast cap-overlay__toast is-wrapping">
        <span className="cap-dot cap-dot--warn" />
        <span className="cap-spacer">{said}</span>
        <TranslationErrorAction controller={controller} className="cap-pbtn cap-toast__action" />
        <button className="cap-toast__close" aria-label={m.content.overlay.dismiss} onClick={trBadge.dismiss}>
          <IconClose className="cap-ico" />
        </button>
      </div>
    );
  }

  return (
    <HostRoot className="cap-overlay" rootRef={rootRef}>
      {notice}
      {/* Screen readers hear each notice from one region that is always there (a new node may go unheard). */}
      <div className="cap-sr" role="status">
        {said}
      </div>

      {cue && !s.off && (
        <div
          className="cap-captions cap-overlay__captions"
          style={{
            bottom: controlsClearance ? `max(${subtitles.bottomOffset}%, ${controlsClearance + 8}px)` : `${subtitles.bottomOffset}%`,
            left: `calc((100% - ${drawerSpace}px) / 2)`,
            maxWidth: `min(1100px, calc((100% - ${drawerSpace}px) * 0.92))`,
          }}
          onMouseEnter={() => controller.hoverStart(() => !!linesRef.current?.isConnected && linesRef.current.matches(':hover'))}
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
                spaceIsPlayback
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
            <div className="cap-cap cap-cap--roman" style={{ fontSize: minor(0.62) }}>
              {romanized}
            </div>
          )}
          {subtitles.showTranslation && translation && (
            <div
              className={`cap-cap cap-cap--tr${blurred ? ' is-blurred' : ''}`}
              style={{ fontSize: minor(subtitles.translationScale) }}
              lang={translationLang(s)}
              tabIndex={blurred ? 0 : undefined}
            >
              {translation}
            </div>
          )}
          {subtitles.showTranslation && !translation && s.translationStatus === 'loading' && (
            <div className="cap-cap cap-cap--pending" style={{ fontSize: minor(subtitles.translationScale * 0.8) }}>
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

      {drawerVisible && <SubtitleDrawer controller={controller} width={drawerWidth} bottom={drawerBottom} />}
      {s.site !== 'local' && <PlayerMenu controller={controller} boundsRef={rootRef} />}
      <LookupHost controller={controller} surfaces={['overlay', 'drawer']} hostRef={rootRef} />
    </HostRoot>
  );
}
