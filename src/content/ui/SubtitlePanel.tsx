import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
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
  const { m } = useI18n();
  return (
    <div className={`cap-legend ${className}`.trim()} title={m.content.panel.freqLegendTitle}>
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
        {m.content.panel.rarer}
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
  const { m, locale } = useI18n();
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

  const choices = useMemo(() => translationChoices(s), [s.tracks, s.originalTrackId, s.site, s.settings, s.aiStatus, locale]);
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
    toast(m.content.toast.subtitlesCopied);
  };
  const download = () => downloadText(`${name}.srt`, toSrt(s.cues, s.translations));
  const sub = query.trim()
    ? m.content.panel.linesMatchCount(filtered.length, s.cues.length)
    : (subtitle ?? (s.status === 'ready' ? languagePair(s) : ''));

  const head = (
    <div className="cap-panel__head">
      <div className="cap-panel__titles">
        <h2 className="cap-panel__title">{m.content.panel.subtitlesTitle}</h2>
        {sub && <div className="cap-panel__sub">{sub}</div>}
      </div>
      {s.status === 'ready' && (
        <>
          <button
            className="cap-hicon"
            aria-label={m.content.panel.searchSubtitles}
            aria-pressed={searching}
            title={m.content.panel.searchSubtitles}
            onClick={() => {
              setSearching(!searching);
              setQuery('');
              setTab('subs');
            }}
          >
            <IconSearch />
          </button>
          {page ? (
            <button
              className="cap-hicon"
              aria-label={m.content.panel.downloadSrtAria}
              title={m.content.panel.downloadSrtTitle}
              onClick={download}
            >
              <IconDownload />
            </button>
          ) : (
            <button
              className="cap-hicon cap-panel__more"
              aria-label={m.content.panel.moreAria}
              aria-haspopup="menu"
              aria-expanded={!!menu}
              title={m.common.more}
              onClick={() => setMenu(menu ? null : 'main')}
            >
              <IconMoreVertical />
            </button>
          )}
        </>
      )}
      {onClose && (
        <button className="cap-hicon" aria-label={m.content.panel.closeListAria(closeKey)} title={m.common.close} onClick={onClose}>
          <IconClose />
        </button>
      )}
    </div>
  );

  if (s.status !== 'ready') {
    return (
      <aside className={`cap-panel${page ? ' cap-panel--page' : ''}`} aria-label={m.content.panel.subtitlesAria} style={{ height: 'auto' }}>
        {head}
        <div
          className={`cap-panel__empty${s.status === 'loading' ? ' is-loading' : ''}${s.status === 'error' ? ' is-error' : ''}`}
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {s.status === 'loading' && (
            <>
              <span className="cap-spinner" />
              {m.content.panel.loadingSubtitles}
            </>
          )}
          {s.status === 'idle' && m.content.panel.idleEmpty}
          {s.status === 'none' && (
            <>
              <strong>{m.content.panel.noSubtitlesStrong}</strong>
              {m.content.panel.noSubtitlesBody}
            </>
          )}
          {s.status === 'error' && (
            <>
              <strong>{m.content.panel.errorStrong}</strong>
              {s.message}
              <div style={{ marginTop: 12 }}>
                <button className="cap-btn cap-btn--sm" onClick={() => controller.retry()}>
                  <IconRefresh className="cap-ico" />
                  {m.common.tryAgain}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className={`cap-panel${page ? ' cap-panel--page' : ''}`} aria-label={m.content.panel.subtitlesAria}>
      {head}
      {searching ? (
        <label className="cap-panel__search">
          <IconSearch className="cap-ico" />
          <span className="cap-sr">{m.content.panel.searchSubtitles}</span>
          <input
            autoFocus
            value={query}
            placeholder={m.content.panel.searchBothLines}
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
            <button className="cap-iconbtn cap-iconbtn--sm" aria-label={m.content.panel.clearSearch} onClick={() => setQuery('')}>
              <IconClose className="cap-ico" />
            </button>
          )}
        </label>
      ) : (
        <div className="cap-panel__chips" role="group" aria-label={m.content.panel.showGroup}>
          <button
            className={chip}
            aria-pressed={tab === 'subs' && showTr}
            onClick={() => {
              setTab('subs');
              if (!showTr) void updateSettings((st) => void (st.sidebar.showTranslations = true));
            }}
          >
            {m.content.panel.bothLines}
          </button>
          <button
            className={chip}
            aria-pressed={tab === 'subs' && !showTr}
            onClick={() => {
              setTab('subs');
              if (showTr) void updateSettings((st) => void (st.sidebar.showTranslations = false));
            }}
          >
            {m.content.panel.original}
          </button>
          <button className={chip} aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>
            {m.content.panel.savedTab(savedHere.length)}
          </button>
        </div>
      )}
      {s.frequency && tab === 'subs' && <FrequencyLegend className="cap-panel__legend" />}
      {s.translationStatus === 'error' && tab === 'subs' && (
        <div className="cap-panel__status is-error">
          <span className="cap-spacer">{m.content.panel.translationFailed(s.translationMessage)}</span>
          <button className="cap-btn cap-btn--sm cap-btn--ghost" onClick={() => void controller.selectTranslation(s.translationSource)}>
            {m.common.retry}
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
                <button
                  className="cap-cue__time"
                  aria-label={m.content.panel.playFromAria(formatTime(cue.start))}
                  onClick={() => controller.playCue(i)}
                >
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
                            {m.common.translating}
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
                      {m.content.panel.breakDown}
                    </button>
                    <button className="cap-btn cap-btn--sm cap-btn--ghost" onClick={() => void controller.saveLine(i)}>
                      <IconBookmark className="cap-ico" />
                      {m.content.panel.saveLine}
                    </button>
                    <button
                      className="cap-iconbtn cap-iconbtn--sm"
                      aria-label={m.content.panel.copyLine}
                      title={m.content.panel.copyLine}
                      onClick={() => void navigator.clipboard.writeText(tr ? `${cue.text}\n${tr}` : cue.text)}
                    >
                      <IconCopy className="cap-ico" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="cap-panel__empty">{m.content.panel.noLineMatch(query.trim())}</li>}
        </ol>
      ) : (
        <ol className="cap-panel__list">
          {savedHere.map((v) => (
            <li key={v.id} className="cap-cue">
              {v.context?.time !== undefined ? (
                <button
                  className="cap-cue__time"
                  aria-label={m.content.panel.jumpToAria(formatTime(v.context.time))}
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
                    {v.status === 'learning' ? m.common.learning : m.common.known}
                  </span>
                  {v.kind === 'phrase' && <span className="cap-tag">{m.common.phrase}</span>}
                </div>
                {v.translation && <div className="cap-cue__tr">{v.translation}</div>}
              </div>
            </li>
          ))}
          {savedHere.length === 0 && <li className="cap-panel__empty">{m.content.panel.savedEmpty}</li>}
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
              {m.content.panel.allSavedAndExport}
            </a>
            <span className="cap-spacer" />
            <button
              className="cap-btn cap-btn--sm cap-btn--ghost"
              style={{ color: 'var(--ink)' }}
              onClick={() => void controller.saveCurrentLine()}
            >
              <IconBookmark className="cap-ico" />
              {m.content.panel.saveCurrentLine}
            </button>
          </div>
        ) : (
          <div className="cap-panel__foot">
            <IconGlyph className="cap-ico" />
            <span className="cap-spacer">Captionary</span>
            {blur ? (
              <span>{m.content.panel.hoverToReveal}</span>
            ) : (
              <>
                <span style={{ color: 'var(--ink)' }}>{m.content.panel.pauseAfterEachLine}</span>
                <PlayerSwitch
                  label={m.content.panel.pauseAfterEachLine}
                  checked={settings.playback.autoPause}
                  onChange={(v) => void updateSettings((st) => void (st.playback.autoPause = v))}
                />
              </>
            )}
          </div>
        ))}

      {menu && (
        <div ref={menuRef} role="menu" aria-label={m.content.panel.subtitleOptionsAria} className="cap-menu cap-menu--page cap-panel__menu">
          {menu === 'original' ? (
            <>
              <MenuBack title={m.content.panel.originalTrack} onBack={() => setMenu('main')} />
              <OriginalChoices
                controller={controller}
                tracks={originalTracks(s.tracks)}
                originalTrackId={s.originalTrackId}
                onDone={() => setMenu(null)}
              />
            </>
          ) : menu === 'translation' ? (
            <>
              <MenuBack title={m.content.playerMenu.translation} onBack={() => setMenu('main')} />
              <TranslationChoices controller={controller} choices={choices} current={s.translationSource} onDone={() => setMenu(null)} />
            </>
          ) : (
            <>
              <MenuRow
                label={m.content.panel.originalTrack}
                value={originalValue(s.tracks, s.originalTrackId)}
                onClick={() => setMenu('original')}
              />
              <MenuRow
                label={m.content.playerMenu.translation}
                value={translationValue(choices, s.translationSource)}
                onClick={() => setMenu('translation')}
              />
              <div className="cap-menu__item">
                <span className="cap-menu__label">{m.content.panel.colourByFrequency}</span>
                <PlayerSwitch
                  role="menuitemcheckbox"
                  label={m.content.panel.colourByFrequency}
                  checked={settings.subtitles.frequencyColors}
                  onChange={(v) => void updateSettings((st) => void (st.subtitles.frequencyColors = v))}
                />
              </div>
              <div className="cap-menu__sep" />
              <MenuRow
                label={m.content.panel.copyAllSubtitles}
                icon={<IconCopy className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  copyAll();
                  setMenu(null);
                }}
              />
              <MenuRow
                label={m.content.panel.downloadSrtMenu}
                icon={<IconDownload className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  download();
                  setMenu(null);
                }}
              />
              <MenuRow
                label={m.content.panel.openInReader}
                icon={<IconDocument className="cap-menu__icon" />}
                chevron={false}
                onClick={() => {
                  openInReader(s);
                  setMenu(null);
                }}
              />
              <div className="cap-menu__sep" />
              <MenuRow
                label={m.content.panel.captionarySettings}
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
