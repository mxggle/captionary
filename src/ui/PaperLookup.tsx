import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { formatAIError, useI18n, type Messages } from '@/lib/i18n';
import type { AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canSpeak, speak } from '@/lib/tts';
import type { VocabItem, VocabStatus } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import {
  IconArrowRight,
  IconBookmark,
  IconBookmarkFilled,
  IconCheck,
  IconClose,
  IconCopy,
  IconNote,
  IconRefresh,
  IconSpark,
  IconSpeaker,
} from './icons';
import { ChunkButton, ExplanationDefinition, ExplanationTabs } from './ExplanationTabs';
import { Markdown } from './Markdown';
import { TokenizedText, type WordSelection } from './TokenizedText';
import { rankBand, useLookup, type Lookup, type LookupInput } from './useLookup';
import { useVocabIndex } from './vocab-index';

/** The two buttons that set a word's status (`StatusToggle`); pressing the pressed one clears it. */
export function StatusToggle({
  status,
  onChange,
  large,
  keys,
}: {
  status: VocabStatus | undefined;
  onChange: (s: VocabStatus) => void;
  large?: boolean;
  /** Review answers: "Still learning" and "I know it" with their keys. */
  keys?: [string, string];
}) {
  const { m } = useI18n();
  const learning = status === 'learning';
  const known = status === 'known';
  const style: CSSProperties | undefined = large ? { height: 44, padding: '0 18px', fontSize: 15 } : undefined;
  return (
    <div className="cap-status" role="group" aria-label={m.lookup.wordStatusGroup}>
      <button className="cap-status__btn is-learn" aria-pressed={learning} style={style} onClick={() => onChange('learning')}>
        {learning ? <IconBookmarkFilled className="cap-ico" /> : <IconBookmark className="cap-ico" />}
        {keys ? m.lookup.stillLearning : learning ? m.common.learning : m.lookup.saveAsLearning}
        {keys && <span className="cap-kbd">{keys[0]}</span>}
      </button>
      <button className="cap-status__btn is-known" aria-pressed={known} style={style} onClick={() => onChange('known')}>
        <IconCheck className="cap-ico" strokeWidth={known ? 2.6 : 2.2} />
        {keys ? m.lookup.iKnowIt : known ? m.common.known : m.lookup.iKnowIt}
        {keys && <span className="cap-kbd">{keys[1]}</span>}
      </button>
    </div>
  );
}

/** A sentence with the looked-up word marked by the highlighter, or another form of it ("holds up" for "hold up"). */
export function MarkedSentence({ sentence, word, forms }: { sentence: string; word: string; forms?: string[] }) {
  const lower = sentence.toLowerCase();
  const found = [word, ...(forms ?? [])].filter(Boolean).map((w) => ({ w, i: lower.indexOf(w.toLowerCase()) }));
  const { w: mark = word, i = -1 } = found.find((f) => f.i >= 0) ?? {};
  if (i < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, i)}
      <mark className="cap-mark">{sentence.slice(i, i + mark.length)}</mark>
      {sentence.slice(i + mark.length)}
    </>
  );
}

/** Enter that picks an input-method candidate (Japanese, Chinese), not one that sends the text. */
export function isComposing(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** At most `max` characters of `text`, cut between graphemes so an emoji or an accented letter stays whole. */
function clip(text: string, max: number): string {
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
  if (parts.length <= max) return text;
  return `${parts
    .slice(0, max)
    .map((p) => p.segment)
    .join('')}…`;
}

/** A failed answer (`TutorAnswer`): what went wrong in plain words, the provider's own detail, and Retry. */
function TutorError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { m } = useI18n();
  const { primary, detail } = formatAIError(error, m);
  return (
    <>
      <div role="alert">
        <p className="cap-tutor__text cap-tutor__error">{primary}</p>
        {detail && <p className="cap-tutor__text cap-tutor__detail">{detail}</p>}
      </div>
      <div className="cap-row cap-tutor__actions">
        <button className="cap-btn cap-btn--sm" onClick={onRetry}>
          <IconRefresh className="cap-ico" />
          {m.common.retry}
        </button>
        <a href="/options.html#ai" target="_blank" rel="noopener noreferrer">
          {m.lookup.openAISettings}
        </a>
      </div>
    </>
  );
}

