import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { updateSettings } from '@/lib/settings';
import { formatTime, toPlainText, toSrt } from '@/lib/subtitles/parse';
import { PlayerSwitch } from '@/ui/controls';
import {
  IconBookmark,
  IconClose,
  IconCopy,
  IconDocument,
  IconDownload,
  IconGlyph,
  IconMoreVertical,
  IconRefresh,
  IconSearch,
  IconSpark,
} from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useVocabIndex } from '@/ui/vocab-index';
import { keyName, toast, type SessionController } from '../controller';
import { LookupHost } from './LookupHost';
import { MenuBack, MenuRow, OriginalChoices, originalTracks, originalValue, TranslationChoices } from './menus';
import {
  downloadText,
  fileBase,
  languagePair,
  openInReader,
  translationChoices,
  translationValue,
  useFollowPlayback,
  useSubtitleData,
} from './subtitles';

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.toLowerCase();
  const parts: ReactNode[] = [];
  let at = 0;
  const lower = text.toLowerCase();
  for (let i = lower.indexOf(q); q && i >= 0; i = lower.indexOf(q, i + q.length)) {
    parts.push(
      text.slice(at, i),
      <strong key={i} className="cap-cue__match">
        {text.slice(i, i + q.length)}
      </strong>,
    );
    at = i + q.length;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

export function FrequencyLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`cap-legend ${className}`.trim()} title="Words underlined by how common they are in film and TV subtitles">
      <span>
        <i style={{ background: 'var(--freq-mid)' }} />
        2k–8k
      </span>
      <span>
        <i style={{ background: 'var(--freq-rare)' }} />
        8k–20k
      </span>
      <span>
        <i style={{ background: 'var(--freq-vrare)' }} />
        rarer
      </span>
    </div>
  );
}

/**
 * The full subtitle list where the host keeps its own side panels (`SubtitlePanel`): YouTube's right
 * column in the host's skin, or the reader's video mode on paper (`variant="page"`).
 */
