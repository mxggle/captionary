import { useId, useState } from 'react';
import type { WordExplanation, WordSection } from '@/lib/ai/prompts';
import { canSpeak, speak } from '@/lib/tts';
import { IconChevronRight, IconSpeaker } from './icons';
import { Markdown } from './Markdown';
import type { ChunkSuggestion } from './useLookup';

type Tab = Exclude<WordSection, 'meaning'>;

const TABS: { id: Tab; label: string }[] = [
  { id: 'context', label: 'In context' },
  { id: 'examples', label: 'Examples' },
];

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
  return (
    <button className="cap-chunk" title={`Look up “${suggestion.text}” instead`} onClick={onPick}>
      <span className="cap-chunk__label">Phrase</span>
      <span className="cap-chunk__text" lang={lang}>
        {suggestion.base}
      </span>
      {suggestion.meaning && <span className="cap-chunk__meaning">{plain(suggestion.meaning)}</span>}
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
  const [tab, setTab] = useState<Tab>('context');
  const id = useId();
  const writing = streaming ? explanation.started[explanation.started.length - 1] : undefined;
  const pending = (t: Tab) => streaming && !explanation.started.includes(t);

  return (
    <div className="cap-explain">
      <div className="cap-explain__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${id}-${t.id}`}
            className="cap-explain__tab"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={tab === t.id ? `${id}-${t.id}-panel` : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {pending(t.id) && <span className="cap-spinner cap-explain__wait" aria-label="Loading" />}
          </button>
        ))}
      </div>
      <div
        id={`${id}-${tab}-panel`}
        className={`cap-explain__panel${writing === tab ? ' cap-cursor' : ''}`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
      >
        {tab === 'context' ? (
          <ContextPanel lines={explanation.context} chunkShown={chunkShown} />
        ) : (
          <ExamplesPanel explanation={explanation} lang={lang} native={native} speechRate={speechRate} />
        )}
        {pending(tab) && <span className="cap-spinner" />}
      </div>
    </div>
  );
}

function ContextPanel({ lines, chunkShown }: { lines: string[]; chunkShown?: boolean }) {
  return (
    <>
      {lines.map((line, i) => {
        if (i === 0 && chunkShown) return null;
        const warning = line.startsWith('⚠');
        // The first line names the chunk to learn, in backticks, and what it means.
        const chunk = i === 0 && line.startsWith('`');
        return (
          <div key={i} className={warning ? 'cap-explain__warn' : chunk ? 'cap-explain__chunk' : 'cap-explain__line'}>
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
}: {
  explanation: WordExplanation;
  lang: string;
  native: string;
  speechRate: number;
}) {
  const { collocations, examples } = explanation;
  return (
    <>
      {collocations.length > 0 && (
        <p className="cap-explain__colloc" lang={lang}>
          {collocations.map(plain).join(' · ')}
        </p>
      )}
      {examples.length > 0 && (
        <ul className="cap-explain__examples">
          {examples.map((e, i) => (
            <li key={i}>
              <div className="cap-explain__ex" lang={lang}>
                <Markdown text={e.text} />
                {canSpeak() && (
                  <button
                    className="cap-explain__say"
                    aria-label="Listen to this example"
                    title="Listen"
                    onClick={() => void speak(plain(e.text), lang, speechRate)}
                  >
                    <IconSpeaker className="cap-ico" />
                  </button>
                )}
              </div>
              {e.translation && (
                <div className="cap-explain__ex-tr" lang={native}>
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
