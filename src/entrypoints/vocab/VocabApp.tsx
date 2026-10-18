import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, type Messages, type UILocale } from '@/lib/i18n';
import { languageName } from '@/lib/languages';
import { formatTime } from '@/lib/subtitles/parse';
import { speak } from '@/lib/tts';
import {
  listVocab,
  removeVocab,
  sourceUrl,
  toAnkiTsv,
  toCsv,
  updateVocab,
  watchVocab,
  type VocabItem,
  type VocabStatus,
} from '@/lib/vocab';
import { AppShell } from '@/ui/AppShell';
import { PageHead, Select, usePopover } from '@/ui/controls';
import {
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconExternal,
  IconMore,
  IconPlay,
  IconSearch,
  IconSpeaker,
  IconTrash,
} from '@/ui/icons';
import { Markdown } from '@/ui/Markdown';
import { MarkedSentence, StatusToggle } from '@/ui/PaperLookup';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useItems(): VocabItem[] | null {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  useEffect(() => {
    const load = () => void listVocab().then(setItems);
    load();
    return watchVocab(load);
  }, []);
  return items;
}

function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

/** Where a word was saved, as a short name: the video title, or the site. */
function sourceName(item: VocabItem): string | undefined {
  if (item.context?.title) return item.context.title;
  try {
    return item.context?.url ? new URL(item.context.url).hostname.replace(/^www\./, '') : undefined;
  } catch {
    return undefined;
  }
}

function dayLabel(ts: number, locale: UILocale, m: Messages): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return m.vocab.today;
  if (diff === 1) return m.vocab.yesterday;
  return d.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