const quiet = () => undefined;

/** The tutor's answer on pages (`TutorAnswer`): label, streamed text, model, follow-ups and the ask field. */
export function TutorAnswer({
  lookup,
  subject,
  isWord,
  lang,
  speechRate,
  chunkShown,
  onSetUpTutor,
  announce = quiet,
}: {
  lookup: Lookup;
  subject: string;
  isWord: boolean;
  lang: string;
  speechRate: number;
  /** The tutor's chunk is shown as a `ChunkButton` above the answer. */
  chunkShown?: boolean;
  /** Replaces the link to the setup guide's tutor step (on the guide itself). */
  onSetUpTutor?: () => void;
  /** Says a short message in the card's live region. */
  announce?: (message: string) => void;
}) {
  const { m } = useI18n();
  const { ai } = lookup;
  const [question, setQuestion] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Explain, Retry and Regenerate go away when pressed; focus moves to the answer that replaces them.
  const focusAnswer = useRef(false);
  const start = () => {
    focusAnswer.current = true;
    lookup.explain();
  };
  const retryTurn = (i: number) => {
    focusAnswer.current = true;
    lookup.retryTurn(i);
  };
  // After the render that removed the pressed control.
  useEffect(() => {
    if (!focusAnswer.current) return;
    focusAnswer.current = false;
    ref.current?.focus({ preventScroll: true });
  });
  // The answer is announced once it is complete, never word by word.
  const doneTurns = lookup.turns.filter((t) => t.status === 'done').length;
  const seen = useRef({ status: ai.status, doneTurns });
  useEffect(() => {
    const was = seen.current;
    const answered = ai.status === 'done' && (was.status === 'loading' || was.status === 'streaming');
    if (answered || doneTurns > was.doneTurns) announce(m.lookup.answerReady);
    seen.current = { status: ai.status, doneTurns };
  }, [ai.status, doneTurns, announce, m]);

  // Copy and Save to notes show what they did for a moment, in place of their icon.
  const [flash, setFlash] = useState<'copied' | 'copyFailed' | 'saved' | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(t);
  }, [flash]);
  const copy = async () => {
    const ok = await lookup.copy(lookup.answerText);
    setFlash(ok ? 'copied' : 'copyFailed');
    announce(ok ? m.lookup.copied : m.lookup.copyFailed);
  };
  const saveNotes = async () => {
    const added = !!lookup.saved;
    await lookup.saveNotes();
    setFlash('saved');
    announce(added ? m.lookup.notesSaved : m.lookup.notesSavedNew);
  };

  const ask = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || lookup.chatting) return;
    lookup.ask(question);
    setQuestion('');
  };
  const busy = lookup.aiPending || ai.status === 'loading' || ai.status === 'streaming' || lookup.chatting;
  const idle = lookup.aiReady && ai.status === 'idle';
  const label = (
    <h3 className="cap-tutor__label">
      <IconSpark className="cap-ico" />
      {m.lookup.tutorLabel}
    </h3>
  );

  return (
    <div ref={ref} className={`cap-tutor${idle ? ' cap-tutor--idle' : ''}`} tabIndex={-1} aria-busy={busy || undefined}>
      {lookup.aiPending ? (
        // The tutor's settings are still on their way: neither the set-up prompt nor Explain yet.
        <>
          {label}
          <span className="cap-spinner" />
        </>
      ) : !lookup.aiReady ? (
        <>
          {label}
          <p className="cap-tutor__text">
            {lookup.aiOff ? m.lookup.tutorOff : m.lookup.addTutorPrompt}{' '}
            {!lookup.aiOff && onSetUpTutor ? (
              <button className="cap-link" onClick={onSetUpTutor}>
                {m.lookup.setUpTutor}
              </button>
            ) : (
              <a href={lookup.aiOff ? '/options.html#ai' : '/welcome.html#tutor'} target="_blank" rel="noopener noreferrer">
                {lookup.aiOff ? m.lookup.openAISettings : m.lookup.setUpTutor}
              </a>
            )}
          </p>
        </>
      ) : idle ? (
        <button className="cap-btn cap-btn--primary cap-btn--sm cap-tutor__explain" onClick={start}>
          <IconSpark className="cap-ico" />
          <span className="cap-ellipsis">{isWord ? m.lookup.explainWordInContext(clip(subject, 24)) : m.lookup.breakDownSentence}</span>
        </button>
      ) : (
        <>
          {label}
          {ai.status === 'loading' ? (
            <div className="cap-row cap-tutor__text">
              <span className="cap-spinner" />
              {m.common.thinking}
            </div>
          ) : ai.status === 'error' ? (
            <TutorError error={ai.error} onRetry={start} />
          ) : (
            <>
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
                <div className={`cap-tutor__text${ai.status === 'streaming' ? ' cap-cursor' : ''}`}>
                  <Markdown text={ai.text} />
                </div>
              )}
              {ai.status === 'done' && (
                <div className="cap-tutor__meta">
                  <span className="cap-mono" title={ai.provider}>
                    {ai.model}
                  </span>
                  {ai.cached && <span className="cap-tag">{m.common.cached}</span>}
                  <span className="cap-spacer" />
                  <button
                    className={`cap-iconbtn cap-iconbtn--sm${flash === 'copied' ? ' is-done' : flash === 'copyFailed' ? ' is-failed' : ''}`}
                    aria-label={flash === 'copied' ? m.lookup.copied : flash === 'copyFailed' ? m.lookup.copyFailed : m.common.copy}
                    title={m.common.copy}
                    onClick={() => void copy()}
                  >
                    {flash === 'copied' ? (
                      <>
                        <IconCheck className="cap-ico" />
                        {m.lookup.copied}
                      </>
                    ) : flash === 'copyFailed' ? (
                      m.lookup.copyFailed
                    ) : (
                      <IconCopy className="cap-ico" />
                    )}
                  </button>
                  <button
                    className={`cap-iconbtn cap-iconbtn--sm${flash === 'saved' ? ' is-done' : ''}`}
                    aria-label={flash === 'saved' ? m.lookup.saved : m.lookup.saveToNotes}
                    title={m.lookup.saveToNotes}
                    onClick={() => void saveNotes()}
                  >
                    {flash === 'saved' ? (
                      <>
                        <IconCheck className="cap-ico" />
                        {m.lookup.saved}
                      </>
                    ) : (
                      <IconNote className="cap-ico" />
                    )}
                  </button>
                  <button
                    className="cap-iconbtn cap-iconbtn--sm"
                    aria-label={m.lookup.regenerate}
                    title={m.lookup.regenerate}
                    onClick={start}
                  >
                    <IconRefresh className="cap-ico" />
                  </button>
                </div>
              )}
            </>
          )}
          {lookup.turns.map((t, i) => (
            <div key={i}>
              <div className="cap-tutor__q">{t.q}</div>
              {t.status === 'error' ? (
                <TutorError error={t.errorInfo ?? { code: 'unknown', message: t.error ?? '' }} onRetry={() => retryTurn(i)} />
              ) : t.a ? (
                <div className={`cap-tutor__text${t.status === 'streaming' ? ' cap-cursor' : ''}`}>
                  <Markdown text={t.a} />
                </div>
              ) : (
                <span className="cap-spinner" />
              )}
            </div>
          ))}
          {(ai.status === 'done' || lookup.turns.length > 0) && (
            <form className="cap-ask" onSubmit={ask}>
              <input
                aria-label={m.lookup.askTutorLabel}
                placeholder={m.lookup.askTutorPlaceholder}
                value={question}
                maxLength={500}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isComposing(e)) e.preventDefault();
                }}
              />
              <button
                className="cap-iconbtn cap-iconbtn--solid"
                type="submit"
                aria-label={m.lookup.askButton}
                disabled={!question.trim() || lookup.chatting}
              >
                <IconArrowRight className="cap-ico" />
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function FrequencyBars({ rank }: { rank: number | undefined }) {
  const lit = rank === undefined ? 1 : rank <= 2000 ? 4 : rank <= 8000 ? 3 : rank <= 20000 ? 2 : 1;
  return (
    <span className="cap-freq" aria-hidden="true">
      {[4, 6, 8, 11].map((h, i) => (
        <span key={h} className={i < lit ? undefined : 'is-off'} style={{ height: h }} />
      ))}
    </span>
  );
}

