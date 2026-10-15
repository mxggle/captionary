import { useEffect, useMemo, useState } from 'react';
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
import { CommitInput } from '@/ui/form';
import { IconDownload, IconExternal, IconSearch, IconSpeaker, IconTrash } from '@/ui/icons';
import { Markdown } from '@/ui/Markdown';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Review({ items, onExit }: { items: VocabItem[]; onExit: () => void }) {
  const deck = useMemo(() => [...items].sort(() => Math.random() - 0.5), [items]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const item = deck[i];
  const next = (status?: VocabStatus) => {
    if (item && status) void updateVocab(item.id, { status });
    setShown(false);
    setI((n) => n + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setShown(true);
      } else if (shown && e.key === '1') next('learning');
      else if (shown && e.key === '2') next('known');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!item) {
    return (
      <div className="lr-card" style={{ textAlign: 'center', padding: 40 }}>
        <h2>Done! You reviewed {deck.length} items.</h2>
        <button className="lr-btn primary" onClick={onExit}>
          Back to the list
        </button>
      </div>
    );
  }
  const sentence = item.context?.sentence;
  return (
    <div className="lr-card" style={{ padding: 32, textAlign: 'center' }}>
      <div className="lr-status">
        {i + 1} / {deck.length}
      </div>
      <div style={{ fontSize: 34, fontWeight: 650, margin: '16px 0' }} lang={item.lang}>
        {item.text}{' '}
        <button className="lr-icon-btn" onClick={() => void speak(item.text, item.lang)} title="Listen">
          <IconSpeaker />
        </button>
      </div>
      {sentence && sentence !== item.text && (
        <div className="lr-context" style={{ fontSize: 16, maxWidth: 640, margin: '0 auto' }} lang={item.lang}>
          {sentence}
        </div>
      )}
      {shown ? (
        <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 640, marginInline: 'auto' }}>
          {item.translation && (
            <div className="lr-quick-tr" style={{ textAlign: 'center' }}>
              {item.translation}
            </div>
          )}
          {item.context?.translation && (
            <div className="lr-status" style={{ textAlign: 'center', marginTop: 6 }}>
              {item.context.translation}
            </div>
          )}
          {item.notes && (
            <div className="lr-ai" style={{ marginTop: 12 }}>
              <Markdown text={item.notes} />
            </div>
          )}
          <div className="lr-row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <button className="lr-btn learning" onClick={() => next('learning')}>
              Still learning <span className="lr-kbd">1</span>
            </button>
            <button className="lr-btn known" onClick={() => next('known')}>
              I know it <span className="lr-kbd">2</span>
            </button>
          </div>
        </div>
      ) : (
        <button className="lr-btn primary" style={{ marginTop: 24 }} onClick={() => setShown(true)}>
          Show answer <span className="lr-kbd">Space</span>
        </button>
      )}
      <div style={{ marginTop: 20 }}>
        <button className="lr-link" onClick={onExit}>
          Stop reviewing
        </button>
      </div>
    </div>
  );
}

