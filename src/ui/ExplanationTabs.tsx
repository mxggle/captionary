import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { StorySection, WordExplanation, WordSection } from '@/lib/ai/prompts';
import { formatAIError, useI18n } from '@/lib/i18n';
import { formatTime } from '@/lib/subtitles/parse';
import { canSpeak, speak } from '@/lib/tts';
import { IconChevronRight, IconSpeaker } from './icons';
import { Markdown } from './Markdown';
import type { ChunkSuggestion, InShow } from './useLookup';

type Tab = Exclude<WordSection, 'meaning'> | 'story';

/** Mentions listed before "All N lines": the most recent ones. */
const MENTIONS_SHOWN = 4;

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
 * A name or term in a video gets a third tab, "In the show", whose request is sent when it is opened.
 */
export function ExplanationTabs({
  explanation,
  streaming,
  lang,
  native,
  speechRate,
  chunkShown,
  inShow,
  onPlayCue,
}: {
  explanation: WordExplanation;
  streaming: boolean;
  lang: string;
  native: string;
  speechRate: number;
  /** The chunk line is shown above as a `ChunkButton`, so the context leaves it out. */
  chunkShown?: boolean;
  inShow?: InShow | null;
  /** Play a line of the episode, from the "In the show" tab's mentions. */
  onPlayCue?: (index: number) => void;
}) {
  const { m } = useI18n();
  const [picked, setTab] = useState<Tab>('context');
  const id = useId();
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const writing = streaming ? explanation.started[explanation.started.length - 1] : undefined;
  const storyBusy = inShow?.ai.status === 'loading' || inShow?.ai.status === 'streaming';
  const pending = (t: Tab) => (t === 'story' ? storyBusy : streaming && !explanation.started.includes(t));
  const tabs: { id: Tab; label: string }[] = [
    { id: 'context', label: m.lookup.inContextTab },
    { id: 'examples', label: m.lookup.examplesTab },
  ];
  if (inShow) tabs.push({ id: 'story', label: m.lookup.inShowTab });
  // The tab goes away while a regenerated explanation has not yet said the word is a name.
  const tab = tabs.some((t) => t.id === picked) ? picked : 'context';
  // Opening "In the show" is what sends its request.
  const open = (t: Tab) => {
    setTab(t);
    if (t === 'story' && inShow?.ai.status === 'idle') inShow.ask();
  };
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
    open(tabs[next].id);
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
            onClick={() => open(t.id)}
          >
            {t.label}
            {pending(t.id) && <span className="cap-spinner cap-explain__wait" aria-label={m.common.loading} />}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} className="cap-explain__panel" role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === 'context' ? (
          <ContextPanel lines={explanation.context} chunkShown={chunkShown} cursor={writing === 'context'} />
        ) : tab === 'examples' ? (
          <ExamplesPanel explanation={explanation} lang={lang} native={native} speechRate={speechRate} cursor={writing === 'examples'} />
        ) : (
          inShow && <StoryPanel inShow={inShow} lang={lang} onPlayCue={onPlayCue} />
        )}
        {tab !== 'story' && pending(tab) && <span className="cap-spinner" />}
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

/**
 * "In the show": what the name means and the forms it takes, who or what it is, how it is connected
 * to others, and the episode's lines that mention it (found here, so they show before the answer).
 */
function StoryPanel({ inShow, lang, onPlayCue }: { inShow: InShow; lang: string; onPlayCue?: (index: number) => void }) {
  const { m } = useI18n();
  const [allLines, setAllLines] = useState(false);
  const { ai, explanation: story, mentions, heardUntil } = inShow;
  const writing = ai.status === 'streaming' ? story?.started[story.started.length - 1] : undefined;
  /** The streaming cursor, on the last line of the section being written. */
  const at = (section: StorySection, i: number, n: number) => (writing === section && i === n - 1 ? ' cap-cursor' : '');
  const lines = allLines ? mentions : mentions.slice(-MENTIONS_SHOWN);
  return (
    <>
      {ai.status === 'loading' && (
        <div className="cap-story__wait">
          <span className="cap-spinner" />
          {m.common.thinking}
        </div>
      )}
      {ai.status === 'error' && (
        <div className="cap-explain__warn" role="alert">
          {formatAIError(ai.error, m).primary}{' '}
          <button className="cap-link" onClick={inShow.ask}>
            {m.common.retry}
          </button>
        </div>
      )}
      {story ? (
        <>
          {story.meaning.length + story.forms.length > 0 && (
            <div className="cap-story__sec">
              <div className="cap-story__label">{m.lookup.storyName}</div>
              {story.meaning.map((line, i) => (
                <div key={i} className={`cap-explain__line${story.forms.length ? '' : at('name', i, story.meaning.length)}`}>
                  <Markdown text={line} />
                </div>
              ))}
              {story.forms.length > 0 && (
                <p className={`cap-story__forms${at('name', 0, 1)}`} lang={lang}>
                  {story.forms.join(' · ')}
                </p>
              )}
            </div>
          )}
          {story.role.length > 0 && (
            <div className="cap-story__sec">
              <div className="cap-story__label">{inShow.kind === 'person' ? m.lookup.storyWho : m.lookup.storyWhat}</div>
              {story.role.map((line, i) => (
                <div key={i} className={`cap-explain__line${at('role', i, story.role.length)}`}>
                  <Markdown text={line} />
                </div>
              ))}
            </div>
          )}
          {story.relations.length > 0 && (
            <div className="cap-story__sec">
              <div className="cap-story__label">{m.lookup.storyRelations}</div>
              <ul className="cap-story__rel">
                {story.relations.map((r, i) => (
                  <li key={i} className={at('relations', i, story.relations.length) || undefined}>
                    {r.who && (
                      <span className="cap-story__who" lang={lang}>
                        {plain(r.who)}
                      </span>
                    )}
                    <span>{plain(r.relation)}</span>
                    {r.source === 'K' && (
                      <span className="cap-story__src" title={m.lookup.storyFromKnowledgeTitle}>
                        {m.lookup.storyFromKnowledge}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        // An answer from a custom prompt without the section markers.
        ai.text && (
          <div className={ai.status === 'streaming' ? 'cap-cursor' : undefined}>
            <Markdown text={ai.text} />
          </div>
        )
      )}
      {mentions.length > 0 && (
        <div className="cap-story__sec">
          <div className="cap-story__label">{m.lookup.storyLines(mentions.length)}</div>
          <ul className="cap-story__lines">
            {lines.map((x) => (
              <li key={x.index}>
                <button
                  className="cap-story__line"
                  disabled={!onPlayCue}
                  title={m.lookup.playThisLine}
                  onClick={() => onPlayCue?.(x.index)}
                >
                  <span className="cap-story__time">{formatTime(x.time)}</span>
                  <span lang={lang}>{x.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {lines.length < mentions.length && (
            <button className="cap-link cap-story__more" onClick={() => setAllLines(true)}>
              {m.lookup.storyAllLines(mentions.length)}
            </button>
          )}
        </div>
      )}
      <p className="cap-story__note">
        {heardUntil !== undefined ? m.lookup.storySpoilerFree(formatTime(heardUntil)) : m.lookup.storySpoilersAllowed}
        {ai.status === 'done' && ai.model && ` · ${ai.model}${ai.cached ? ` · ${m.common.cached}` : ''}`}
      </p>
    </>
  );
}