/** The band's short label next to the bars, and what it means in words. */
function frequencyLabel(rank: number | undefined, m: Messages): { short: string; long: string } {
  const band = rankBand(rank, true);
  if (band === undefined) return { short: m.lookup.top2000, long: m.lookup.freqTop2000 };
  if (band === '2k–8k') return { short: band, long: m.lookup.freq2kTo8k };
  if (band === '8k–20k') return { short: band, long: m.lookup.freq8kTo20k };
  return { short: m.lookup.rarer, long: m.lookup.freqRarer };
}

export interface PaperLookupProps {
  target: PopupTarget;
  settings: Settings;
  aiStatus: AIStatus | null;
  vocab: Record<string, VocabItem>;
  mediaTitle?: string;
  rank?: number;
  rankKnown?: boolean;
  /** Floating next to a word (reader), or docked in the page flow (side panel). */
  docked?: boolean;
  /** Docked: take focus on mount, as when the learner opened this card from the one before it. Floating cards always do. */
  autoFocus?: boolean;
  style?: CSSProperties;
  maxHeight?: number;
  /** Held by its bottom edge (above the word), so it grows upward as content arrives. */
  growsUp?: boolean;
  autoExplain?: boolean;
  onClose?: () => void;
  onSave: LookupInput['onSave'];
  onSelectWord?: (sel: WordSelection) => void;
  onSetUpTutor?: () => void;
}

