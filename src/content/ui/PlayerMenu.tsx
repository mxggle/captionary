import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/lib/i18n';
import { sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { updateSettings, type Settings } from '@/lib/settings';
import { PlayerSwitch } from '@/ui/controls';
import { IconCheck, IconGlyph } from '@/ui/icons';
import { keyName, type SessionController } from '../controller';
import { useSession, type AnchorRect } from '../store';
import {
  MenuBack,
  MenuRow,
  MenuSwitch,
  OriginalChoices,
  originalTracks,
  originalValue,
  sameLanguageTracks,
  TranslationChoices,
} from './menus';
import { measureClearance, playerOf } from './clearance';
import { sourceKey, translationChoices, translationValue } from './subtitles';
import { useContainWheel } from './wheel';

type Page = 'main' | 'original' | 'translation';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Above the button that opened it and the host's progress bar (`clearance`), or below the button when
 * it is in the top half; inside the player.
 */
function placeMenu(anchor: AnchorRect | null, bounds: DOMRect, width: number, alignRight: boolean, clearance: number): CSSProperties {
  const maxRight = Math.max(12, bounds.width - width - 12);
  if (!anchor) return { right: 12, bottom: Math.max(64, clearance + 12), maxHeight: bounds.height - 76 };
  const right = alignRight ? 12 : clamp(bounds.right - (anchor.left + anchor.width), 12, maxRight);
  if (anchor.top - bounds.top > bounds.height / 2) {
    const bottom = Math.max(bounds.bottom - anchor.top + 12, clearance + 12);
    return { right, bottom, maxHeight: Math.max(160, bounds.height - bottom - 12) };
  }
  const top = anchor.top + anchor.height - bounds.top + 8;
  return { right, top, maxHeight: Math.max(160, bounds.height - top - 12) };
}

/**
 * Captionary's settings for the video being watched, opened from the player button and shaped like
 * the host's own settings menu (`PlayerMenu`): rows with sub-pages on YouTube, inline sections with
 * checks on Apple TV+, two columns on Netflix.
 */
export function PlayerMenu({ controller, boundsRef }: { controller: SessionController; boundsRef: RefObject<HTMLElement | null> }) {
  const { m, locale } = useI18n();
  const s = useSession(
    useShallow((st) => ({
      menuOpen: st.menuOpen,
      menuAnchor: st.menuAnchor,
      theme: st.theme,
      settings: st.settings,
      site: st.site,
      tracks: st.tracks,
      originalTrackId: st.originalTrackId,
      translationSource: st.translationSource,
      aiStatus: st.aiStatus,
      lang: st.lang,
      vocab: st.vocab,
      off: st.off,
      drawerOpen: st.drawerOpen,
      fullscreen: st.fullscreen,
    })),
  );
  const [page, setPage] = useState<Page>('main');
  // Measured as the menu opens: Netflix hides its control bar once the pointer is over the menu, and
  // the menu should not drop onto where the bar was.
  const [clearance, setClearance] = useState(0);
  useLayoutEffect(() => {
    if (s.menuOpen) setClearance(measureClearance(playerOf(boundsRef.current), controller.adapter.controlBars));
  }, [s.menuOpen, s.menuAnchor]);
  const ref = useRef<HTMLDivElement>(null);
  const choices = useMemo(() => translationChoices(s), [s.tracks, s.originalTrackId, s.site, s.settings, s.aiStatus, locale]);
  const learning = useMemo(
    () => Object.values(s.vocab).filter((v) => v.status === 'learning' && (!s.lang || sameLang(v.lang, s.lang))).length,
    [s.vocab, s.lang],
  );

  useEffect(() => {
    if (!s.menuOpen) return setPage('main');
    // Close on a click anywhere else, except on the button that toggles the menu.
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      if (ref.current && path.includes(ref.current)) return;
      if (path.some((n) => n instanceof Element && (n.localName === 'captionary-button' || n.classList?.contains('cap-overlay__fab'))))
        return;
      controller.closeMenu();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [s.menuOpen, controller]);
  useContainWheel(ref, s.menuOpen);

  if (!s.menuOpen) return null;
  const bounds = boundsRef.current?.getBoundingClientRect();
  if (!bounds) return null;

  const skin = s.theme === 'netflix' ? 'netflix' : s.theme === 'appletv' ? 'appletv' : 'youtube';
  const width = skin === 'netflix' ? Math.min(560, bounds.width - 24) : skin === 'appletv' ? 290 : 300;
  const style = { ...placeMenu(s.menuAnchor, bounds, width, skin === 'youtube', clearance), width };
  const { settings } = s;
  const set = (fn: (st: Settings) => void) => void updateSettings(fn);
  const keys = settings.shortcuts;
  const open = (page: 'vocab' | 'options', hash?: string) => {
    controller.closeMenu();
    void bg({ type: 'open.page', page, hash }).catch(() => undefined);
  };

  const onSwitch = (
    <PlayerSwitch
      role="menuitemcheckbox"
      label={m.content.playerMenu.onForVideoAria}
      checked={!s.off}
      onChange={(on) => controller.setOff(!on)}
    />
  );
  const pause = (
    <MenuSwitch
      label={m.content.playerMenu.pauseAfterEachLine}
      keyName={skin === 'appletv' ? undefined : keyName(keys.toggleAutoPause)}
      checked={settings.playback.autoPause}
      onChange={(v) => set((st) => void (st.playback.autoPause = v))}
    />
  );
  const blur = (
    <MenuSwitch
      label={m.content.playerMenu.blurTranslation}
      checked={settings.subtitles.blurTranslation}
      onChange={(v) => set((st) => void (st.subtitles.blurTranslation = v))}
    />
  );
  const list = (
    <MenuSwitch
      label={m.content.playerMenu.subtitleList}
      keyName={skin === 'appletv' ? undefined : keyName(keys.toggleSidebar)}
      checked={controller.isListOpen()}
      onChange={() => {
        controller.toggleList();
        if (controller.listMode() === 'drawer') controller.closeMenu();
      }}
    />
  );
  const links = (
    <>
      <MenuRow label={m.content.playerMenu.savedWords} value={m.content.playerMenu.learningCount(learning)} onClick={() => open('vocab')} />
      <MenuRow label={m.content.playerMenu.allSettings} onClick={() => open('options', 'subtitles')} />
    </>
  );

  let body;
  if (page === 'original') {
    body = (
      <>
        <MenuBack title={m.content.playerMenu.originalSubtitles} onBack={() => setPage('main')} />
        <OriginalChoices
          controller={controller}
          tracks={originalTracks(s.tracks)}
          originalTrackId={s.originalTrackId}
          onDone={() => setPage('main')}
        />
      </>
    );
  } else if (page === 'translation') {
    body = (
      <>
        <MenuBack title={m.content.playerMenu.translation} onBack={() => setPage('main')} />
        <TranslationChoices controller={controller} choices={choices} current={s.translationSource} onDone={() => setPage('main')} />
      </>
    );
  } else if (skin === 'netflix') {
    const current = sourceKey(s.translationSource);
    body = (
      <>
        <div className="cap-menu__head">
          <IconGlyph className="cap-ico-lg" />
          <span className="cap-menu__label" style={{ fontWeight: 700 }}>
            Captionary
          </span>
          <span className="cap-menu__muted">{s.off ? m.content.playerMenu.offForTitle : m.content.playerMenu.onForTitle}</span>
          {onSwitch}
        </div>
        <div className="cap-menu__cols">
          <div className="cap-menu__col" role="group" aria-label={m.content.playerMenu.originalSubtitles}>
            <div className="cap-menu__colhead">{m.content.playerMenu.originalShort}</div>
            {originalTracks(s.tracks).map((t) => (
              <button
                key={t.id}
                className="cap-menu__opt"
                role="menuitemradio"
                aria-checked={t.id === s.originalTrackId}
                onClick={() => t.id !== s.originalTrackId && void controller.selectOriginalTrack(t.id)}
              >
                <IconCheck />
                {t.label}
              </button>
            ))}
          </div>
          <div className="cap-menu__col" role="group" aria-label={m.content.playerMenu.translation}>
            <div className="cap-menu__colhead">{m.content.playerMenu.translation}</div>
            {choices.map((c) => (
              <button
                key={c.key}
                className="cap-menu__opt"
                role="menuitemradio"
                aria-checked={c.key === current}
                onClick={() => c.key !== current && void controller.selectTranslation(c.source)}
              >
                <IconCheck />
                {c.label}
                {c.meta && <small>{c.meta}</small>}
              </button>
            ))}
          </div>
        </div>
        <div className="cap-menu__sep" style={{ margin: '8px 0' }} />
        <div className="cap-menu__cols">
          {pause}
          {list}
          {blur}
          <MenuRow
            label={m.content.playerMenu.savedWords}
            value={m.content.playerMenu.learningCount(learning)}
            onClick={() => open('vocab')}
          />
        </div>
      </>
    );
  } else if (skin === 'appletv') {
    const inline = sameLanguageTracks(s.tracks, s.originalTrackId);
    const more = originalTracks(s.tracks).length > inline.length;
    body = (
      <>
        <div className="cap-menu__head">
          <IconGlyph className="cap-ico-lg" />
          <span className="cap-menu__label">Captionary</span>
          {onSwitch}
        </div>
        <div className="cap-menu__section">{m.content.playerMenu.originalShort}</div>
        <OriginalChoices controller={controller} tracks={inline} originalTrackId={s.originalTrackId} />
        {more && <MenuRow label={m.content.playerMenu.otherLanguages} onClick={() => setPage('original')} />}
        <div className="cap-menu__section">{m.content.playerMenu.translation}</div>
        <TranslationChoices controller={controller} choices={choices.filter((c) => c.primary)} current={s.translationSource} />
        {choices.some((c) => !c.primary) && (
          <MenuRow label={m.content.playerMenu.otherSubtitleTracks} onClick={() => setPage('translation')} />
        )}
        <div className="cap-menu__sep" />
        {pause}
        {blur}
        {list}
        <div className="cap-menu__sep" />
        {links}
      </>
    );
  } else {
    body = (
      <>
        <div className="cap-menu__head">
          <IconGlyph className="cap-ico-lg" />
          <span className="cap-menu__label">Captionary</span>
          {onSwitch}
        </div>
        <div className="cap-menu__sep" />
        <MenuRow
          label={m.content.playerMenu.originalSubtitles}
          value={originalValue(s.tracks, s.originalTrackId)}
          onClick={() => setPage('original')}
        />
        <MenuRow
          label={m.content.playerMenu.translation}
          value={translationValue(choices, s.translationSource)}
          onClick={() => setPage('translation')}
        />
        {pause}
        {blur}
        {list}
        <div className="cap-menu__sep" />
        {links}
      </>
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Captionary"
      className={`cap-menu cap-overlay__menu${skin === 'netflix' ? ' cap-menu--wide' : ''}`}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') controller.closeMenu();
      }}
    >
      {body}
    </div>
  );
}
