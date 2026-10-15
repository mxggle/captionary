import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { sourceKey, translationChoices, translationValue } from './subtitles';

type Page = 'main' | 'original' | 'translation';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Above the button that opened it (below it when the button is in the top half), inside the player. */
function placeMenu(anchor: AnchorRect | null, bounds: DOMRect, width: number, alignRight: boolean): CSSProperties {
  const maxRight = Math.max(12, bounds.width - width - 12);
  if (!anchor) return { right: 12, bottom: 64, maxHeight: bounds.height - 76 };
  const right = alignRight ? 12 : clamp(bounds.right - (anchor.left + anchor.width), 12, maxRight);
  if (anchor.top - bounds.top > bounds.height / 2) {
    const bottom = bounds.bottom - anchor.top + 12;
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
  const ref = useRef<HTMLDivElement>(null);
  const choices = useMemo(() => translationChoices(s), [s.tracks, s.originalTrackId, s.site, s.settings, s.aiStatus]);
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

  if (!s.menuOpen) return null;
  const bounds = boundsRef.current?.getBoundingClientRect();
  if (!bounds) return null;

  const skin = s.theme === 'netflix' ? 'netflix' : s.theme === 'appletv' ? 'appletv' : 'youtube';
  const width = skin === 'netflix' ? Math.min(560, bounds.width - 24) : skin === 'appletv' ? 290 : 300;
  const style = { ...placeMenu(s.menuAnchor, bounds, width, skin === 'youtube'), width };
  const { settings } = s;
  const set = (fn: (st: Settings) => void) => void updateSettings(fn);
  const keys = settings.shortcuts;
  const open = (page: 'vocab' | 'options', hash?: string) => {
    controller.closeMenu();
    void bg({ type: 'open.page', page, hash }).catch(() => undefined);
  };

  const onSwitch = (
    <PlayerSwitch role="menuitemcheckbox" label="Captionary on for this video" checked={!s.off} onChange={(on) => controller.setOff(!on)} />
  );
  const pause = (
    <MenuSwitch
      label="Pause after each line"
      keyName={skin === 'appletv' ? undefined : keyName(keys.toggleAutoPause)}
      checked={settings.playback.autoPause}
      onChange={(v) => set((st) => void (st.playback.autoPause = v))}
    />
  );
  const blur = (
    <MenuSwitch
      label="Blur translation until hover"
      checked={settings.subtitles.blurTranslation}
      onChange={(v) => set((st) => void (st.subtitles.blurTranslation = v))}
    />
  );
  const list = (
    <MenuSwitch
      label="Subtitle list"
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
      <MenuRow label="Saved words" value={`${learning} learning`} onClick={() => open('vocab')} />
      <MenuRow label="All Captionary settings" onClick={() => open('options', 'subtitles')} />
    </>
  );

  let body;
  if (page === 'original') {
    body = (
      <>
        <MenuBack title="Original subtitles" onBack={() => setPage('main')} />
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
        <MenuBack title="Translation" onBack={() => setPage('main')} />
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
          <span className="cap-menu__muted">{s.off ? 'Off for this title' : 'On for this title'}</span>
          {onSwitch}
        </div>
        <div className="cap-menu__cols">
          <div className="cap-menu__col" role="group" aria-label="Original subtitles">
            <div className="cap-menu__colhead">Original</div>
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
          <div className="cap-menu__col" role="group" aria-label="Translation">
            <div className="cap-menu__colhead">Translation</div>
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
          <MenuRow label="Saved words" value={`${learning} learning`} onClick={() => open('vocab')} />
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
        <div className="cap-menu__section">Original</div>
        <OriginalChoices controller={controller} tracks={inline} originalTrackId={s.originalTrackId} />
        {more && <MenuRow label="Other languages" onClick={() => setPage('original')} />}
        <div className="cap-menu__section">Translation</div>
        <TranslationChoices controller={controller} choices={choices.filter((c) => c.primary)} current={s.translationSource} />
        {choices.some((c) => !c.primary) && <MenuRow label="Other subtitle tracks" onClick={() => setPage('translation')} />}
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
        <MenuRow label="Original subtitles" value={originalValue(s.tracks, s.originalTrackId)} onClick={() => setPage('original')} />
        <MenuRow label="Translation" value={translationValue(choices, s.translationSource)} onClick={() => setPage('translation')} />
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
