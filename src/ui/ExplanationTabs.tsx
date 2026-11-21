import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { WordExplanation, WordSection } from '@/lib/ai/prompts';
import { useI18n } from '@/lib/i18n';
import { canSpeak, speak } from '@/lib/tts';
import { IconChevronRight, IconSpeaker } from './icons';
import { Markdown } from './Markdown';
import type { ChunkSuggestion } from './useLookup';

type Tab = Exclude<WordSection, 'meaning'>;

/** Markdown marks dropped, for reading a line aloud or showing it as plain text. */
const plain = (md: string) => md.replace(/\*\*|__|`/g, '');

/** The definition under the pinned meaning (`ExplanationTabs`): one plain sentence, and the base form. */
export function ExplanationDefinition({ explanation }: { explanation: WordExplanation | null }) {
  if (!explanation?.definition.length) return null;
  return (
    <div className="cap-explain__def">
      {explanation.definition.map((line, i) => (
        <Markdown key={i} text={line} />
      ))}
    </div>
  );
}

/**
 * The larger chunk of the line the tutor says the word belongs to (`ExplanationTabs`), under its
 * dictionary form: one press looks it up instead and marks it in the line.
 */
export function ChunkButton({ suggestion, lang, onPick }: { suggestion: ChunkSuggestion; lang: string; onPick: () => void }) {
  const { m } = useI18n();
  return (
    <button className="cap-chunk" title={m.lookup.chunkTitle(suggestion.text)} onClick={onPick}>
      <span className="cap-chunk__label">{m.lookup.chunkLabel}</span>
      <span className="cap-chunk__text" lang={lang}>
        {suggestion.base}
      </span>
      {suggestion.meaning && (
        <span className="cap-chunk__meaning" title={plain(suggestion.meaning)}>
          {plain(suggestion.meaning)}
        </span>
      )}
      <IconChevronRight className="cap-ico" />
    </button>
  );
}

/**
 * The tutor's word explanation below the pinned meaning (`ExplanationTabs`): what the word does in
 * this sentence, and new examples of the same sense. It opens on the context; examples are a tap away.
 */
export function ExplanationTabs({
  explanation,
  streaming,
  lang,
  native,
  speechRate,
  chunkShown,
}: {
  explanation: WordExplanation;
  streaming: boolean;
  lang: string;
  native: string;
  speechRate: number;
  /** The chunk line is shown above as a `ChunkButton`, so the context leaves it out. */
  chunkShown?: boolean;
}) {
  const { m } = useI18n();
  const [tab, setTab] = useState<Tab>('context');
  const id = useId();
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const writing = streaming ? explanation.started[explanation.started.length - 1] : undefined;
  const pending = (t: Tab) => streaming && !explanation.started.includes(t);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'context', label: m.lookup.inContextTab },
    { id: 'examples', label: m.lookup.examplesTab },
  ];
  // Arrows, Home and End move between the tabs and open the one they land on.
  const onKeyDown = (e: KeyboardEvent) => {
    const at = tabs.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight'
        ? (at + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (at - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    // Kept from the page too: arrow keys seek the video on the sites the native card sits on.
    e.preventDefault();
    e.stopPropagation();
    setTab(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="cap-explain">
      <div className="cap-explain__tabs" role="tablist" aria-label={m.lookup.explanationTabsAria} onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            id={`${id}-${t.id}`}
            className="cap-explain__tab"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {pending(t.id) && <span className="cap-spinner cap-explain__wait" aria-label={m.common.loading} />}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} className="cap-explain__panel" role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === 'context' ? (
          <ContextPanel lines={explanation.context} chunkShown={chunkShown} cursor={writing === 'context'} />
        ) : (
          <ExamplesPanel explanation={explanation} lang={lang} native={native} speechRate={speechRate} cursor={writing === 'examples'} />
        )}
        {pending(tab) && <span className="cap-spinner" />}
      </div>
    </div>
  );
}

/** `cursor`: the section is being written, so its last line carries the streaming cursor. */
function ContextPanel({ lines, chunkShown, cursor }: { lines: string[]; chunkShown?: boolean; cursor: boolean }) {
  return (
    <>
      {lines.map((line, i) => {
        if (i === 0 && chunkShown) return null;
        const warning = line.startsWith('⚠');
        // The first line names the chunk to learn, in backticks, and what it means.
        const chunk = i === 0 && line.startsWith('`');
        const cls = warning ? 'cap-explain__warn' : chunk ? 'cap-explain__chunk' : 'cap-explain__line';
        return (
          <div key={i} className={cursor && i === lines.length - 1 ? `${cls} cap-cursor` : cls}>
            <Markdown text={line} />
          </div>
        );
      })}
    </>
  );
}

function ExamplesPanel({
  explanation,
  lang,
  native,
  speechRate,
  cursor,
}: {
  explanation: WordExplanation;
  lang: string;
  native: string;
  speechRate: number;
  cursor: boolean;
}) {
  const { m } = useI18n();
  const { collocations, examples } = explanation;
  // The streaming cursor follows the last thing written: an example's translation, the example, or the collocations.
  const last = examples.length - 1;
  const at = (i: number, part: 'ex' | 'tr') =>
    cursor && i === last && (part === 'tr' ? !!examples[i].translation : !examples[i].translation) ? ' cap-cursor' : '';
  return (
    <>
      {collocations.length > 0 && (
        <p className={`cap-explain__colloc${cursor && last < 0 ? ' cap-cursor' : ''}`} lang={lang}>
          {collocations.map(plain).join(' · ')}
        </p>
      )}
      {examples.length > 0 && (
        <ul className="cap-explain__examples">
          {examples.map((e, i) => (
            <li key={i}>
              <div className={`cap-explain__ex${at(i, 'ex')}`} lang={lang}>
                <Markdown text={e.text} />
                {canSpeak() && (
                  <button
                    className="cap-explain__say"
                    aria-label={m.lookup.listenExample}
                    title={m.common.listen}
                    onClick={() => void speak(plain(e.text), lang, speechRate)}
                  >
                    <IconSpeaker className="cap-ico" />
                  </button>
                )}
              </div>
              {e.translation && (
                <div className={`cap-explain__ex-tr${at(i, 'tr')}`} lang={native}>
                  {plain(e.translation)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