/** The paper look-up card on extension pages (`LookupCard`, Highlighter): reader, side panel. */
export function PaperLookup(props: PaperLookupProps) {
  const { m } = useI18n();
  const { target, settings, vocab, docked, onClose } = props;
  const lookup = useLookup(props);
  const ref = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const index = useVocabIndex(vocab, target.lang);
  const isWord = lookup.isWord;
  const { onSelectWord } = props;
  const suggestion = onSelectWord ? lookup.suggestion : null;

  // One polite live region for what happened out of sight: an answer arriving, a copy, a save.
  const [said, setSaid] = useState('');
  // The same message twice in a row is changed slightly, so it is read again.
  const announce = useCallback((message: string) => setSaid((s) => (s === message ? `${message} ` : message)), []);

  // A floating card is a dialog: it takes focus when it opens and gives it back to what opened it.
  // A card that replaces another (a word picked inside it) hands focus on: the old card gives it
  // back first, and the new one takes it from there.
  const takesFocus = !docked || !!props.autoFocus;
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card || !takesFocus) return;
    const opener = !docked && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const lost = !active || active === document.body || card.contains(active);
      if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Once per card: a new target mounts a new card.
  }, []);

  useEffect(() => {
    if (docked || !onClose) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.composedPath().includes(ref.current)) return;
      onClose();
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose, docked]);

  const freq = props.rankKnown && isWord ? frequencyLabel(props.rank, m) : undefined;
  const phrase = lookup.identity.kind === 'phrase';
  // Above the word, a streaming answer would grow the card upward and move the text being read;
  // the card takes its full height at once instead and fills from the top.
  const scrollStyle = props.maxHeight
    ? props.growsUp && lookup.answerShown
      ? { height: props.maxHeight }
      : { maxHeight: props.maxHeight }
    : undefined;

  const setStatus = (status: VocabStatus) => {
    const removing = lookup.saved?.status === status;
    void lookup.setStatus(status);
    if (removing) announce(m.lookup.removedFromWords);
  };
  const undoRemove = () => {
    // The Undo link goes away; the status buttons it restores take focus.
    statusRef.current?.querySelector('button')?.focus();
    void lookup.undoRemove().then(() => announce(m.lookup.restored));
  };

  return (
    <section
      ref={ref}
      className={`cap-lookup${docked ? ' cap-lookup--docked' : ' is-floating'}`}
      style={props.style}
      role={docked ? undefined : 'dialog'}
      aria-label={m.lookup.lookupAria(target.text)}
      tabIndex={-1}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || docked || !onClose) return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="cap-lookup__scroll" style={scrollStyle}>
        <div className="cap-lookup__head">
          <h2 className={`cap-lookup__word${isWord ? '' : ' is-sentence'}`} lang={target.lang}>
            {isWord ? (
              target.text
            ) : (
              <TokenizedText
                text={target.text}
                lang={target.lang}
                index={index}
                highlight={settings.subtitles.highlight}
                onSelect={props.onSelectWord}
              />
            )}
          </h2>
          {canSpeak() && (
            <button
              className="cap-iconbtn cap-iconbtn--solid"
              aria-label={m.common.listen}
              title={m.common.listen}
              onClick={() => void speak(target.text, target.lang, settings.dictionary.speechRate)}
            >
              <IconSpeaker className="cap-ico" />
            </button>
          )}
          {!docked && onClose && (
            <button className="cap-iconbtn" aria-label={m.common.closeEsc} title={m.common.closeEsc} onClick={onClose}>
              <IconClose className="cap-ico" />
            </button>
          )}
        </div>
        {lookup.romanized && <div className="cap-lookup__roman">{lookup.romanized}</div>}
        {(lookup.pos || (isWord && phrase) || freq) && (
          <div className="cap-lookup__meta">
            {lookup.pos && <span className="cap-tag">{lookup.pos}</span>}
            {phrase && isWord && <span className="cap-tag">{m.common.phrase}</span>}
            {freq && (
              <span className="cap-lookup__freq" title={freq.long}>
                <FrequencyBars rank={props.rank} />
                <span aria-hidden="true">{freq.short}</span>
                <span className="cap-sr">{freq.long}</span>
              </span>
            )}
          </div>
        )}
        <div className="cap-lookup__body">
          <div ref={statusRef}>
            <StatusToggle status={lookup.saved?.status} onChange={setStatus} />
            {lookup.removed && !lookup.saved && (
              <p className="cap-lookup__undo">
                {m.lookup.removedFromWords}{' '}
                <button className="cap-link" onClick={undoRemove}>
                  {m.lookup.undo}
                </button>
              </p>
            )}
          </div>
          {(lookup.translation || !!lookup.explanation?.definition.length) && (
            <div>
              {lookup.translation && <div className="cap-lookup__tr">{lookup.translation}</div>}
              <ExplanationDefinition explanation={lookup.explanation} />
            </div>
          )}
          {suggestion && (
            <ChunkButton suggestion={suggestion} lang={target.lang} onPick={() => onSelectWord?.({ ...suggestion, rect: target.rect })} />
          )}
          {isWord && target.sentence && target.sentence !== target.text && (
            <div className="cap-ctx" lang={target.lang}>
              <MarkedSentence sentence={target.sentence} word={target.text} />
              {target.translation && (
                <div className="cap-ctx__tr" lang={settings.nativeLanguage}>
                  {target.translation}
                </div>
              )}
            </div>
          )}
          <TutorAnswer
            lookup={lookup}
            subject={target.text}
            isWord={isWord}
            lang={target.lang}
            speechRate={settings.dictionary.speechRate}
            chunkShown={!!suggestion}
            onSetUpTutor={props.onSetUpTutor}
            announce={announce}
          />
          {isWord && settings.dictionary.wiktionary && lookup.dictState !== 'idle' && (
            <div className="cap-lookup__dict">
              <h3 className="cap-lookup__section">{m.lookup.dictionaryHeader}</h3>
              {lookup.dictState === 'loading' && <span className="cap-spinner" />}
              {lookup.dictState === 'error' && <div className="cap-help">{m.lookup.dictError}</div>}
              {lookup.dictState === 'done' && lookup.dict?.entries.length === 0 && (
                <div className="cap-help">{m.lookup.dictEmptyPaper(target.text)}</div>
              )}
              {lookup.dict?.entries.slice(0, 3).map((entry, i) => (
                <div key={i} style={i ? { marginTop: 6 } : undefined}>
                  <div className="cap-lookup__pos">{entry.partOfSpeech}</div>
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
            </div>
          )}
          {lookup.links.length > 0 && (
            <div className="cap-lookup__links">
              {lookup.links.map((l) => (
                <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="cap-sr" role="status">
        {said}
      </div>
    </section>
  );
}
