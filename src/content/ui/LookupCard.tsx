import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { formatAIError, useI18n } from '@/lib/i18n';
import { bg, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canSpeak, speak } from '@/lib/tts';
import type { VocabItem } from '@/lib/vocab';
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
import { ChunkButton, ExplanationDefinition, ExplanationTabs } from '@/ui/ExplanationTabs';
import { Markdown } from '@/ui/Markdown';
import { TokenizedText, type WordSelection } from '@/ui/TokenizedText';
import { explainsAtOnce, rankBand, useLookup, type LookupInput } from '@/ui/useLookup';
import { useVocabIndex } from '@/ui/vocab-index';
import type { AnchorRect, PopupTarget } from '../store';
import { useContainWheel } from './wheel';

/** Where the card goes: absolute inside `bounds` (or fixed to the viewport), with its pointer. */
export interface Placement {
  style: CSSProperties;
  maxHeight: number;
  /** Held by its bottom edge, so it grows upward as content arrives. */
  growsUp?: boolean;
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
      growsUp: true,
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
  onSave: LookupInput['onSave'];
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
  const { m } = useI18n();
  const { target, settings, aiStatus, vocab, place, fixed, onClose } = props;
  const isWord = target.kind === 'word';
  const autoExplain = explainsAtOnce(target, aiStatus);
  const lookup = useLookup({ ...props, autoExplain });
  const { ai, saved } = lookup;
  const onSelectWord = props.onSelectWord;
  const suggestion = onSelectWord ? lookup.suggestion : null;
  const [view, setView] = useState<'compact' | 'explain' | 'more'>(isWord && !autoExplain ? 'compact' : 'explain');
  const [question, setQuestion] = useState('');
  const ref = useRef<HTMLElement>(null);
  const index = useVocabIndex(vocab, target.lang);
  useContainWheel(ref);

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
  const openSetup = () => void bg({ type: 'open.page', page: 'welcome', hash: 'tutor' }).catch(() => undefined);
  const explain = () => {
    setView('explain');
    if (ai.status === 'idle' || ai.status === 'error') lookup.explain();
  };
  const ask = (e: FormEvent) => {
    e.preventDefault();
    lookup.ask(question);
    setQuestion('');
  };
  const rawBand = rankBand(props.rank, !!props.rankKnown);
  const band = rawBand === 'rarer' ? m.lookup.rarer : rawBand;
  const posLabel = view === 'more' ? 'Wiktionary' : [lookup.pos, band].filter(Boolean).join(' · ');
  const learning = saved?.status === 'learning';
  const known = saved?.status === 'known';
  // A card above the caption line would grow upward line by line as the answer streams in, moving
  // the text being read; it takes its full height at once instead and fills from the top.
  const holdHeight = placement.growsUp && view === 'explain' && lookup.answerShown;

  return (
    <section
      ref={ref}
      className={`cap-lookup cap-lookup--native${expanded ? ' is-expanded' : ''}${fixed ? ' is-fixed' : ''}`}
      style={placement.style}
      role="dialog"
      aria-label={m.lookup.lookupAria(target.text)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="cap-lookup__scroll" style={holdHeight ? { height: placement.maxHeight } : { maxHeight: placement.maxHeight }}>
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
            <button className="cap-picon" aria-label={m.lookup.playThisLine} title={m.lookup.playThisLine} onClick={props.onPlayLine}>
              <IconPlay className="cap-ico-lg" />
            </button>
          )}
          {canSpeak() && (
            <button
              className="cap-picon"
              aria-label={m.common.listen}
              title={m.common.listen}
              onClick={() => void speak(target.text, target.lang, settings.dictionary.speechRate)}
            >
              <IconSpeaker className="cap-ico-lg" />
            </button>
          )}
          {isWord && posLabel && <span className="cap-lookup__pos-native">{posLabel}</span>}
          {expanded && (
            <button className="cap-picon" aria-label={m.common.closeEsc} title={m.common.closeEsc} onClick={onClose}>
              <IconClose className="cap-ico-lg" />
            </button>
          )}
        </div>
        {lookup.romanized && view !== 'more' && <div className="cap-lookup__roman">{lookup.romanized}</div>}
        {isWord && view !== 'more' && lookup.translation && <div className="cap-lookup__tr">{lookup.translation}</div>}
        {isWord && view !== 'more' && <ExplanationDefinition explanation={lookup.explanation} />}
        {isWord && view !== 'more' && suggestion && (
          <ChunkButton suggestion={suggestion} lang={target.lang} onPick={() => onSelectWord?.({ ...suggestion, rect: target.rect })} />
        )}
        <div className="cap-lookup__sep" />

        {isWord && view !== 'more' && (
          <div className="cap-lookup__actions">
            <button className="cap-pbtn" aria-pressed={learning} onClick={() => lookup.setStatus('learning')}>
              {learning ? <IconBookmarkFilled className="cap-ico-lg is-learn" /> : <IconBookmark className="cap-ico-lg" />}
              {learning ? m.common.learning : m.common.save}
            </button>
            <button className="cap-pbtn" aria-pressed={known} onClick={() => lookup.setStatus('known')}>
              <IconCheck className="cap-ico-lg" strokeWidth={2} />
              {m.common.known}
            </button>
            <button className="cap-pbtn" aria-pressed={view === 'explain'} onClick={explain}>
              <IconSpark className="cap-ico-lg" />
              {m.common.explain}
            </button>
            <span className="cap-spacer" />
            <button className="cap-picon" aria-label={m.lookup.moreAria} title={m.common.more} onClick={() => setView('more')}>
              <IconMore className="cap-ico-lg" />
            </button>
          </div>
        )}

