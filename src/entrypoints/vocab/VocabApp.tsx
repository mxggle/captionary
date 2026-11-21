import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  IconNote,
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

/** While an input method is composing, Enter picks a candidate; it must not save or submit. */
function composing(e: React.KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** A polite status line for screen readers; the same message twice is announced twice. */
function useAnnouncer(): [string, (text: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announce = useCallback((text: string) => {
    setMessage('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(text), 60);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [message, announce];
}

/**
 * Learning or Known. A disclosure (a button that shows two more), not an ARIA menu, so Tab moves
 * through the choices. Deleting a word has one place: More, behind its confirmation.
 */
function StatusMenu({ item, onStatus }: { item: VocabItem; onStatus: (status: VocabStatus) => void }) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const id = useId();
  const learning = item.status === 'learning';
  const statusText = learning ? m.common.learning : m.common.known;
  const set = (status: VocabStatus) => {
    onStatus(status);
    pop.setOpen(false);
  };
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        className={`cap-tag ${learning ? 'cap-tag--learn' : 'cap-tag--known'} cap-entry__status`}
        aria-expanded={pop.open}
        aria-controls={pop.open ? id : undefined}
        aria-label={m.vocab.statusAria(item.text, statusText)}
        onClick={() => pop.setOpen(!pop.open)}
      >
        {!learning && <IconCheck className="cap-ico" style={{ width: 12, height: 12 }} />}
        {statusText}
      </button>
      {pop.open && (
        <div id={id} role="group" aria-label={m.vocab.statusMenuAria(item.text)} className="cap-popover">
          <button className="cap-btn cap-btn--ghost" aria-pressed={learning} onClick={() => set('learning')}>
            <span className="cap-chip__dot" />
            {m.common.learning}
            <span className="cap-spacer" />
            {learning && <IconCheck className="cap-ico" />}
          </button>
          <button className="cap-btn cap-btn--ghost" aria-pressed={!learning} onClick={() => set('known')}>
            <IconCheck className="cap-ico" style={{ color: 'var(--known)' }} />
            {m.common.known}
            <span className="cap-spacer" />
            {!learning && <IconCheck className="cap-ico" />}
          </button>
        </div>
      )}
    </span>
  );
}

function MoreMenu({
  item,
  onEdit,
  onDelete,
  announce,
  triggerRef,
}: {
  item: VocabItem;
  onEdit: () => void;
  onDelete: () => void;
  announce: (text: string) => void;
  triggerRef: React.Ref<HTMLButtonElement>;
}) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const id = useId();
  const promptId = useId();
  const [confirming, setConfirming] = useState(false);
  // Cancelling the confirmation puts focus back on Delete instead of dropping it.
  const [cancelled, setCancelled] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const src = sourceUrl(item);
  const { setOpen } = pop;
  // "Copied" stays a moment, then the actions close.
  useEffect(() => {
    if (copy !== 'copied') return;
    const t = setTimeout(() => setOpen(false), 1200);
    return () => clearTimeout(t);
  }, [copy, setOpen]);
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(item.translation ? `${item.text} — ${item.translation}` : item.text);
      setCopy('copied');
      announce(m.vocab.copied);
    } catch {
      setCopy('failed');
      announce(m.vocab.copyFailed);
    }
  };
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        ref={triggerRef}
        className="cap-iconbtn cap-iconbtn--sm"
        aria-label={m.vocab.moreActionsAria(item.text)}
        aria-expanded={pop.open}
        aria-controls={pop.open ? id : undefined}
        onClick={() => {
          setConfirming(false);
          setCancelled(false);
          setCopy('idle');
          setOpen(!pop.open);
        }}
      >
        <IconMore className="cap-ico" />
      </button>
      {pop.open && (
        <div id={id} role="group" aria-label={m.vocab.actionsForAria(item.text)} className="cap-popover">
          {confirming ? (
            <div className="cap-entry__confirm" role="alertdialog" aria-labelledby={promptId}>
              <p id={promptId} className="cap-entry__confirm-text">
                {m.vocab.confirmDeleteEntry(item.text)}
              </p>
              <div className="cap-row cap-entry__confirm-actions">
                <button className="cap-btn cap-btn--sm cap-btn--danger-fill" onClick={onDelete}>
                  {m.common.delete}
                </button>
                <button
                  className="cap-btn cap-btn--sm cap-btn--ghost"
                  autoFocus
                  onClick={() => {
                    setConfirming(false);
                    setCancelled(true);
                  }}
                >
                  {m.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="cap-btn cap-btn--ghost"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                {m.vocab.editTranslationNotes}
              </button>
              <button className={`cap-btn cap-btn--ghost${copy === 'failed' ? ' cap-btn--danger' : ''}`} onClick={() => void copyText()}>
                {copy === 'copied' ? <IconCheck className="cap-ico" /> : <IconCopy className="cap-ico" />}
                {copy === 'copied' ? m.vocab.copied : copy === 'failed' ? m.vocab.copyFailed : m.common.copy}
              </button>
              {src && (
                <a className="cap-btn cap-btn--ghost" href={src} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                  <IconExternal className="cap-ico" />
                  {m.vocab.openSource}
                </a>
              )}
              <div className="cap-popover__sep" />
              <button className="cap-btn cap-btn--ghost cap-btn--danger" autoFocus={cancelled} onClick={() => setConfirming(true)}>
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
function Entry({
  item,
  editing,
  onEdit,
  onDone,
  onDelete,
  onStatus,
  announce,
  entryRef,
}: {
  item: VocabItem;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onDelete: () => void;
  onStatus: (status: VocabStatus) => void;
  announce: (text: string) => void;
  entryRef: (el: HTMLElement | null) => void;
}) {
  const { m } = useI18n();
  const [tr, setTr] = useState(item.translation ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const headId = useId();
  const trRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // The control that opened the editor; focus goes back to it when the editor closes.
  const opener = useRef<'tr' | 'more' | null>(null);
  useEffect(() => {
    if (!editing) return;
    setTr(item.translation ?? '');
    setNotes(item.notes ?? '');
  }, [editing, item.translation, item.notes]);
  useEffect(() => {
    if (editing || !opener.current) return;
    const from = opener.current;
    opener.current = null;
    // Only when focus went down with the editor, not when another entry's editor took it.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (from === 'tr' ? trRef : moreRef).current?.focus();
  }, [editing]);
  const src = sourceUrl(item);
  const source = sourceName(item);
  const sentence = item.context?.sentence;
  const save = () => {
    void updateVocab(item.id, { translation: tr.trim() || undefined, notes: notes.trim() || undefined });
    onDone();
  };
  const keys = (e: React.KeyboardEvent) => {
    if (composing(e)) return;
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
      <span className="cap-headword" id={headId} lang={item.lang}>
        {item.text}
      </span>
      {item.kind === 'phrase' && <span className="cap-tag">{m.common.phrase}</span>}
      {listen}
    </div>
  );
  if (editing) {
    return (
      <article className="cap-entry is-editing" ref={entryRef} tabIndex={-1} aria-labelledby={headId}>
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
    <article className={`cap-entry${item.status === 'known' ? ' is-known' : ''}`} ref={entryRef} tabIndex={-1} aria-labelledby={headId}>
      <div className="cap-entry__head">
        {head}
        <button
          ref={trRef}
          className={`cap-entry__tr${item.translation ? '' : ' is-empty'}`}
          title={m.vocab.editTranslationTitle}
          onClick={() => {
            opener.current = 'tr';
            onEdit();
          }}
        >
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
        {item.notes && (
          <div className="cap-entry__notes">
            <IconNote className="cap-ico" />
            <span className="cap-sr">{m.vocab.yourNote}</span>
            <Markdown text={item.notes} />
          </div>
        )}
        {(src || source) && (
          <div className="cap-entry__meta">
            {src ? (
              <a href={src} target="_blank" rel="noopener noreferrer">
                {source ?? m.vocab.sourceFallback}
                {item.context?.time !== undefined ? ` · ${formatTime(item.context.time)}` : ''}
              </a>
            ) : (
              <span className="cap-subtle">{source}</span>
            )}
          </div>
        )}
      </div>
      <div className="cap-entry__side">
        <StatusMenu item={item} onStatus={onStatus} />
        <MoreMenu
          item={item}
          triggerRef={moreRef}
          announce={announce}
          onDelete={onDelete}
          onEdit={() => {
            opener.current = 'more';
            onEdit();
          }}
        />
      </div>
    </article>
  );
}

type Filter = 'all' | 'learning' | 'known' | 'phrases';

function ExportMenu({ items, total }: { items: VocabItem[]; total: number }) {
  const { m } = useI18n();
  const pop = usePopover<HTMLSpanElement>();
  const id = useId();
  const stamp = new Date().toISOString().slice(0, 10);
  const run = (fn: () => void) => {
    fn();
    pop.setOpen(false);
  };
  return (
    <span className="cap-popwrap" ref={pop.ref}>
      <button
        className="cap-btn cap-btn--lg"
        aria-expanded={pop.open}
        aria-controls={pop.open ? id : undefined}
        disabled={!items.length}
        onClick={() => pop.setOpen(!pop.open)}
      >
        <IconDownload className="cap-ico" />
        {m.vocab.exportBtn(items.length < total ? items.length : undefined)}
        <IconChevronDown className="cap-ico" />
      </button>
      {pop.open && (
        <div id={id} role="group" aria-label={m.vocab.exportMenuAria} className="cap-popover">
          <button
            className="cap-btn cap-btn--ghost"
            onClick={() => run(() => download(`captionary-words-${stamp}.csv`, `\uFEFF${toCsv(items)}`, 'text/csv'))}
          >
            CSV
          </button>
          <button
            className="cap-btn cap-btn--ghost"
            onClick={() => run(() => download(`captionary-anki-${stamp}.txt`, toAnkiTsv(items), 'text/plain'))}
          >
            Anki
          </button>
          <button
            className="cap-btn cap-btn--ghost"
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
  const [message, announce] = useAnnouncer();
  const searchRef = useRef<HTMLInputElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const entries = useRef(new Map<string, HTMLElement>());
  // After a delete, or a status change the filter hides, focus moves to the entry below (else above)
  // once the list has caught up.
  const refocus = useRef<{ gone: string; next?: string } | null>(null);
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
  useEffect(() => {
    const r = refocus.current;
    if (!r || days.some((day) => day.some((i) => i.id === r.gone))) return;
    refocus.current = null;
    ((r.next && entries.current.get(r.next)) || emptyRef.current)?.focus();
  }, [days]);
  const leaving = (item: VocabItem) => {
    const order = days.flat();
    const at = order.findIndex((x) => x.id === item.id);
    refocus.current = { gone: item.id, next: (order[at + 1] ?? order[at - 1])?.id };
  };
  const remove = (item: VocabItem) => {
    leaving(item);
    void removeVocab(item.id);
    announce(m.vocab.deletedEntry(item.text));
  };
  const setStatus = (item: VocabItem, status: VocabStatus) => {
    if ((filter === 'learning' || filter === 'known') && status !== filter) leaving(item);
    void updateVocab(item.id, { status });
  };
  const clearAll = () => {
    setQuery('');
    setLang('all');
    setFilter('all');
    searchRef.current?.focus();
  };

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
        {items.length ? (
          <a className="cap-btn cap-btn--primary cap-btn--lg" href="#review">
            {m.vocab.reviewNow}
            {learningAll > 0 && <span className="cap-btn__count">{learningAll}</span>}
          </a>
        ) : (
          <button className="cap-btn cap-btn--primary cap-btn--lg" disabled>
            {m.vocab.reviewNow}
          </button>
        )}
      </PageHead>

      <div className="cap-row" style={{ gap: 8 }}>
        <label className="cap-search" style={{ flex: '1 1 260px' }}>
          <IconSearch className="cap-ico" />
          <span className="cap-sr">{m.vocab.searchAria}</span>
          <input ref={searchRef} placeholder={m.vocab.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
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
        <div className="cap-card cap-empty" ref={emptyRef} tabIndex={-1}>
          {m.vocab.emptyNoWordsBefore}
          <strong>{m.vocab.emptyNoWordsStrong}</strong>
          {m.vocab.emptyNoWordsAfter}
        </div>
      ) : days.length === 0 ? (
        <div className="cap-card cap-empty" ref={emptyRef} tabIndex={-1}>
          {m.vocab.emptyNoMatch}
          <div className="cap-empty__actions">
            <button className="cap-btn" onClick={clearAll}>
              {m.vocab.clearSearchAndFilters}
            </button>
          </div>
        </div>
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
                    onDelete={() => remove(item)}
                    onStatus={(status) => setStatus(item, status)}
                    announce={announce}
                    entryRef={(el) => {
                      if (el) entries.current.set(item.id, el);
                      else entries.current.delete(item.id);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
      <div className="cap-sr" role="status">
        {message}
      </div>
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
  // Turning or answering a card replaces its buttons; focus moves to the new side of the card.
  const card = useRef<HTMLElement>(null);
  useEffect(() => card.current?.focus(), [shown, i]);
  const item = deck[i] ? (live.current.find((x) => x.id === deck[i].id) ?? deck[i]) : undefined;
  const next = (status?: VocabStatus) => {
    if (item && status) void updateVocab(item.id, { status });
    setShown(false);
    setI((n) => n + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ') {
        // A focused button or link handles its own Space.
        if (target?.closest?.('button, a, [role="button"]')) return;
        e.preventDefault();
        setShown(true);
      } else if (e.repeat) return;
      else if (shown && e.key === '1') next('learning');
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
      <section className="cap-flash" aria-label={m.vocab.reviewFinishedAria} ref={card} tabIndex={-1}>
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
      <h1 className="cap-sr">{m.vocab.reviewTitle}</h1>
      <div className="cap-sr" role="status">
        {m.vocab.cardOfCount(i + 1, deck.length)}
      </div>
      <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
        <span className="cap-flash__count" aria-hidden="true">
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
        {srcName && (
          <span className="cap-tag" title={srcName}>
            <span className="cap-tag__text">{m.vocab.fromSource(srcName)}</span>
          </span>
        )}
      </div>

      {shown ? (
        <section className="cap-flash" aria-label={m.vocab.flashcardAnswerAria} ref={card} tabIndex={-1}>
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
                <IconNote className="cap-ico" />
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
          <section
            className="cap-flash"
            aria-label={m.vocab.flashcardAria}
            ref={card}
            tabIndex={-1}
            style={{ minHeight: 420, justifyContent: 'center' }}
          >
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
