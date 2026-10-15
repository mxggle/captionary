import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { languageName, sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { updateSettings } from '@/lib/settings';
import { formatTime, toPlainText, toSrt } from '@/lib/subtitles/parse';
import type { TranslationSource } from '@/lib/subtitles/types';
import { sourceUrl } from '@/lib/vocab';
import { IconBook, IconBookmark, IconClose, IconCopy, IconDownload, IconPlay, IconSearch, IconSettings, IconSparkles } from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useVocabIndex } from '@/ui/vocab-index';
import { toast, type SessionController } from '../controller';
import { useSession } from '../store';
import { PopupHost } from './PopupHost';

function sourceKey(src: TranslationSource): string {
  switch (src.type) {
    case 'none':
      return 'none';
    case 'track':
      return `track:${src.trackId}`;
    default:
      return src.type;
  }
}

function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const RATES = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function Sidebar({ controller, onClose }: { controller: SessionController; onClose?: () => void }) {
  const s = useSession(
    useShallow((st) => ({
      settings: st.settings,
      site: st.site,
      cues: st.cues,
      translations: st.translations,
      romanizations: st.romanizations,
      frequency: st.frequency,
      activeIndex: st.activeIndex,
      lastIndex: st.lastIndex,
      lang: st.lang,
      tracks: st.tracks,
      originalTrackId: st.originalTrackId,
      translationSource: st.translationSource,
      translationStatus: st.translationStatus,
      translationMessage: st.translationMessage,
      status: st.status,
      message: st.message,
      vocab: st.vocab,
      media: st.media,
      rate: st.rate,
      aiStatus: st.aiStatus,
      hasPopup: st.popup?.surface === 'sidebar',
    })),
  );
  const [tab, setTab] = useState<'subs' | 'words'>('subs');
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const index = useVocabIndex(s.vocab, s.lang);
  const { settings } = s;
  const native = settings.nativeLanguage;

  // Keep the active line in view (unless the learner is scrolling the list).
  useEffect(() => {
    if (!settings.sidebar.autoScroll || hovering.current || tab !== 'subs' || query) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-i="${s.activeIndex >= 0 ? s.activeIndex : s.lastIndex}"]`);
    if (!list || !row) return;
    const target = row.offsetTop - list.clientHeight / 3;
    list.scrollTo({ top: target, behavior: Math.abs(list.scrollTop - target) > 2000 ? 'auto' : 'smooth' });
  }, [s.activeIndex, s.lastIndex, settings.sidebar.autoScroll, tab, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = s.cues.map((c, i) => i);
    if (!q) return all;
    return all.filter((i) => s.cues[i].text.toLowerCase().includes(q) || s.translations[i]?.toLowerCase().includes(q));
  }, [query, s.cues, s.translations]);

  const translationOptions = useMemo(() => {
    const opts: { key: string; label: string; source: TranslationSource }[] = [
      { key: 'none', label: 'No translation', source: { type: 'none' } },
    ];
    for (const t of s.tracks) {
      if (t.id === s.originalTrackId || t.forced) continue;
      opts.push({ key: `track:${t.id}`, label: `${t.label}${t.auto ? ' (auto)' : ''}`, source: { type: 'track', trackId: t.id } });
    }
    if (s.site === 'youtube') {
      opts.push({
        key: 'platform-mt',
        label: `YouTube auto-translate → ${languageName(native)}`,
        source: { type: 'platform-mt', lang: native },
      });
    }
    opts.push({ key: 'chrome', label: `On-device (Chrome) → ${languageName(native)}`, source: { type: 'chrome', lang: native } });
    opts.push({
      key: 'ai',
      label: `AI${s.aiStatus?.model ? ` (${s.aiStatus.model})` : ''} → ${languageName(native)}`,
      source: { type: 'ai', lang: native },
    });
    return opts;
  }, [s.tracks, s.originalTrackId, s.site, native, s.aiStatus]);

  const savedHere = useMemo(() => {
    const id = s.media?.id;
    return Object.values(s.vocab)
      .filter((v) => sameLang(v.lang, s.lang) && (!id || v.context?.url?.includes(id)))
      .sort((a, b) => (a.context?.time ?? 0) - (b.context?.time ?? 0));
  }, [s.vocab, s.lang, s.media]);

  const fileBase = (s.media?.title ?? 'subtitles').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
  const showTr = settings.sidebar.showTranslations;

  return (
    <div className="lr-root lr-sidebar">
      <div className="lr-sb-head">
        <div className="lr-sb-row">
          <div className="lr-brand grow">
            <span className="dot" /> Captionary
          </div>
          <div className="lr-tabs">
            <button className={`lr-tab${tab === 'subs' ? ' active' : ''}`} onClick={() => setTab('subs')}>
              Subtitles
            </button>
            <button className={`lr-tab${tab === 'words' ? ' active' : ''}`} onClick={() => setTab('words')}>
              Saved {savedHere.length > 0 && <span className="lr-chip">{savedHere.length}</span>}
            </button>
          </div>
          <button className="lr-icon-btn" title="Settings" onClick={() => void bg({ type: 'open.page', page: 'options' })}>
            <IconSettings />
          </button>
          <button
            className="lr-icon-btn"
            title={`Hide (${settings.shortcuts.toggleSidebar.toUpperCase()})`}
            onClick={() => (onClose ? onClose() : void updateSettings((st) => void (st.sidebar.open = false)))}
          >
            <IconClose />
          </button>
        </div>

        {tab === 'subs' && (
          <>
            <div className="lr-sb-row">
              <span className="lr-sb-label">Subtitles</span>
              <select
                className="lr-select grow"
                value={s.originalTrackId ?? ''}
                onChange={(e) => void controller.selectOriginalTrack(e.target.value)}
                disabled={!s.tracks.length}
              >
                {!s.tracks.length && <option value="">None available</option>}
                {s.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {t.auto ? ' (auto)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="lr-sb-row">
              <span className="lr-sb-label">Translation</span>
              <select
                className="lr-select grow"
                value={sourceKey(s.translationSource)}
                onChange={(e) => {
                  const opt = translationOptions.find((o) => o.key === e.target.value);
                  if (opt) void controller.selectTranslation(opt.source);
                }}
                disabled={!s.cues.length}
              >
                {translationOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lr-sb-row" style={{ flexWrap: 'wrap' }}>
              <button
                className={`lr-btn${settings.playback.autoPause ? ' active' : ''}`}
                title={`Pause after every subtitle (${settings.shortcuts.toggleAutoPause.toUpperCase()})`}
                onClick={() => controller.runAction('toggleAutoPause')}
              >
                Auto-pause
              </button>
              <button
                className={`lr-btn${settings.subtitles.blurTranslation ? ' active' : ''}`}
                title="Blur translations until you hover them"
                onClick={() => void updateSettings((st) => void (st.subtitles.blurTranslation = !st.subtitles.blurTranslation))}
              >
                Blur
              </button>
              <button
                className={`lr-btn${showTr ? ' active' : ''}`}
                title="Show translations in this list"
                onClick={() => void updateSettings((st) => void (st.sidebar.showTranslations = !st.sidebar.showTranslations))}
              >
                List translations
              </button>
              <select
                className="lr-select"
                title="Playback speed"
                value={String(RATES.includes(s.rate) ? s.rate : 1)}
                onChange={(e) => controller.setRate(Number(e.target.value))}
              >
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </div>
            <div className="lr-sb-row">
              <IconSearch style={{ width: 14, height: 14, color: 'var(--lr-muted)' }} />
              <input
                className="lr-input grow"
                placeholder="Search subtitles"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <button
                className="lr-icon-btn"
                title="Copy all subtitles"
                disabled={!s.cues.length}
                onClick={() => {
                  void navigator.clipboard.writeText(toPlainText(s.cues, s.translations));
                  toast('Subtitles copied');
                }}
              >
                <IconCopy />
              </button>
              <button
                className="lr-icon-btn"
                title="Download .srt (with translations)"
                disabled={!s.cues.length}
                onClick={() => download(`${fileBase}.srt`, toSrt(s.cues, s.translations))}
              >
                <IconDownload />
              </button>
            </div>
            {s.frequency && (
              <div className="lr-legend" title="Words underlined by how common they are in film and TV subtitles">
                <span className="f-mid">2k–8k</span>
                <span className="f-rare">8k–20k</span>
                <span className="f-vrare">rarer</span>
              </div>
            )}
            {s.translationStatus === 'loading' && <div className="lr-status">Translating subtitles…</div>}
            {s.translationStatus === 'error' && <div className="lr-status error">{s.translationMessage}</div>}
          </>
        )}
      </div>

      {tab === 'subs' ? (
        <div
          className="lr-sb-list"
          ref={listRef}
          onMouseEnter={() => (hovering.current = true)}
          onMouseLeave={() => (hovering.current = false)}
        >
          {s.status === 'loading' && <div className="lr-empty">Loading subtitles…</div>}
          {s.status === 'none' && <div className="lr-empty">{s.message ?? 'No subtitles for this video.'}</div>}
          {s.status === 'error' && <div className="lr-empty lr-error">{s.message}</div>}
          {s.status === 'idle' && <div className="lr-empty">Open a video to see its subtitles here.</div>}
          {filtered.map((i) => {
            const cue = s.cues[i];
            const active = i === s.activeIndex || (s.activeIndex < 0 && i === s.lastIndex);
            return (
              <div key={i} data-i={i} className={`lr-cue${active ? ' active' : ''}`}>
                <button className="lr-cue-time" onClick={() => controller.playCue(i)} title="Play from here">
                  {formatTime(cue.start)}
                </button>
                <div>
                  <div className="lr-cue-text">
                    <TokenizedText
                      text={cue.text}
                      lang={s.lang}
                      index={index}
                      highlight={settings.subtitles.highlight}
                      freq={s.frequency}
                      onSelect={(sel) =>
                        controller.openPopup({ kind: 'word', text: sel.text, cueIndex: i, rect: sel.rect, surface: 'sidebar' })
                      }
                    />
                  </div>
                  {settings.subtitles.showRomanization && s.romanizations[i] && <div className="lr-cue-roman">{s.romanizations[i]}</div>}
                  {showTr && s.translations[i] && (
                    <div className={`lr-cue-tr${settings.subtitles.blurTranslation ? ' blur' : ''}`}>{s.translations[i]}</div>
                  )}
                  <div className="lr-cue-actions">
                    <button className="lr-icon-btn" title="Play line" onClick={() => controller.playCue(i)}>
                      <IconPlay />
                    </button>
                    <button
                      className="lr-icon-btn"
                      title="Explain this line with AI"
                      onClick={(e) => {
                        const r = (e.currentTarget.closest('.lr-cue') as HTMLElement).getBoundingClientRect();
                        controller.openPopup({
                          kind: 'sentence',
                          text: cue.text,
                          cueIndex: i,
                          rect: { left: r.left, top: r.top, width: r.width, height: r.height },
                          surface: 'sidebar',
                        });
                      }}
                    >
                      <IconSparkles />
                    </button>
                    <button
                      className="lr-icon-btn"
                      title="Copy line"
                      onClick={() => void navigator.clipboard.writeText(s.translations[i] ? `${cue.text}\n${s.translations[i]}` : cue.text)}
                    >
                      <IconCopy />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lr-sb-list">
          {savedHere.length === 0 && (
            <div className="lr-empty">
              Click a word in the subtitles, then <b>Save as learning</b>. Saved words are highlighted everywhere you meet them again.
            </div>
          )}
          {savedHere.map((v) => (
            <div key={v.id} className="lr-word-row">
              <div className="lr-sb-row">
                <span className="w grow">{v.text}</span>
                <span className={`lr-chip ${v.status}`}>{v.status}</span>
                {v.context?.time !== undefined && (
                  <button
                    className="lr-cue-time"
                    onClick={() => controller.adapter.seek(v.context!.time!)}
                    title="Jump to where you saved it"
                  >
                    {formatTime(v.context.time)}
                  </button>
                )}
              </div>
              {v.translation && <div className="lr-cue-tr">{v.translation}</div>}
              {v.context?.sentence && v.context.sentence !== v.text && (
                <div className="lr-cue-tr" style={{ fontStyle: 'italic' }}>
                  {v.context.sentence}
                </div>
              )}
              {!s.media && sourceUrl(v) && (
                <a className="lr-link" href={sourceUrl(v)} target="_blank" rel="noopener noreferrer">
                  source
                </a>
              )}
            </div>
          ))}
          <div className="lr-empty">
            <button className="lr-btn" onClick={() => void bg({ type: 'open.page', page: 'vocab' })}>
              <IconBook /> All saved words &amp; export
            </button>{' '}
            <button className="lr-btn" onClick={() => void controller.saveCurrentLine()}>
              <IconBookmark /> Save current line
            </button>
          </div>
        </div>
      )}
      {/* Fixed to the viewport: the list clips overflow, and the pop-up is wider than the panel. */}
      {s.hasPopup && <PopupHost controller={controller} surface="sidebar" />}
    </div>
  );
}
