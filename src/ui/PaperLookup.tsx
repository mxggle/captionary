import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { formatAIError, useI18n } from '@/lib/i18n';
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

/** The tutor's answer on pages (`TutorAnswer`): label, streamed text, model, follow-ups and the ask field. */
export function TutorAnswer({
  lookup,
  subject,
  isWord,
  lang,
  speechRate,
  chunkShown,
  onSetUpTutor,
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
}) {
  const { m } = useI18n();
  const { ai } = lookup;
  const [question, setQuestion] = useState('');
  const label = (
    <div className="cap-tutor__label">
      <IconSpark className="cap-ico" />
      {m.lookup.tutorLabel}
    </div>
  );
  const ask = (e: FormEvent) => {
    e.preventDefault();
    lookup.ask(question);
    setQuestion('');
  };
  if (!lookup.aiReady) {
    return (
      <div className="cap-tutor">
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
      </div>
    );
  }
  if (ai.status === 'idle') {
    const short = subject.length > 24 ? `${subject.slice(0, 24)}…` : subject;
    return (
      <div className="cap-tutor" style={{ paddingTop: 10 }}>
        <button className="cap-btn cap-btn--primary cap-btn--sm" onClick={lookup.explain}>
          <IconSpark className="cap-ico" />
          {isWord ? m.lookup.explainWordInContext(short) : m.lookup.breakDownSentence}
        </button>
      </div>
    );
  }
  return (
    <div className="cap-tutor">
      {label}
      {ai.status === 'loading' ? (
        <div className="cap-row cap-tutor__text">
          <span className="cap-spinner" />
          {m.common.thinking}
        </div>
      ) : ai.status === 'error' ? (
        <>
          <p className="cap-tutor__text" style={{ color: 'var(--danger)' }}>
            {formatAIError(ai.error, m).primary}
          </p>
          {formatAIError(ai.error, m).detail && (
            <p className="cap-tutor__text" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
              {formatAIError(ai.error, m).detail}
            </p>
          )}
          <div className="cap-row" style={{ marginTop: 8 }}>
            <button className="cap-btn cap-btn--sm" onClick={lookup.explain}>
              <IconRefresh className="cap-ico" />
              {m.common.retry}
            </button>
            <a href="/options.html#ai" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              {m.lookup.openAISettings}
            </a>
          </div>
        </>
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
                className="cap-iconbtn cap-iconbtn--sm"
                aria-label={m.common.copy}
                title={m.common.copy}
                onClick={() => lookup.copy(lookup.answerText)}
              >
                <IconCopy className="cap-ico" />
              </button>
              <button
                className="cap-iconbtn cap-iconbtn--sm"
                aria-label={m.lookup.saveToNotes}
                title={m.lookup.saveToNotes}
                onClick={lookup.saveNotes}
              >
                <IconBookmark className="cap-ico" />
              </button>
              <button
                className="cap-iconbtn cap-iconbtn--sm"
                aria-label={m.lookup.regenerate}
                title={m.lookup.regenerate}
                onClick={lookup.explain}
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
            <p className="cap-tutor__text" style={{ color: 'var(--danger)' }}>
              {formatAIError({ code: 'unknown', message: t.error }, m).primary}
            </p>
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
          />
          <button className="cap-iconbtn cap-iconbtn--solid" type="submit" aria-label={m.lookup.askButton} disabled={!question.trim()}>
            <IconArrowRight className="cap-ico" />
          </button>
        </form>
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
  const index = useVocabIndex(vocab, target.lang);
  const isWord = lookup.isWord;
  const { onSelectWord } = props;
  const suggestion = onSelectWord ? lookup.suggestion : null;

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

  const rawBand = rankBand(props.rank, !!props.rankKnown);
  const band = rawBand === 'rarer' ? m.lookup.rarer : rawBand;
  const rankLabel = props.rankKnown && isWord ? (band ?? m.lookup.top2000) : undefined;
  const phrase = lookup.identity.kind === 'phrase';
  // Above the word, a streaming answer would grow the card upward and move the text being read;
  // the card takes its full height at once instead and fills from the top.
  const scrollStyle = props.maxHeight
    ? props.growsUp && lookup.answerShown
      ? { height: props.maxHeight }
      : { maxHeight: props.maxHeight }
    : undefined;

  return (
    <section
      ref={ref}
      className={`cap-lookup${docked ? ' cap-lookup--docked' : ' is-floating'}`}
      style={props.style}
      role={docked ? undefined : 'dialog'}
      aria-label={m.lookup.lookupAria(target.text)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="cap-lookup__scroll" style={scrollStyle}>
        <div className="cap-lookup__head">
          <span className={`cap-lookup__word${isWord ? '' : ' is-sentence'}`} lang={target.lang}>
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
          </span>
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
        {(lookup.pos || (isWord && phrase) || rankLabel) && (
          <div className="cap-lookup__meta">
            {lookup.pos && <span className="cap-tag">{lookup.pos}</span>}
            {phrase && isWord && <span className="cap-tag">{m.common.phrase}</span>}
            {rankLabel && (
              <>
                <FrequencyBars rank={props.rank} />
                {rankLabel}
              </>
            )}
          </div>
        )}
        <div className="cap-lookup__body">
          <StatusToggle status={lookup.saved?.status} onChange={lookup.setStatus} />
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
          />
          {isWord && settings.dictionary.wiktionary && lookup.dictState !== 'idle' && (
            <div className="cap-lookup__dict">
              <div className="cap-lookup__section">{m.lookup.dictionaryHeader}</div>
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
    </section>
  );
}