export function VocabApp() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('all');
  const [status, setStatus] = useState<'all' | VocabStatus>('all');
  const [kind, setKind] = useState<'all' | 'word' | 'phrase'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    const load = () => void listVocab().then(setItems);
    load();
    return watchVocab(load);
  }, []);

  const langs = useMemo(() => [...new Set((items ?? []).map((i) => i.lang))].sort(), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (lang === 'all' || i.lang === lang) &&
        (status === 'all' || i.status === status) &&
        (kind === 'all' || i.kind === kind) &&
        (!q ||
          i.text.toLowerCase().includes(q) ||
          i.translation?.toLowerCase().includes(q) ||
          i.context?.sentence.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q)),
    );
  }, [items, query, lang, status, kind]);

  const stamp = new Date().toISOString().slice(0, 10);
  if (!items) return null;

  return (
    <div className="lr-main" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="lr-row">
        <h1 style={{ margin: 0 }}>Saved words &amp; phrases</h1>
        <span className="lr-chip">{items.length}</span>
        <span className="lr-spacer" />
        <a className="lr-btn" href="/options.html">
          Settings
        </a>
      </div>
      <p className="lr-lead" style={{ marginTop: 6 }}>
        Everything you saved while watching or reading. Learning words are highlighted wherever they appear again.
      </p>

      {reviewing ? (
        <Review
          items={filtered.filter((i) => i.status === 'learning').length ? filtered.filter((i) => i.status === 'learning') : filtered}
          onExit={() => setReviewing(false)}
        />
      ) : (
        <>
          <div className="lr-row" style={{ marginBottom: 14 }}>
            <IconSearch style={{ width: 16, height: 16, color: 'var(--lr-muted)' }} />
            <input
              className="lr-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Search words, translations, sentences, notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="lr-select" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="all">All languages</option>
              {langs.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
            <select className="lr-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">Any status</option>
              <option value="learning">Learning</option>
              <option value="known">Known</option>
            </select>
            <select className="lr-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="all">Words &amp; phrases</option>
              <option value="word">Words</option>
              <option value="phrase">Phrases</option>
            </select>
          </div>
          <div className="lr-row" style={{ marginBottom: 14 }}>
            <button className="lr-btn primary" disabled={!filtered.length} onClick={() => setReviewing(true)}>
              Review {filtered.length ? `(${filtered.filter((i) => i.status === 'learning').length || filtered.length})` : ''}
            </button>
            <span className="lr-spacer" />
            <span className="lr-status">Export {filtered.length} shown:</span>
            <button className="lr-btn" onClick={() => download(`words-${stamp}.csv`, `\ufeff${toCsv(filtered)}`, 'text/csv')}>
              <IconDownload /> CSV
            </button>
            <button className="lr-btn" onClick={() => download(`anki-${stamp}.txt`, toAnkiTsv(filtered), 'text/plain')}>
              <IconDownload /> Anki
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="lr-card lr-empty">
              {items.length === 0
                ? 'No saved words yet. Click any word in a YouTube, Netflix or Apple TV+ subtitle and choose “Save as learning”.'
                : 'Nothing matches these filters.'}
            </div>
          ) : (
            <div className="lr-card" style={{ padding: 0 }}>
              <table className="lr-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Word / phrase</th>
                    <th style={{ width: '22%' }}>Translation</th>
                    <th>Context</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const src = sourceUrl(item);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="lr-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <b lang={item.lang}>{item.text}</b>
                            <button className="lr-icon-btn" title="Listen" onClick={() => void speak(item.text, item.lang)}>
                              <IconSpeaker />
                            </button>
                          </div>
                          <div className="lr-status">
                            {languageName(item.lang)} · {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <CommitInput
                            value={item.translation ?? ''}
                            placeholder="Add a translation"
                            style={{ width: '100%' }}
                            onCommit={(v) => void updateVocab(item.id, { translation: v.trim() || undefined })}
                          />
                        </td>
                        <td>
                          {item.context?.sentence && (
                            <div lang={item.lang} style={{ fontSize: 13 }}>
                              {item.context.sentence}
                            </div>
                          )}
                          {item.context?.translation && <div className="lr-status">{item.context.translation}</div>}
                          <div className="lr-row" style={{ gap: 10, marginTop: 4 }}>
                            {src && (
                              <a className="lr-link" href={src} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                                {item.context?.title ?? 'Source'}
                                {item.context?.time !== undefined ? ` @ ${formatTime(item.context.time)}` : ''}{' '}
                                <IconExternal style={{ width: 11, height: 11 }} />
                              </a>
                            )}
                            <button className="lr-link" style={{ fontSize: 12 }} onClick={() => setOpen(open === item.id ? null : item.id)}>
                              {item.notes ? (open === item.id ? 'Hide notes' : 'Notes') : 'Add notes'}
                            </button>
                          </div>
                          {open === item.id && (
                            <textarea
                              className="lr-input"
                              style={{ marginTop: 6, minHeight: 120, fontFamily: 'inherit' }}
                              defaultValue={item.notes ?? ''}
                              placeholder="Notes, mnemonics, the AI explanation…"
                              onBlur={(e) => void updateVocab(item.id, { notes: e.target.value.trim() || undefined })}
                            />
                          )}
                        </td>
                        <td>
                          <select
                            className="lr-select"
                            value={item.status}
                            onChange={(e) => void updateVocab(item.id, { status: e.target.value as VocabStatus })}
                          >
                            <option value="learning">Learning</option>
                            <option value="known">Known</option>
                          </select>
                        </td>
                        <td>
                          <button className="lr-icon-btn" title="Delete" onClick={() => void removeVocab(item.id)}>
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