export function SubtitlePanel({
  controller,
  variant = 'host',
  onClose,
  subtitle,
}: {
  controller: SessionController;
  variant?: 'host' | 'page';
  onClose?: () => void;
  /** Replaces the language pair under the title (the reader shows the file name). */
  subtitle?: string;
}) {
  const s = useSubtitleData();
  const [tab, setTab] = useState<'subs' | 'saved'>('subs');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<null | 'main' | 'original' | 'translation'>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const index = useVocabIndex(s.vocab, s.lang);
  const { settings } = s;
  const showTr = settings.sidebar.showTranslations;
  const blur = settings.subtitles.blurTranslation;
  const current = s.activeIndex >= 0 ? s.activeIndex : s.lastIndex;
  const follow = useFollowPlayback(listRef, current, settings.sidebar.autoScroll && tab === 'subs' && !query);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      if (menuRef.current && path.includes(menuRef.current)) return;
      if (path.some((n) => n instanceof Element && n.classList?.contains('cap-panel__more'))) return;
      setMenu(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = s.cues.map((_, i) => i);
    if (!q) return all;
    return all.filter((i) => s.cues[i].text.toLowerCase().includes(q) || s.translations[i]?.toLowerCase().includes(q));
  }, [query, s.cues, s.translations]);

  const choices = useMemo(() => translationChoices(s), [s.tracks, s.originalTrackId, s.site, s.settings, s.aiStatus]);
  const savedHere = useMemo(() => {
    const id = s.media?.id;
    return Object.values(s.vocab)
      .filter((v) => sameLang(v.lang, s.lang) && (!id || v.context?.url?.includes(id)))
      .sort((a, b) => (a.context?.time ?? 0) - (b.context?.time ?? 0));
  }, [s.vocab, s.lang, s.media]);

  const page = variant === 'page';
  const chip = page ? 'cap-chip cap-chip--sm' : 'cap-nchip';
  const closeKey = keyName(settings.shortcuts.toggleSidebar);
  const name = fileBase(s.media?.title);
  const copyAll = () => {
    void navigator.clipboard.writeText(toPlainText(s.cues, s.translations));
    toast('Subtitles copied');
  };
  const download = () => downloadText(`${name}.srt`, toSrt(s.cues, s.translations));
  const sub = query.trim() ? `${filtered.length} of ${s.cues.length} lines` : (subtitle ?? (s.status === 'ready' ? languagePair(s) : ''));

  const head = (
    <div className="cap-panel__head">
      <div className="cap-panel__titles">
        <h2 className="cap-panel__title">Subtitles</h2>
        {sub && <div className="cap-panel__sub">{sub}</div>}
      </div>
      {s.status === 'ready' && (
        <>
          <button
            className="cap-hicon"
            aria-label="Search subtitles"
            aria-pressed={searching}
            title="Search subtitles"
            onClick={() => {
              setSearching(!searching);
              setQuery('');
              setTab('subs');
            }}
          >
            <IconSearch />
          </button>
          {page ? (
            <button className="cap-hicon" aria-label="Download .srt with translations" title="Download .srt" onClick={download}>
              <IconDownload />
            </button>
          ) : (
            <button
              className="cap-hicon cap-panel__more"
              aria-label="More: tracks, copy, download .srt, settings"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              title="More"
              onClick={() => setMenu(menu ? null : 'main')}
            >
              <IconMoreVertical />
            </button>
          )}
        </>
      )}
      {onClose && (
        <button className="cap-hicon" aria-label={`Close subtitle list${closeKey ? ` (${closeKey})` : ''}`} title="Close" onClick={onClose}>
          <IconClose />
        </button>
      )}
    </div>
  );

  if (s.status !== 'ready') {
    return (
      <aside className={`cap-panel${page ? ' cap-panel--page' : ''}`} aria-label="Captionary subtitles" style={{ height: 'auto' }}>
        {head}
        <div
          className={`cap-panel__empty${s.status === 'loading' ? ' is-loading' : ''}${s.status === 'error' ? ' is-error' : ''}`}
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {s.status === 'loading' && (
            <>
              <span className="cap-spinner" />
              Loading subtitles…
            </>
          )}
          {s.status === 'idle' && 'Open a video to see its subtitles here.'}
          {s.status === 'none' && (
            <>
              <strong>No subtitles for this video</strong>
              Captionary needs the video’s own captions or a subtitle track. Try another video, or open a subtitle file in the reader.
            </>
          )}
          {s.status === 'error' && (
            <>
              <strong>The captions didn’t load</strong>
              {s.message}
              <div style={{ marginTop: 12 }}>
                <button className="cap-btn cap-btn--sm" onClick={() => controller.retry()}>
                  <IconRefresh className="cap-ico" />
                  Try again
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className={`cap-panel${page ? ' cap-panel--page' : ''}`} aria-label="Captionary subtitles">
      {head}
      {searching ? (
        <label className="cap-panel__search">
          <IconSearch className="cap-ico" />
          <span className="cap-sr">Search subtitles</span>
          <input
            autoFocus
            value={query}
            placeholder="Search both lines"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setSearching(false);
                setQuery('');
              }
            }}
          />
          {query && (
            <button className="cap-iconbtn cap-iconbtn--sm" aria-label="Clear search" onClick={() => setQuery('')}>
              <IconClose className="cap-ico" />
            </button>
          )}
        </label>
      ) : (
        <div className="cap-panel__chips" role="group" aria-label="Show">
          <button
            className={chip}
            aria-pressed={tab === 'subs' && showTr}
            onClick={() => {
              setTab('subs');
              if (!showTr) void updateSettings((st) => void (st.sidebar.showTranslations = true));
            }}
          >
            Both lines
          </button>
          <button
            className={chip}
            aria-pressed={tab === 'subs' && !showTr}
            onClick={() => {
              setTab('subs');
              if (showTr) void updateSettings((st) => void (st.sidebar.showTranslations = false));
            }}
          >
            Original
          </button>
          <button className={chip} aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>
            Saved · {savedHere.length}
          </button>
        </div>
      )}
      {s.frequency && tab === 'subs' && <FrequencyLegend className="cap-panel__legend" />}
      {s.translationStatus === 'error' && tab === 'subs' && (
        <div className="cap-panel__status is-error">
          <span className="cap-spacer">The translation failed: {s.translationMessage}</span>
          <button className="cap-btn cap-btn--sm cap-btn--ghost" onClick={() => void controller.selectTranslation(s.translationSource)}>
            Retry
          </button>
        </div>
      )}

      {tab === 'subs' ? (
        <ol className="cap-panel__list" ref={listRef} {...follow}>
          {filtered.map((i) => {
            const cue = s.cues[i];
            const tr = s.translations[i];
            const roman = settings.subtitles.showRomanization ? s.romanizations[i] : '';
            const selected = s.popup?.surface === 'sidebar' && s.popup.cueIndex === i ? s.popup.tokenRange : undefined;
            return (
              <li key={i} data-i={i} className="cap-cue" aria-current={i === current || undefined}>
                <button className="cap-cue__time" aria-label={`Play from ${formatTime(cue.start)}`} onClick={() => controller.playCue(i)}>
                  {formatTime(cue.start)}
                </button>
                <div className="cap-cue__body">
                  <div className="cap-cue__text" lang={s.lang}>
                    {query.trim() ? (
                      <Highlighted text={cue.text} query={query.trim()} />
                    ) : (
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
                            surface: 'sidebar',
                            tokenRange: sel.range,
                          })
                        }
                      />
                    )}
                  </div>
                  {roman && <div className="cap-cue__roman">{roman}</div>}
                  {showTr &&
                    (tr ? (
                      <div className={`cap-cue__tr${blur ? ' is-blurred' : ''}`}>
                        {query.trim() ? <Highlighted text={tr} query={query.trim()} /> : tr}
                      </div>
                    ) : (
                      s.translationStatus === 'loading' && (
                        <div className="cap-cue__tr">
                          <span className="cap-cue__pending">
                            <span className="cap-spinner" />
                            translating…
                          </span>
                        </div>
                      )
                    ))}
                  <div className="cap-cue__tools">
                    <button
                      className="cap-btn cap-btn--sm cap-btn--ghost"
                      onClick={(e) => {
                        const r = (e.currentTarget.closest('.cap-cue') as HTMLElement).getBoundingClientRect();
                        controller.openPopup({
                          kind: 'sentence',
                          text: cue.text,
                          cueIndex: i,
                          rect: { left: r.left, top: r.top, width: r.width, height: r.height },
                          surface: 'sidebar',
                        });
                      }}
                    >
                      <IconSpark className="cap-ico" />
                      Break down
                    </button>
                    <button className="cap-btn cap-btn--sm cap-btn--ghost" onClick={() => void controller.saveLine(i)}>
                      <IconBookmark className="cap-ico" />
                      Save line
                    </button>
                    <button
                      className="cap-iconbtn cap-iconbtn--sm"
                      aria-label="Copy line"
                      title="Copy line"
                      onClick={() => void navigator.clipboard.writeText(tr ? `${cue.text}\n${tr}` : cue.text)}
                    >
                      <IconCopy className="cap-ico" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="cap-panel__empty">No line contains “{query.trim()}”.</li>}
        </ol>
      ) : (
        <ol className="cap-panel__list">
          {savedHere.map((v) => (
            <li key={v.id} className="cap-cue">
              {v.context?.time !== undefined ? (
                <button
                  className="cap-cue__time"
                  aria-label={`Jump to ${formatTime(v.context.time)}`}
                  onClick={() => controller.adapter.seek(v.context!.time!)}
                >
                  {formatTime(v.context.time)}
                </button>
              ) : (
                <span className="cap-cue__time" style={{ visibility: 'hidden' }}>
                  0:00
                </span>
              )}
              <div className="cap-cue__body">
                <div className="cap-row" style={{ gap: 6 }}>
                  <span className="cap-panel__word" lang={v.lang}>
                    {v.text}
                  </span>
                  <span className={`cap-tag ${v.status === 'learning' ? 'cap-tag--learn' : 'cap-tag--known'}`}>
                    {v.status === 'learning' ? 'Learning' : 'Known'}
                  </span>
                  {v.kind === 'phrase' && <span className="cap-tag">phrase</span>}
                </div>
                {v.translation && <div className="cap-cue__tr">{v.translation}</div>}
              </div>
            </li>
          ))}
          {savedHere.length === 0 && (
            <li className="cap-panel__empty">
              Click a word in the subtitles, then Save. Saved words are underlined wherever you meet them again.
            </li>
          )}
        </ol>
      )}

      {!page &&
        (tab === 'saved' ? (
          <div className="cap-panel__foot">
            <a
              href="#vocab"
              onClick={(e) => {
                e.preventDefault();
                void bg({ type: 'open.page', page: 'vocab' }).catch(() => undefined);
              }}
            >
              All saved words and export
            </a>
            <span className="cap-spacer" />
            <button
              className="cap-btn cap-btn--sm cap-btn--ghost"
              style={{ color: 'var(--ink)' }}
              onClick={() => void controller.saveCurrentLine()}
            >
              <IconBookmark className="cap-ico" />
              Save current line
            </button>
          </div>
        ) : (
          <div className="cap-panel__foot">
            <IconGlyph className="cap-ico" />
            <span className="cap-spacer">Captionary</span>
            {blur ? (
              <span>Hover a translation to reveal it</span>
            ) : (
              <>
                <span style={{ color: 'var(--ink)' }}>Pause after each line</span>
                <PlayerSwitch
                  label="Pause after each line"
                  checked={settings.playback.autoPause}
                  onChange={(v) => void updateSettings((st) => void (st.playback.autoPause = v))}
                />
              </>
            )}
          </div>
        ))}

      {menu && (
        <div ref={menuRef} role="menu" aria-label="Subtitle options" className="cap-menu cap-menu--page cap-panel__menu">
          {menu === 'original' ? (
            <>
              <MenuBack title="Original track" onBack={() => setMenu('main')} />
              <OriginalChoices
                controller={controller}
                tracks={originalTracks(s.tracks)}
                originalTrackId={s.originalTrackId}
                onDone={() => setMenu(null)}
              />
            </>
          ) : menu === 'translation' ? (
            <>
              <MenuBack title="Translation" onBack={() => setMenu('main')} />
              <TranslationChoices controller={controller} choices={choices} current={s.translationSource} onDone={() => setMenu(null)} />
            </>
          ) : (
            <>
              <MenuRow label="Original track" value={originalValue(s.tracks, s.originalTrackId)} onClick={() => setMenu('original')} />
              <MenuRow label="Translation" value={translationValue(choices, s.translationSource)} onClick={() => setMenu('translation')} />
              <div className="cap-menu__item">
                <span className="cap-menu__label">Colour words by frequency</span>
                <PlayerSwitch
                  role="menuitemcheckbox"
                  label="Colour words by frequency"
                  checked={settings.subtitles.frequencyColors}
                  onChange={(v) => void updateSettings((st) => void (st.subtitles.frequencyColors = v))}
                />
              </div>
              <div className="cap-menu__sep" />
              <MenuRow
                label="Copy all subtitles"
                icon={<IconCopy className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  copyAll();
                  setMenu(null);
                }}
              />
              <MenuRow
                label="Download .srt with translations"
                icon={<IconDownload className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  download();
                  setMenu(null);
                }}
              />
              <MenuRow
                label="Open in the reader"
                icon={<IconDocument className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  openInReader(s);
                  setMenu(null);
                }}
              />
              <div className="cap-menu__sep" />
              <MenuRow
                label="Captionary settings"
                onClick={() => {
                  setMenu(null);
                  void bg({ type: 'open.page', page: 'options', hash: 'subtitles' }).catch(() => undefined);
                }}
              />
            </>
          )}
        </div>
      )}
      {/* Fixed to the viewport: the list clips overflow, and the card is wider than some columns. */}
      {s.popup?.surface === 'sidebar' && <LookupHost controller={controller} surfaces={['sidebar']} />}
    </aside>
  );
}
