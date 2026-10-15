import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { extractTranslation } from '@/lib/ai/prompts';
import type { AIJob, ChatTurn } from '@/lib/ai/types';
import { externalDictionaries, type DictionaryResult } from '@/lib/dictionary';
import { languageName } from '@/lib/languages';
import { bg, streamJob, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canRomanize } from '@/lib/text/romanize';
import { chromeTranslatorState, translateWithChrome } from '@/lib/translate';
import { canSpeak, speak } from '@/lib/tts';
import { vocabKey, type VocabItem, type VocabStatus } from '@/lib/vocab';
import type { AnchorRect, PopupTarget } from '@/content/store';
import { IconBookmark, IconClose, IconCopy, IconPlay, IconRefresh, IconSend, IconSparkles, IconSpeaker } from './icons';
import { Markdown } from './Markdown';
import { TokenizedText, type WordSelection } from './TokenizedText';
import { useAIStream } from './useAIStream';
import { useVocabIndex } from './vocab-index';

export interface WordPopupProps {
  target: PopupTarget;
  settings: Settings;
  aiStatus: AIStatus | null;
  vocab: Record<string, VocabItem>;
  /** Viewport rectangle of the element the pop-up is positioned in. */
  bounds: AnchorRect;
  fixed?: boolean;
  /** Render in the page flow (side panel, reader) instead of floating next to a word. */
  embedded?: boolean;
  mediaTitle?: string;
  /** Frequency rank of the word, when known. */
  rank?: number;
  onClose: () => void;
  onSave: (status: VocabStatus | null, extra?: { translation?: string; notes?: string }) => void;
  onPlayLine?: () => void;
  onSelectWord?: (sel: WordSelection) => void;
  onOpenSidePanel?: () => void;
}

const POPUP_WIDTH = 400;

function usePosition(target: PopupTarget, bounds: AnchorRect): CSSProperties {
  const width = Math.min(POPUP_WIDTH, bounds.width - 16);
  const anchorX = target.rect.left - bounds.left + target.rect.width / 2;
  const left = Math.max(8, Math.min(anchorX - width / 2, bounds.width - width - 8));
  const spaceAbove = target.rect.top - bounds.top;
  const spaceBelow = bounds.height - (spaceAbove + target.rect.height);
  if (spaceAbove > spaceBelow) {
    return { left, width, bottom: bounds.height - spaceAbove + 8, maxHeight: Math.max(160, spaceAbove - 16) };
  }
  return { left, width, top: spaceAbove + target.rect.height + 8, maxHeight: Math.max(160, spaceBelow - 16) };
}

function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0 || !word) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, i)}
      <mark>{sentence.slice(i, i + word.length)}</mark>
      {sentence.slice(i + word.length)}
    </>
  );
}

