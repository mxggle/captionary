import { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/subtitles/parse';
import { IconChevronDown, IconClose, IconGlyph } from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useVocabIndex } from '@/ui/vocab-index';
import { drawerAnchor, keyName, type SessionController } from '../controller';
import { setSession } from '../store';
import { languagePair, useFollowPlayback, useSubtitleData } from './subtitles';

/**
 * The subtitle list as a right-edge drawer over a fullscreen video, read like song lyrics
 * (`SubtitleDrawer`): the line playing now in full ink, the rest muted. Opened only with W or from
 * the player menu.
 */
export function SubtitleDrawer({ controller, width }: { controller: SessionController; width: number }) {
  const s = useSubtitleData();
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const index = useVocabIndex(s.vocab, s.lang);
  const { settings } = s;
  const current = s.activeIndex >= 0 ? s.activeIndex : s.lastIndex;
  const follow = useFollowPlayback(listRef, current, settings.sidebar.autoScroll, 'center');
  const keys = settings.shortcuts;
  const close = () => setSession({ drawerOpen: false });

  useEffect(() => {
    drawerAnchor.get = () => {
      const r = ref.current?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };
    return () => {
      drawerAnchor.get = null;
    };
  }, []);

  const lineKeys = [keyName(keys.prevLine), keyName(keys.repeatLine), keyName(keys.nextLine)];
  const closeKey = keyName(keys.toggleSidebar);

  return (
    <aside ref={ref} className="cap-drawer cap-overlay__drawer" style={{ width }} aria-label="Captionary subtitles">
      <div className="cap-drawer__head">
        <div className="cap-spacer">
          <h2 className="cap-drawer__title">Subtitles</h2>
          {s.lang && (
            <button
              className="cap-drawer__sub"
              aria-haspopup="menu"
              title="Choose the subtitle tracks"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                controller.openMenu({ left: r.left, top: r.top, width: r.width, height: r.height });
              }}
            >
              {languagePair(s)}
              <IconChevronDown className="cap-ico" />
            </button>
          )}
        </div>
        {s.theme === 'appletv' ? (
          <button className="cap-drawer__close" aria-label={`Close subtitle list${closeKey ? ` (${closeKey})` : ''}`} onClick={close}>
            <IconClose width={14} height={14} strokeWidth={3} />
          </button>
        ) : (
          <button
            className="cap-picon"
            style={{ color: 'var(--player-ink)' }}
            aria-label={`Close subtitle list${closeKey ? ` (${closeKey})` : ''}`}
            onClick={close}
          >
            <IconClose className="cap-ico-lg" />
          </button>
        )}
      </div>
      <ol className="cap-drawer__list" ref={listRef} {...follow}>
        {s.status === 'loading' && <li className="cap-drawer__empty">Loading subtitles…</li>}
        {s.status === 'none' && <li className="cap-drawer__empty">No subtitles for this title.</li>}
        {s.status === 'error' && <li className="cap-drawer__empty">{s.message}</li>}
        {s.cues.map((cue, i) => {
          const tr = settings.sidebar.showTranslations ? s.translations[i] : undefined;
          const roman = settings.subtitles.showRomanization ? s.romanizations[i] : '';
          const selected = s.popup?.surface === 'drawer' && s.popup.cueIndex === i ? s.popup.tokenRange : undefined;
          return (
            <li key={i} data-i={i} className="cap-lyric" aria-current={i === current || undefined}>
              <button className="cap-lyric__time" aria-label={`Play from ${formatTime(cue.start)}`} onClick={() => controller.playCue(i)}>
                {formatTime(cue.start)}
              </button>
              <div>
                <div className="cap-lyric__text" lang={s.lang}>
                  <TokenizedText
                    text={cue.text}
                    lang={s.lang}
                    index={index}
                    highlight={settings.subtitles.highlight}
                    freq={s.frequency}
                    selected={selected}
                    onSelect={(sel) =>
                      controller.openPopup({
                        kind: 'word',
                        text: sel.text,
                        cueIndex: i,
                        rect: sel.rect,
                        surface: 'drawer',
                        tokenRange: sel.range,
                      })
                    }
                  />
                </div>
                {roman && <div className="cap-lyric__roman">{roman}</div>}
                {tr && <div className={`cap-lyric__tr${settings.subtitles.blurTranslation ? ' is-blurred' : ''}`}>{tr}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="cap-drawer__foot">
        <IconGlyph className="cap-ico" />
        <span className="cap-spacer">Captionary</span>
        {lineKeys.every(Boolean) && (
          <span>
            <kbd>{lineKeys[0]}</kbd> <kbd>{lineKeys[1]}</kbd> <kbd>{lineKeys[2]}</kbd> previous · repeat · next
          </span>
        )}
      </div>
    </aside>
  );
}