        {view === 'explain' && (
          <>
            {isWord && <div className="cap-lookup__sep" />}
            <TutorNative
              lookup={lookup}
              openSettings={openSettings}
              openSetup={openSetup}
              lang={target.lang}
              speechRate={settings.dictionary.speechRate}
              chunkShown={!!suggestion}
            />
            {lookup.aiReady && (ai.status === 'done' || lookup.turns.length > 0) && (
              <form className="cap-lookup__ask" onSubmit={ask}>
                <input
                  aria-label={m.lookup.askFollowUpLabel}
                  placeholder={m.lookup.askFollowUpPlaceholder}
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button className="cap-picon" type="submit" aria-label={m.lookup.askButton} disabled={!question.trim()}>
                  <IconArrowRight className="cap-ico" />
                </button>
              </form>
            )}
          </>
        )}

        {view === 'more' && (
          <>
            <div className="cap-lookup__ai cap-lookup__dict">
              {!settings.dictionary.wiktionary && <p className="cap-lookup__dim">{m.lookup.wiktionaryOffNote}</p>}
              {lookup.dictState === 'loading' && <span className="cap-spinner" />}
              {lookup.dictState === 'error' && <p className="cap-lookup__dim">{m.lookup.dictError}</p>}
              {lookup.dictState === 'done' && lookup.dict?.entries.length === 0 && (
                <p className="cap-lookup__dim">{m.lookup.dictEmptyNative(target.text)}</p>
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
                    {m.lookup.openInSidePanel}
                  </button>
                )}
              </p>
            </div>
            <div className="cap-lookup__sep" />
            <div className="cap-lookup__actions">
              <button className="cap-pbtn" onClick={() => lookup.copy(target.text)}>
                <IconCopy className="cap-ico-lg" />
                {m.common.copy}
              </button>
              <button className="cap-pbtn" onClick={() => setView(ai.status === 'idle' ? 'compact' : 'explain')}>
                <IconChevronLeft className="cap-ico-lg" />
                {m.common.back}
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

function TutorNative({
  lookup,
  openSettings,
  openSetup,
  lang,
  speechRate,
  chunkShown,
}: {
  lookup: ReturnType<typeof useLookup>;
  openSettings: () => void;
  /** The setup guide's tutor step, for a learner who has no provider yet. */
  openSetup: () => void;
  lang: string;
  speechRate: number;
  chunkShown: boolean;
}) {
  const { m } = useI18n();
  const { ai } = lookup;
  if (!lookup.aiReady) {
    return (
      <div className="cap-lookup__note">
        {lookup.aiOff ? m.lookup.tutorOff : m.lookup.addTutorPrompt}{' '}
        <button className="cap-link" onClick={lookup.aiOff ? openSettings : openSetup}>
          {lookup.aiOff ? m.lookup.openAISettings : m.lookup.setUpTutor}
        </button>
      </div>
    );
  }
  if (ai.status === 'idle' || ai.status === 'loading') {
    return (
      <div className="cap-lookup__note" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="cap-spinner" />
        {m.common.thinking}
      </div>
    );
  }
  if (ai.status === 'error') {
    const err = formatAIError(ai.error, m);
    return (
      <>
        <div className="cap-lookup__error">
          <div>{err.primary}</div>
          {err.detail && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{err.detail}</div>}
        </div>
        <div className="cap-lookup__actions" style={{ marginTop: 8 }}>
          <button className="cap-pbtn" onClick={lookup.explain}>
            <IconRefresh className="cap-ico-lg" />
            {m.common.retry}
          </button>
          {SETTINGS_ERRORS.includes(ai.error?.code ?? '') && (
            <button className="cap-pbtn" onClick={openSettings}>
              {m.lookup.openAISettings}
            </button>
          )}
        </div>
      </>
    );
  }
  return (
    <div className="cap-lookup__ai">
      {lookup.explanation ? (
        <ExplanationTabs
          explanation={lookup.explanation}
          streaming={ai.status === 'streaming'}
          lang={lang}
          native={lookup.native}
          speechRate={speechRate}
          chunkShown={chunkShown}
        />
      ) : (
        <div className={ai.status === 'streaming' ? 'cap-cursor' : undefined}>
          <Markdown text={ai.text} />
        </div>
      )}
      {ai.status === 'done' && (
        <div className="cap-lookup__ai-meta">
          <span className="cap-spacer" title={ai.provider}>
            {ai.model}
            {ai.cached ? ` · ${m.common.cached}` : ''}
          </span>
          <button
            className="cap-picon"
            style={SMALL}
            aria-label={m.lookup.copyExplanation}
            title={m.common.copy}
            onClick={() => lookup.copy(lookup.answerText)}
          >
            <IconCopy className="cap-ico" />
          </button>
          <button
            className="cap-picon"
            style={SMALL}
            aria-label={m.lookup.saveToNotes}
            title={m.lookup.saveToNotes}
            onClick={lookup.saveNotes}
          >
            <IconBookmark className="cap-ico" />
          </button>
          <button className="cap-picon" style={SMALL} aria-label={m.lookup.regenerate} title={m.lookup.regenerate} onClick={lookup.explain}>
            <IconRefresh className="cap-ico" />
          </button>
        </div>
      )}
      {lookup.turns.map((t, i) => (
        <div key={i}>
          <p className="cap-lookup__q">{t.q}</p>
          {t.status === 'error' ? (
            <div className="cap-lookup__error" style={{ padding: 0 }}>
              {formatAIError({ code: 'unknown', message: t.error }, m).primary}
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
