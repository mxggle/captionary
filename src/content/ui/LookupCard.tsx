import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { bg, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canSpeak, speak } from '@/lib/tts';
import type { VocabItem, VocabStatus } from '@/lib/vocab';
import {
  IconArrowRight,
  IconBookmark,
  IconBookmarkFilled,
  IconCheck,
  IconChevronLeft,
  IconClose,
  IconCopy,
  IconMore,
  IconPlay,
  IconRefresh,
  IconSpark,
  IconSpeaker,
} from '@/ui/icons';
import { Markdown } from '@/ui/Markdown';
import { TokenizedText, type WordSelection } from '@/ui/TokenizedText';
import { rankBand, useLookup } from '@/ui/useLookup';
import { useVocabIndex } from '@/ui/vocab-index';
import type { AnchorRect, PopupTarget } from '../store';

/** Where the card goes: absolute inside `bounds` (or fixed to the viewport), with its pointer. */
export interface Placement {
  style: CSSProperties;
  maxHeight: number;
  arrow?: { x: number; top: boolean };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Put the card next to the word without covering `avoid` (the caption line): above it when there is
 * more room above, below otherwise; or beside `side` (the drawer) when the word is in the drawer.
 */
export function placeCard(
  width: number,
  { anchor, avoid, bounds, side }: { anchor: AnchorRect; avoid: AnchorRect; bounds: AnchorRect; side?: AnchorRect | null },
): Placement {
  const w = Math.min(width, bounds.width - 16);
  if (side) {
    const left = clamp(side.left - bounds.left - w - 12, 8, bounds.width - w - 8);
    const top = clamp(anchor.top - bounds.top - 24, 8, Math.max(8, bounds.height - 240));
    return { style: { left, top, width: w }, maxHeight: Math.max(160, bounds.height - top - 8) };
  }
  const cx = anchor.left - bounds.left + anchor.width / 2;
  const left = clamp(cx - w / 2, 8, Math.max(8, bounds.width - w - 8));
  const x = clamp(cx - left, 16, w - 16);
  const above = avoid.top - bounds.top;
  const below = bounds.height - (avoid.top + avoid.height - bounds.top);
  const limit = bounds.height - 16;
  if (above >= below) {
    return {
      style: { left, width: w, bottom: bounds.height - above + 10 },
      maxHeight: clamp(above - 18, 120, limit),
      arrow: { x, top: false },
    };
  }
  return {
    style: { left, width: w, top: avoid.top + avoid.height - bounds.top + 10 },
    maxHeight: clamp(below - 18, 120, limit),
    arrow: { x, top: true },
  };
}

export interface LookupCardProps {
  target: PopupTarget;
  settings: Settings;
  aiStatus: AIStatus | null;
  vocab: Record<string, VocabItem>;
  place: (width: number) => Placement;
  fixed?: boolean;
  mediaTitle?: string;
  rank?: number;
  rankKnown?: boolean;
  onClose: () => void;
  onSave: (status: VocabStatus | null, extra?: { translation?: string; notes?: string }) => void;
  onPlayLine?: () => void;
  onSelectWord?: (sel: WordSelection) => void;
  onOpenSidePanel?: () => void;
}

const SETTINGS_ERRORS = ['missing_key', 'auth', 'permission', 'not_configured', 'limit_reached', 'disabled'];

/**
 * The look-up card over the video, in the host's menu style (`LookupCard`, native). It opens compact
 * (word, listen, translation, Save · Known · Explain · More); the tutor and the dictionary appear only
 * after Explain or More.
 */
export function LookupCard(props: LookupCardProps) {
  const { target, settings, aiStatus, vocab, place, fixed, onClose } = props;
  const isWord = target.kind === 'word';
  const autoExplain = !isWord || !!aiStatus?.autoExplain;
  const lookup = useLookup({ ...props, autoExplain });
  const { ai, saved } = lookup;
  const [view, setView] = useState<'compact' | 'explain' | 'more'>(isWord && !autoExplain ? 'compact' : 'explain');
  const [question, setQuestion] = useState('');
  const ref = useRef<HTMLElement>(null);
  const index = useVocabIndex(vocab, target.lang);

  // Dismiss on a click anywhere else (the look-up lives in a shadow root, so compare composed paths).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.composedPath().includes(ref.current)) return;
      onClose();
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const expanded = view !== 'compact';
  const placement = place(expanded ? 360 : 300);
  const openSettings = () => void bg({ type: 'open.page', page: 'options', hash: 'ai' }).catch(() => undefined);
  const explain = () => {
    setView('explain');
    if (ai.status === 'idle' || ai.status === 'error') lookup.explain();
  };
  const ask = (e: FormEvent) => {
    e.preventDefault();
    lookup.ask(question);
    setQuestion('');
  };
  const band = rankBand(props.rank, !!props.rankKnown);
  const posLabel = view === 'more' ? 'Wiktionary' : [lookup.pos, band].filter(Boolean).join(' · ');
  const learning = saved?.status === 'learning';
  const known = saved?.status === 'known';

  return (
    <section
      ref={ref}
      className={`cap-lookup cap-lookup--native${expanded ? ' is-expanded' : ''}${fixed ? ' is-fixed' : ''}`}
      style={placement.style}
      role="dialog"
      aria-label={`Look-up: ${target.text}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="cap-lookup__scroll" style={{ maxHeight: placement.maxHeight }}>
        <div className="cap-lookup__head">
          {isWord ? (
            <span className="cap-lookup__word" lang={target.lang}>
              {target.text}
            </span>
          ) : (
            <span className="cap-lookup__word is-sentence" lang={target.lang}>
              <TokenizedText
                text={target.text}
                lang={target.lang}
                index={index}
                highlight={settings.subtitles.highlight}
                onSelect={props.onSelectWord}
              />
            </span>
          )}
          {!isWord && props.onPlayLine && (
            <button className="cap-picon" aria-label="Play this line" title="Play this line" onClick={props.onPlayLine}>
              <IconPlay className="cap-ico-lg" />
            </button>
          )}
          {canSpeak() && (
            <button
              className="cap-picon"
              aria-label="Listen"
              title="Listen"
              onClick={() => void speak(target.text, target.lang, settings.dictionary.speechRate)}
            >
              <IconSpeaker className="cap-ico-lg" />
            </button>
          )}
          {isWord && posLabel && <span className="cap-lookup__pos-native">{posLabel}</span>}
          {expanded && (
            <button className="cap-picon" aria-label="Close (Esc)" title="Close (Esc)" onClick={onClose}>
              <IconClose className="cap-ico-lg" />
            </button>
          )}
        </div>
        {lookup.romanized && view !== 'more' && <div className="cap-lookup__roman">{lookup.romanized}</div>}
        {isWord && view !== 'more' && lookup.translation && <div className="cap-lookup__tr">{lookup.translation}</div>}
        <div className="cap-lookup__sep" />

        {isWord && view !== 'more' && (
          <div className="cap-lookup__actions">
            <button className="cap-pbtn" aria-pressed={learning} onClick={() => lookup.setStatus('learning')}>
              {learning ? <IconBookmarkFilled className="cap-ico-lg is-learn" /> : <IconBookmark className="cap-ico-lg" />}
              {learning ? 'Learning' : 'Save'}
            </button>
            <button className="cap-pbtn" aria-pressed={known} onClick={() => lookup.setStatus('known')}>
              <IconCheck className="cap-ico-lg" strokeWidth={2} />
              Known
            </button>
            <button className="cap-pbtn" aria-pressed={view === 'explain'} onClick={explain}>
              <IconSpark className="cap-ico-lg" />
              Explain
            </button>
            <span className="cap-spacer" />
            <button className="cap-picon" aria-label="More: dictionary, copy, open in tutor" title="More" onClick={() => setView('more')}>
              <IconMore className="cap-ico-lg" />
            </button>
          </div>
        )}

        {view === 'explain' && (
          <>
            {isWord && <div className="cap-lookup__sep" />}
            <TutorNative lookup={lookup} openSettings={openSettings} />
            {lookup.aiReady && (ai.status === 'done' || lookup.turns.length > 0) && (
              <form className="cap-lookup__ask" onSubmit={ask}>
                <input
                  aria-label="Ask a follow-up"
                  placeholder="Ask a follow-up…"
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button className="cap-picon" type="submit" aria-label="Ask" disabled={!question.trim()}>
                  <IconArrowRight className="cap-ico" />
                </button>
              </form>
            )}
          </>
        )}

        {view === 'more' && (
          <>
            <div className="cap-lookup__ai cap-lookup__dict">
              {!settings.dictionary.wiktionary && <p className="cap-lookup__dim">Wiktionary definitions are off in Settings → General.</p>}
              {lookup.dictState === 'loading' && <span className="cap-spinner" />}
              {lookup.dictState === 'error' && <p className="cap-lookup__dim">The dictionary is not answering. Try again later.</p>}
              {lookup.dictState === 'done' && lookup.dict?.entries.length === 0 && (
                <p className="cap-lookup__dim">No entry for “{target.text}”. It may be an inflected form; Explain asks the tutor.</p>
              )}
              {lookup.dict?.entries.slice(0, 3).map((entry, i) => (
                <div key={i} style={i ? { marginTop: 8 } : undefined}>
                  <p className="cap-lookup__dim" style={{ fontStyle: 'italic' }}>
                    {entry.partOfSpeech}
                  </p>
                  <ol>
                    {entry.senses.slice(0, 4).map((s, j) => (
                      <li key={j}>
                        {s.definition}
                        {s.examples[0] && <div className="cap-lookup__ex">{s.examples[0]}</div>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              <p className="cap-lookup__links">
                {lookup.links.map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.name}
                  </a>
                ))}
                {props.onOpenSidePanel && (
                  <button className="cap-link" style={{ color: 'var(--link)', textDecoration: 'none' }} onClick={props.onOpenSidePanel}>
                    Open in side panel
                  </button>
                )}
              </p>
            </div>
            <div className="cap-lookup__sep" />
            <div className="cap-lookup__actions">
              <button className="cap-pbtn" onClick={() => lookup.copy(target.text)}>
                <IconCopy className="cap-ico-lg" />
                Copy
              </button>
              <button className="cap-pbtn" onClick={() => setView(ai.status === 'idle' ? 'compact' : 'explain')}>
                <IconChevronLeft className="cap-ico-lg" />
                Back
              </button>
            </div>
          </>
        )}
      </div>
      {placement.arrow && (
        <div
          className={`cap-lookup__arrow${placement.arrow.top ? ' is-top' : ''}`}
          style={{ left: placement.arrow.x }}
          aria-hidden="true"
        />
      )}
    </section>
  );
}

function TutorNative({ lookup, openSettings }: { lookup: ReturnType<typeof useLookup>; openSettings: () => void }) {
  const { ai } = lookup;
  if (!lookup.aiReady) {
    return (
      <div className="cap-lookup__note">
        {lookup.aiOff ? 'The tutor is off.' : 'Connect an AI provider to get explanations in context.'}{' '}
        <button className="cap-link" onClick={openSettings}>
          Open AI settings
        </button>
      </div>
    );
  }
  if (ai.status === 'idle' || ai.status === 'loading') {
    return (
      <div className="cap-lookup__note" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="cap-spinner" />
        Thinking…
      </div>
    );
  }
  if (ai.status === 'error') {
    return (
      <>
        <div className="cap-lookup__error">{ai.error?.message}</div>
        <div className="cap-lookup__actions" style={{ marginTop: 8 }}>
          <button className="cap-pbtn" onClick={lookup.explain}>
            <IconRefresh className="cap-ico-lg" />
            Retry
          </button>
          {SETTINGS_ERRORS.includes(ai.error?.code ?? '') && (
            <button className="cap-pbtn" onClick={openSettings}>
              Open AI settings
            </button>
          )}
        </div>
      </>
    );
  }
  return (
    <div className="cap-lookup__ai">
      <div className={ai.status === 'streaming' ? 'cap-cursor' : undefined}>
        <Markdown text={ai.text} />
      </div>
      {ai.status === 'done' && (
        <div className="cap-lookup__ai-meta">
          <span className="cap-spacer" title={ai.provider}>
            {ai.model}
            {ai.cached ? ' · cached' : ''}
          </span>
          <button className="cap-picon" style={SMALL} aria-label="Copy explanation" title="Copy" onClick={() => lookup.copy(ai.text)}>
            <IconCopy className="cap-ico" />
          </button>
          <button className="cap-picon" style={SMALL} aria-label="Save to notes" title="Save to notes" onClick={lookup.saveNotes}>
            <IconBookmark className="cap-ico" />
          </button>
          <button className="cap-picon" style={SMALL} aria-label="Regenerate" title="Regenerate" onClick={lookup.explain}>
            <IconRefresh className="cap-ico" />
          </button>
        </div>
      )}
      {lookup.turns.map((t, i) => (
        <div key={i}>
          <p className="cap-lookup__q">{t.q}</p>
          {t.status === 'error' ? (
            <div className="cap-lookup__error" style={{ padding: 0 }}>
              {t.error}
            </div>
          ) : t.a ? (
            <div className={t.status === 'streaming' ? 'cap-cursor' : undefined}>
              <Markdown text={t.a} />
            </div>
          ) : (
            <span className="cap-spinner" />
          )}
        </div>
      ))}
    </div>
  );
}

const SMALL: CSSProperties = { width: 28, height: 28 };