export function WordPopup(props: WordPopupProps) {
  const { target, settings, aiStatus, vocab, bounds, fixed, embedded, onClose, onSave } = props;
  const ref = useRef<HTMLDivElement>(null);
  const isWord = target.kind === 'word';
  const native = settings.nativeLanguage;
  const position = usePosition(target, bounds);
  const index = useVocabIndex(vocab, target.lang);

  const identity = useMemo(() => vocabKey(target.text, target.lang), [target.text, target.lang]);
  const saved = vocab[identity.id];

  // ---- quick on-device translation ----
  const [quick, setQuick] = useState<string | null>(null);
  useEffect(() => {
    setQuick(null);
    if (!settings.dictionary.quickTranslate || !target.lang || target.lang === native) return;
    let alive = true;
    void (async () => {
      const state = await chromeTranslatorState(target.lang, native);
      if (state === 'unsupported' || state === 'unavailable') return;
      try {
        const out = await translateWithChrome(target.text, target.lang, native);
        if (alive) setQuick(out);
      } catch {
        // on-device translation is optional
      }
    })();
    return () => {
      alive = false;
    };
  }, [target.text, target.lang, native, settings.dictionary.quickTranslate]);

  // ---- romanization (pinyin, romaji…) ----
  const [romanized, setRomanized] = useState('');
  useEffect(() => {
    setRomanized('');
    if (!settings.subtitles.showRomanization || !canRomanize(target.lang)) return;
    let alive = true;
    bg({ type: 'text.romanize', lang: target.lang, lines: [target.text] })
      .then(([r]) => alive && setRomanized(r ?? ''))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [target.text, target.lang, settings.subtitles.showRomanization]);

  // ---- dictionary ----
  const [dict, setDict] = useState<DictionaryResult | null>(null);
  const [dictState, setDictState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  useEffect(() => {
    setDict(null);
    if (!isWord || !settings.dictionary.wiktionary) return;
    let alive = true;
    setDictState('loading');
    bg({ type: 'dict.lookup', word: target.text, lang: target.lang })
      .then((d) => alive && (setDict(d), setDictState('done')))
      .catch(() => alive && setDictState('error'));
    return () => {
      alive = false;
    };
  }, [isWord, target.text, target.lang, settings.dictionary.wiktionary]);

  // ---- AI explanation ----
  const ai = useAIStream();
  const job = useMemo<AIJob>(
    () =>
      isWord
        ? {
            task: 'word',
            text: target.text,
            sentence: target.sentence,
            before: target.before,
            after: target.after,
            sentenceTranslation: target.translation,
            targetLang: target.lang,
            mediaTitle: props.mediaTitle,
          }
        : {
            task: 'sentence',
            sentence: target.text,
            before: target.before,
            after: target.after,
            sentenceTranslation: target.translation,
            targetLang: target.lang,
            mediaTitle: props.mediaTitle,
          },
    [isWord, target, props.mediaTitle],
  );
  const aiReady = !!aiStatus?.enabled && !!aiStatus.configured;
  // Sentence breakdowns are always explicitly requested; word explanations start
  // automatically only if the user opted in (each one is a paid request).
  const autoStart = aiReady && (!isWord || !!aiStatus?.autoExplain);
  const { start: startAI, reset: resetAI } = ai;
  useEffect(() => {
    resetAI();
    setTurns([]);
    if (autoStart) startAI(job);
  }, [job, autoStart, startAI, resetAI]);

  // ---- follow-up chat ----
  const [turns, setTurns] = useState<{ q: string; a: string; status: 'streaming' | 'done' | 'error'; error?: string }[]>([]);
  const [question, setQuestion] = useState('');
  const chatCancel = useRef<(() => void) | null>(null);
  useEffect(() => () => chatCancel.current?.(), []);
  const ask = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    const history: ChatTurn[] = [];
    if (ai.text) history.push({ role: 'assistant', content: ai.text });
    for (const t of turns) {
      if (t.status !== 'done') continue;
      history.push({ role: 'user', content: t.q }, { role: 'assistant', content: t.a });
    }
    const idx = turns.length;
    setTurns((ts) => [...ts, { q, a: '', status: 'streaming' }]);
    const update = (fn: (t: (typeof turns)[number]) => (typeof turns)[number]) =>
      setTurns((ts) => ts.map((t, i) => (i === idx ? fn(t) : t)));
    chatCancel.current = streamJob(
      { task: 'chat', subject: target.text, sentence: target.sentence, targetLang: target.lang, history, question: q },
      {
        onDelta: (d) => update((t) => ({ ...t, a: t.a + d })),
        onDone: (r) => update((t) => ({ ...t, a: r.text, status: 'done' })),
        onError: (err) => update((t) => ({ ...t, status: 'error', error: err.message })),
      },
    );
  };

  // ---- dismiss on outside click ----
  useEffect(() => {
    if (embedded) return;
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      if (ref.current && path.includes(ref.current)) return;
      onClose();
    };
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose, embedded]);

  // Prefer the on-device translation; otherwise reuse the AI's "Translation:" line.
  const translationForSave = quick ?? (isWord && ai.status === 'done' ? extractTranslation(ai.text) : undefined);
  const setStatus = (status: VocabStatus) => {
    if (saved?.status === status) onSave(null);
    else onSave(status, { translation: saved?.translation ?? translationForSave });
  };
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);
  const links = isWord ? externalDictionaries(target.text, target.lang, native) : [];

  return (
    <div
      ref={ref}
      className={`lr-popup${embedded ? ' embedded' : fixed ? ' fixed' : ''}`}
      style={embedded ? undefined : position}
      role="dialog"
      aria-label={`Look-up: ${target.text}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="lr-pop-head">
        <div className={`lr-pop-word${isWord ? '' : ' sentence'}`} lang={target.lang}>
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
          {romanized && <div className="lr-pop-roman">{romanized}</div>}
          {props.rank !== undefined && (
            <div className="lr-pop-rank" title="Rank in a frequency list of film and TV subtitles">
              #{props.rank.toLocaleString()} most common
            </div>
          )}
        </div>
        {canSpeak() && (
          <button
            className="lr-icon-btn"
            title="Listen"
            onClick={() => void speak(target.text, target.lang, settings.dictionary.speechRate)}
          >
            <IconSpeaker />
          </button>
        )}
        {props.onPlayLine && (
          <button className="lr-icon-btn" title="Play this line" onClick={props.onPlayLine}>
            <IconPlay />
          </button>
        )}
        {!embedded && (
          <button className="lr-icon-btn" title="Close (Esc)" onClick={onClose}>
            <IconClose />
          </button>
        )}
      </div>

      <div
        className="lr-pop-body"
        style={{ maxHeight: !embedded && typeof position.maxHeight === 'number' ? position.maxHeight - 56 : undefined }}
      >
        <div className="lr-pop-actions">
          <button className={`lr-btn learning${saved?.status === 'learning' ? ' active' : ''}`} onClick={() => setStatus('learning')}>
            <IconBookmark /> {saved?.status === 'learning' ? 'Learning' : 'Save as learning'}
          </button>
          <button className={`lr-btn known${saved?.status === 'known' ? ' active' : ''}`} onClick={() => setStatus('known')}>
            {saved?.status === 'known' ? '✓ Known' : 'Mark known'}
          </button>
          <button className="lr-icon-btn" title="Copy" onClick={() => copy(target.text)}>
            <IconCopy />
          </button>
        </div>

        {(quick || saved?.translation) && (
          <div>
            <div className="lr-section-title">Translation · {languageName(native)}</div>
            <div className="lr-quick-tr">{saved?.translation || quick}</div>
          </div>
        )}

        {!isWord && target.translation && !quick && (
          <div>
            <div className="lr-section-title">Subtitle translation</div>
            <div className="lr-quick-tr">{target.translation}</div>
          </div>
        )}

        {isWord && target.sentence && target.sentence !== target.text && (
          <div className="lr-context" lang={target.lang}>
            <HighlightedSentence sentence={target.sentence} word={target.text} />
            {target.translation && <div className="tr">{target.translation}</div>}
          </div>
        )}

        <div className="lr-ai">
          <div className="lr-section-title">
            <IconSparkles style={{ width: 13, height: 13 }} /> AI {isWord ? 'explanation' : 'breakdown'}
          </div>
          {!aiReady ? (
            <div className="lr-status">
              {aiStatus && !aiStatus.enabled ? 'AI is turned off. ' : 'Connect an AI provider to get explanations in context. '}
              <button className="lr-link" onClick={() => void bg({ type: 'open.page', page: 'options', hash: 'ai' })}>
                Open AI settings
              </button>
            </div>
          ) : ai.status === 'idle' ? (
            <button className="lr-btn primary" onClick={() => ai.start(job)}>
              <IconSparkles /> Explain “{target.text.length > 24 ? `${target.text.slice(0, 24)}…` : target.text}” in context
            </button>
          ) : ai.status === 'loading' ? (
            <div className="lr-status" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="lr-spinner" /> Thinking…
            </div>
          ) : ai.status === 'error' ? (
            <div>
              <div className="lr-error">{ai.error?.message}</div>
              <div className="lr-ai-meta">
                <button className="lr-btn" onClick={() => ai.start(job)}>
                  <IconRefresh /> Retry
                </button>
                {['missing_key', 'auth', 'permission', 'not_configured', 'limit_reached'].includes(ai.error?.code ?? '') && (
                  <button className="lr-link" onClick={() => void bg({ type: 'open.page', page: 'options', hash: 'ai' })}>
                    Open settings
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className={ai.status === 'streaming' ? 'lr-cursor' : undefined}>
                <Markdown text={ai.text} />
              </div>
              {ai.status === 'done' && (
                <div className="lr-ai-meta">
                  <span title={ai.provider}>{ai.model}</span>
                  {ai.cached && <span className="lr-chip">cached</span>}
                  <span className="spacer" />
                  <button className="lr-icon-btn" title="Copy explanation" onClick={() => copy(ai.text)}>
                    <IconCopy />
                  </button>
                  <button
                    className="lr-icon-btn"
                    title="Save explanation to this word's notes"
                    onClick={() =>
                      onSave(saved?.status ?? 'learning', { translation: saved?.translation ?? translationForSave, notes: ai.text })
                    }
                  >
                    <IconBookmark />
                  </button>
                  <button className="lr-icon-btn" title="Regenerate" onClick={() => ai.start(job)}>
                    <IconRefresh />
                  </button>
                </div>
              )}
            </>
          )}

          {aiReady && (ai.status === 'done' || turns.length > 0) && (
            <>
              {turns.map((t, i) => (
                <div key={i}>
                  <div className="lr-chat-q">{t.q}</div>
                  {t.status === 'error' ? (
                    <div className="lr-error">{t.error}</div>
                  ) : t.a ? (
                    <div className={t.status === 'streaming' ? 'lr-cursor' : undefined}>
                      <Markdown text={t.a} />
                    </div>
                  ) : (
                    <span className="lr-spinner" />
                  )}
                </div>
              ))}
              <form className="lr-chat-form" onSubmit={ask}>
                <input
                  className="lr-input"
                  placeholder="Ask a follow-up question…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={500}
                />
                <button className="lr-icon-btn" type="submit" title="Ask" disabled={!question.trim()}>
                  <IconSend />
                </button>
              </form>
            </>
          )}
        </div>

        {isWord && settings.dictionary.wiktionary && (
          <div className="lr-dict">
            <div className="lr-section-title">Dictionary · Wiktionary</div>
            {dictState === 'loading' && <span className="lr-spinner" />}
            {dictState === 'error' && <div className="lr-status">Dictionary unavailable.</div>}
            {dictState === 'done' && dict && dict.entries.length === 0 && (
              <div className="lr-status">No entry for “{target.text}”. It may be an inflected form — try the AI explanation.</div>
            )}
            {dict?.entries.slice(0, 3).map((entry, i) => (
              <div key={i}>
                <div className="lr-dict-pos">{entry.partOfSpeech}</div>
                <ol>
                  {entry.senses.slice(0, 4).map((s, j) => (
                    <li key={j}>
                      {s.definition}
                      {s.examples[0] && <div className="ex">{s.examples[0]}</div>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div className="lr-links">
            {links.map((l) => (
              <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
                {l.name}
              </a>
            ))}
            {props.onOpenSidePanel && (
              <button className="lr-link" onClick={props.onOpenSidePanel}>
                Open in side panel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