function StatusMenu({ item }: { item: VocabItem }) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const [confirming, setConfirming] = useState(false);
  const learning = item.status === 'learning';
  const statusText = learning ? m.common.learning : m.common.known;
  const set = (status: VocabStatus) => {
    void updateVocab(item.id, { status });
    pop.setOpen(false);
  };
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        className={`cap-tag ${learning ? 'cap-tag--learn' : 'cap-tag--known'} cap-entry__status`}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        aria-label={m.vocab.statusAria(item.text, statusText)}
        onClick={() => {
          setConfirming(false);
          pop.setOpen(!pop.open);
        }}
      >
        {!learning && <IconCheck className="cap-ico" style={{ width: 12, height: 12 }} />}
        {statusText}
      </button>
      {pop.open && (
        <div role="menu" aria-label={m.vocab.statusMenuAria(item.text)} className="cap-popover">
          {confirming ? (
            <>
              <div style={{ padding: '6px 10px', fontSize: 13.5 }}>{m.vocab.confirmRemoveSaved(item.text)}</div>
              <div className="cap-row" style={{ padding: '4px 6px' }}>
                <button
                  className="cap-btn cap-btn--sm cap-btn--danger-fill"
                  style={{ width: 'auto' }}
                  onClick={() => void removeVocab(item.id)}
                >
                  {m.common.remove}
                </button>
                <button className="cap-btn cap-btn--sm cap-btn--ghost" style={{ width: 'auto' }} onClick={() => setConfirming(false)}>
                  {m.common.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="cap-btn cap-btn--ghost" role="menuitemradio" aria-checked={learning} onClick={() => set('learning')}>
                <span className="cap-chip__dot" />
                {m.common.learning}
                <span className="cap-spacer" />
                {learning && <IconCheck className="cap-ico" />}
              </button>
              <button className="cap-btn cap-btn--ghost" role="menuitemradio" aria-checked={!learning} onClick={() => set('known')}>
                <IconCheck className="cap-ico" style={{ color: 'var(--known)' }} />
                {m.common.known}
                <span className="cap-spacer" />
                {!learning && <IconCheck className="cap-ico" />}
              </button>
              <div className="cap-popover__sep" />
              <button className="cap-btn cap-btn--ghost cap-btn--danger" role="menuitem" onClick={() => setConfirming(true)}>
                <IconTrash className="cap-ico" />
                {m.vocab.removeFromSaved}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}

function MoreMenu({ item, onEdit }: { item: VocabItem; onEdit: () => void }) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const [confirming, setConfirming] = useState(false);
  const src = sourceUrl(item);
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        className="cap-iconbtn cap-iconbtn--sm"
        aria-label={m.vocab.moreActionsAria(item.text)}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={() => {
          setConfirming(false);
          pop.setOpen(!pop.open);
        }}
      >
        <IconMore className="cap-ico" />
      </button>
      {pop.open && (
        <div role="menu" aria-label={m.vocab.actionsForAria(item.text)} className="cap-popover">
          {confirming ? (
            <>
              <div style={{ padding: '6px 10px', fontSize: 13.5 }}>{m.vocab.confirmDeleteEntry(item.text)}</div>
              <div className="cap-row" style={{ padding: '4px 6px' }}>
                <button
                  className="cap-btn cap-btn--sm cap-btn--danger-fill"
                  style={{ width: 'auto' }}
                  onClick={() => void removeVocab(item.id)}
                >
                  {m.common.delete}
                </button>
                <button className="cap-btn cap-btn--sm cap-btn--ghost" style={{ width: 'auto' }} onClick={() => setConfirming(false)}>
                  {m.common.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="cap-btn cap-btn--ghost"
                role="menuitem"
                onClick={() => {
                  pop.setOpen(false);
                  onEdit();
                }}
              >
                {m.vocab.editTranslationNotes}
              </button>
              <button
                className="cap-btn cap-btn--ghost"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(item.translation ? `${item.text} — ${item.translation}` : item.text);
                  pop.setOpen(false);
                }}
              >
                <IconCopy className="cap-ico" />
                {m.common.copy}
              </button>
              {src && (
                <a
                  className="cap-btn cap-btn--ghost"
                  role="menuitem"
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => pop.setOpen(false)}
                >
                  <IconExternal className="cap-ico" />
                  {m.vocab.openSource}
                </a>
              )}
              <div className="cap-popover__sep" />
              <button className="cap-btn cap-btn--ghost cap-btn--danger" role="menuitem" onClick={() => setConfirming(true)}>
                <IconTrash className="cap-ico" />
                {m.common.delete}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}

/** One saved word or phrase, laid out like a dictionary entry (`Entry`). */
function Entry({ item, editing, onEdit, onDone }: { item: VocabItem; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const { m } = useI18n();
  const [tr, setTr] = useState(item.translation ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  useEffect(() => {
    if (!editing) return;
    setTr(item.translation ?? '');
    setNotes(item.notes ?? '');
  }, [editing, item.translation, item.notes]);
  const src = sourceUrl(item);
  const source = sourceName(item);
  const sentence = item.context?.sentence;
  const save = () => {
    void updateVocab(item.id, { translation: tr.trim() || undefined, notes: notes.trim() || undefined });
    onDone();
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDone();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };
  const listen = (
    <button
      className="cap-iconbtn cap-iconbtn--sm cap-iconbtn--soft"
      aria-label={m.vocab.listenToAria(item.text)}
      onClick={() => void speak(item.text, item.lang)}
    >
      <IconSpeaker className="cap-ico" />
    </button>
  );
  const head = (
    <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
      <span className="cap-headword" lang={item.lang}>
        {item.text}
      </span>
      {item.kind === 'phrase' && <span className="cap-tag">{m.common.phrase}</span>}
      {listen}
    </div>
  );
  if (editing) {
    return (
      <article className="cap-entry is-editing">
        <div className="cap-entry__head">
          {head}
          <label className="cap-sr" htmlFor={`tr-${item.id}`}>
            {m.vocab.translationOfAria(item.text)}
          </label>
          <input
            id={`tr-${item.id}`}
            className="cap-input cap-entry__tr-edit"
            value={tr}
            placeholder={m.vocab.addTranslationPlaceholder}
            autoFocus
            onChange={(e) => setTr(e.target.value)}
            onKeyDown={keys}
          />
        </div>
        <div className="cap-entry__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sentence && (
            <div lang={item.lang}>
              <MarkedSentence sentence={sentence} word={item.text} forms={item.forms} />
            </div>
          )}
          <div className="cap-field">
            <label className="cap-label" htmlFor={`nt-${item.id}`}>
              {m.vocab.notesLabel}
            </label>
            <textarea
              id={`nt-${item.id}`}
              className="cap-input"
              style={{ minHeight: 92, fontFamily: 'var(--font-sans)', fontSize: 14 }}
              value={notes}
              placeholder={m.vocab.notesPlaceholder}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={keys}
            />
          </div>
          <div className="cap-row">
            <button className="cap-btn cap-btn--primary cap-btn--sm" onClick={save}>
              {m.common.save}
            </button>
            <button className="cap-btn cap-btn--ghost cap-btn--sm" onClick={onDone}>
              {m.common.cancel}
            </button>
            <span className="cap-help">{m.vocab.editShortcutsHelp}</span>
          </div>
        </div>
        <div className="cap-entry__side">
          <span
            className={`cap-tag ${item.status === 'learning' ? 'cap-tag--learn' : 'cap-tag--known'}`}
            style={{ height: 30, padding: '0 12px' }}
          >
            {item.status === 'learning' ? m.common.learning : m.common.known}
          </span>
        </div>
      </article>
    );
  }
  return (
    <article className={`cap-entry${item.status === 'known' ? ' is-known' : ''}`}>
      <div className="cap-entry__head">
        {head}
        <button className={`cap-entry__tr${item.translation ? '' : ' is-empty'}`} title={m.vocab.editTranslationTitle} onClick={onEdit}>
          {item.translation || m.vocab.addTranslationPlaceholder}
        </button>
      </div>
      <div className="cap-entry__body">
        {sentence && sentence !== item.text && (
          <div lang={item.lang}>
            {/* The highlighter is for words you are learning; known entries stay plain. */}
            {item.status === 'learning' ? <MarkedSentence sentence={sentence} word={item.text} forms={item.forms} /> : sentence}
          </div>
        )}
        {item.context?.translation && <div className="cap-entry__ctx-tr">{item.context.translation}</div>}
        <div className="cap-entry__meta">
          {src ? (
            <a href={src} target="_blank" rel="noopener noreferrer">
              {source ?? m.vocab.sourceFallback}
              {item.context?.time !== undefined ? ` · ${formatTime(item.context.time)}` : ''}
            </a>
          ) : (
            source && <span className="cap-subtle">{source}</span>
          )}
          {item.notes && <span className="cap-subtle">{m.vocab.noteSaved}</span>}
        </div>
      </div>
      <div className="cap-entry__side">
        <StatusMenu item={item} />
        <MoreMenu item={item} onEdit={onEdit} />
      </div>
    </article>
  );
}

type Filter = 'all' | 'learning' | 'known' | 'phrases';

function ExportMenu({ items, total }: { items: VocabItem[]; total: number }) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const stamp = new Date().toISOString().slice(0, 10);
  const run = (fn: () => void) => {
    fn();
    pop.setOpen(false);
  };
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        className="cap-btn cap-btn--lg"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        disabled={!items.length}
        onClick={() => pop.setOpen(!pop.open)}
      >
        <IconDownload className="cap-ico" />
        {m.vocab.exportBtn(items.length < total ? items.length : undefined)}
        <IconChevronDown className="cap-ico" />
      </button>
      {pop.open && (
        <div role="menu" aria-label={m.vocab.exportMenuAria} className="cap-popover">
          <button
            className="cap-btn cap-btn--ghost"
            role="menuitem"
            onClick={() => run(() => download(`captionary-words-${stamp}.csv`, `\uFEFF${toCsv(items)}`, 'text/csv'))}
          >
            CSV
          </button>
          <button
            className="cap-btn cap-btn--ghost"
            role="menuitem"
            onClick={() => run(() => download(`captionary-anki-${stamp}.txt`, toAnkiTsv(items), 'text/plain'))}
          >
            Anki
          </button>
          <button
            className="cap-btn cap-btn--ghost"
            role="menuitem"
            onClick={() => run(() => download(`captionary-words-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json'))}
          >
            {m.options.data.jsonBackup}
          </button>
        </div>
      )}
    </span>
  );
}

function SavedWords({ items }: { items: VocabItem[] }) {
  const { locale, m } = useI18n();
  const [query, setQuery] = useState('');
  const langs = useMemo(() => [...new Set(items.map((i) => i.lang))].sort(), [items]);
  const [lang, setLang] = useState('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    if (lang !== 'all' && !langs.includes(lang)) setLang('all');
  }, [langs, lang]);

  const inScope = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (lang === 'all' || i.lang === lang) &&
        (!q ||
          i.text.toLowerCase().includes(q) ||
          i.translation?.toLowerCase().includes(q) ||
          i.context?.sentence.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q)),
    );
  }, [items, query, lang]);
  const counts = {
    all: inScope.length,
    learning: inScope.filter((i) => i.status === 'learning').length,
    known: inScope.filter((i) => i.status === 'known').length,
    phrases: inScope.filter((i) => i.kind === 'phrase').length,
  };
  const shown = inScope.filter((i) => filter === 'all' || (filter === 'phrases' ? i.kind === 'phrase' : i.status === filter));
  const days = useMemo(() => {
    const groups = new Map<string, VocabItem[]>();
    for (const item of [...shown].sort((a, b) => b.createdAt - a.createdAt)) {
      const key = new Date(item.createdAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.values()];
  }, [shown]);
  const learningAll = items.filter((i) => i.status === 'learning' && (lang === 'all' || i.lang === lang)).length;
  const langSuffix = lang === 'all' ? '' : m.vocab.inLang(languageName(lang, locale));

  const chip = (value: Filter, label: React.ReactNode) => (
    <button className="cap-chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
      {label} <span className="cap-chip__n">{counts[value]}</span>
    </button>
  );

  return (
    <>
      <PageHead
        title={m.vocab.savedWordsTitle}
        lead={
          filter === 'learning' ? (
            m.vocab.learningLead(counts.learning, langSuffix)
          ) : (
            <>
              {m.vocab.savedWordsLeadBefore}
              <mark className="cap-mark">{m.vocab.savedWordsLeadMark}</mark>
              {m.vocab.savedWordsLeadAfter}
            </>
          )
        }
      >
        <ExportMenu items={shown} total={items.length} />
        <a className="cap-btn cap-btn--primary cap-btn--lg" href="#review" aria-disabled={!items.length}>
          {m.vocab.reviewNow}
          {learningAll > 0 && <span className="cap-btn__count">{learningAll}</span>}
        </a>
      </PageHead>

      <div className="cap-row" style={{ gap: 8 }}>
        <label className="cap-search" style={{ flex: '1 1 260px' }}>
          <IconSearch className="cap-ico" />
          <span className="cap-sr">{m.vocab.searchAria}</span>
          <input placeholder={m.vocab.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {langs.length > 1 && (
          <Select
            variant="chip"
            label={m.vocab.languageLabel}
            value={lang}
            options={[{ value: 'all', label: m.vocab.allLanguages }, ...langs.map((l) => ({ value: l, label: languageName(l, locale) }))]}
            onChange={setLang}
          />
        )}
        <div className="cap-row" role="group" aria-label={m.vocab.filterAria} style={{ gap: 6 }}>
          {chip('all', m.vocab.filterAll)}
          {chip(
            'learning',
            <>
              <span className="cap-chip__dot" />
              {m.common.learning}
            </>,
          )}
          {chip(
            'known',
            <>
              <IconCheck className="cap-ico" style={{ color: filter === 'known' ? undefined : 'var(--known)' }} />
              {m.common.known}
            </>,
          )}
          {chip('phrases', m.vocab.filterPhrases)}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="cap-card cap-empty">
          {m.vocab.emptyNoWordsBefore}
          <strong>{m.vocab.emptyNoWordsStrong}</strong>
          {m.vocab.emptyNoWordsAfter}
        </div>
      ) : days.length === 0 ? (
        <div className="cap-card cap-empty">{m.vocab.emptyNoMatch}</div>
      ) : (
        days.map((group) => {
          const sources = [...new Set(group.map(sourceName).filter(Boolean))];
          const label = dayLabel(group[0].createdAt, locale, m);
          return (
            <section key={label} className="cap-day" aria-label={label}>
              <h2 className="cap-h2">
                {label}{' '}
                <span className="cap-h2__meta">
                  {m.vocab.daySavedMeta(group.length)}
                  {sources.length ? ` · ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? '…' : ''}` : ''}
                </span>
              </h2>
              <div className="cap-card">
                {group.map((item) => (
                  <Entry
                    key={item.id}
                    item={item}
                    editing={editing === item.id}
                    onEdit={() => setEditing(item.id)}
                    onDone={() => setEditing(null)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Flashcards from the words you are learning (`Review`). */
function Review({ items }: { items: VocabItem[] }) {
  const { locale, m } = useI18n();
  // The deck is fixed when the review starts; status changes during it don't reshuffle it.
  const [deck] = useState(() => {
    const learning = items.filter((i) => i.status === 'learning');
    return shuffle(learning.length ? learning : items);
  });
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const live = useRef(items);
  live.current = items;
  const item = deck[i] ? (live.current.find((x) => x.id === deck[i].id) ?? deck[i]) : undefined;
  const next = (status?: VocabStatus) => {
    if (item && status) void updateVocab(item.id, { status });
    setShown(false);
    setI((n) => n + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setShown(true);
      } else if (shown && e.key === '1') next('learning');
      else if (shown && e.key === '2') next('known');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!deck.length) {
    return (
      <>
        <PageHead title={m.vocab.reviewTitle} lead={m.vocab.reviewLead} />
        <div className="cap-card cap-empty">{m.vocab.reviewEmpty}</div>
      </>
    );
  }
  if (!item) {
    return (
      <section className="cap-flash" aria-label={m.vocab.reviewFinishedAria}>
        <h1 className="cap-h1" style={{ fontSize: 32, lineHeight: '36px' }}>
          {m.common.done}
        </h1>
        <p className="cap-lead" style={{ margin: 0 }}>
          {m.vocab.reviewedCards(deck.length)}
        </p>
        <a className="cap-btn cap-btn--primary cap-btn--lg" href="#">
          {m.vocab.backToSavedWords}
        </a>
      </section>
    );
  }
  const sentence = item.context?.sentence;
  const hasSentence = !!sentence && sentence !== item.text;
  const listen = (
    <button
      className="cap-iconbtn cap-iconbtn--solid"
      aria-label={m.vocab.listenToAria(item.text)}
      onClick={() => void speak(item.text, item.lang)}
    >
      <IconSpeaker className="cap-ico" />
    </button>
  );
  const srcName = sourceName(item);
  return (
    <>
      <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-muted)' }}>
          {m.vocab.ofCount(i + 1, deck.length)}
        </span>
        <div
          className="cap-progress cap-spacer"
          role="progressbar"
          aria-label={m.vocab.reviewProgressAria}
          aria-valuenow={i + 1}
          aria-valuemin={0}
          aria-valuemax={deck.length}
        >
          <span style={{ width: `${((i + 1) / deck.length) * 100}%` }} />
        </div>
        <a href="#" style={{ fontSize: 14 }}>
          {m.vocab.stopReviewing}
        </a>
      </div>
      <div className="cap-row" style={{ gap: 6 }}>
        <span className="cap-tag">
          {item.status === 'learning' ? m.common.learning : m.common.known} · {languageName(item.lang, locale)}
        </span>
        {srcName && <span className="cap-tag">{m.vocab.fromSource(srcName)}</span>}
      </div>

      {shown ? (
        <section className="cap-flash" aria-label={m.vocab.flashcardAnswerAria}>
          <div className="cap-row" style={{ justifyContent: 'center', gap: 12 }}>
            <span className="cap-flash__word" lang={item.lang}>
              {item.text}
            </span>
            {listen}
          </div>
          {item.translation && <div style={{ fontSize: 22, lineHeight: 1.3 }}>{item.translation}</div>}
          {hasSentence && (
            <div className="cap-ctx" lang={item.lang} style={{ fontSize: 17 }}>
              <MarkedSentence sentence={sentence} word={item.text} forms={item.forms} />
              {item.context?.translation && (
                <div className="cap-ctx__tr" style={{ fontSize: 14 }}>
                  {item.context.translation}
                </div>
              )}
            </div>
          )}
          {item.notes && (
            <div className="cap-tutor" style={{ width: '100%', maxWidth: 520, textAlign: 'left' }}>
              <div className="cap-tutor__label">
                <IconBookmark className="cap-ico" />
                {m.vocab.yourNote}
              </div>
              <div className="cap-tutor__text">
                <Markdown text={item.notes} />
              </div>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <StatusToggle status={undefined} large keys={['1', '2']} onChange={(s) => next(s)} />
          </div>
        </section>
      ) : (
        <>
          <section className="cap-flash" aria-label={m.vocab.flashcardAria} style={{ minHeight: 420, justifyContent: 'center' }}>
            <div className="cap-row" style={{ justifyContent: 'center', gap: 12 }}>
              <span className="cap-flash__word" lang={item.lang}>
                {item.text}
              </span>
              {listen}
            </div>
            {hasSentence && (
              <>
                <div className="cap-ctx" lang={item.lang} style={{ fontSize: 18 }}>
                  <MarkedSentence sentence={sentence} word={item.text} forms={item.forms} />
                </div>
                <button
                  className="cap-btn cap-btn--lg"
                  style={{ marginTop: 8, background: 'transparent' }}
                  onClick={() => void speak(sentence, item.lang)}
                >
                  <IconPlay className="cap-ico" />
                  {m.vocab.playTheLine}
                </button>
              </>
            )}
            <button className="cap-btn cap-btn--primary cap-btn--lg" style={{ marginTop: 12 }} onClick={() => setShown(true)}>
              {m.vocab.showAnswer}
              <span className="cap-kbd">{m.common.space}</span>
            </button>
          </section>
          <p className="cap-help" style={{ textAlign: 'center', margin: 0 }}>
            {m.vocab.reviewTip}
          </p>
        </>
      )}
    </>
  );
}

export function VocabApp() {
  const { m } = useI18n();
  const items = useItems();
  const hash = useHash();
  const reviewing = hash === '#review';
  useEffect(() => {
    document.title = `${reviewing ? m.vocab.reviewTitle : m.vocab.savedWordsTitle} · Captionary`;
  }, [reviewing, m]);
  if (!items) return null;
  return reviewing ? (
    <AppShell current="review" narrow>
      <Review key={hash} items={items} />
    </AppShell>
  ) : (
    <AppShell current="vocab">
      <SavedWords items={items} />
    </AppShell>
  );
}
