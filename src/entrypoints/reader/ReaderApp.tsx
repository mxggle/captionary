import { storage } from '#imports';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { languageName, normalizeLang, sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { readerImport } from '@/lib/session-items';
import { parseSubtitleFile, toPlainText } from '@/lib/subtitles/parse';
import { buildRankMap, frequencyRank } from '@/lib/text/frequency-map';
import { canRomanize } from '@/lib/text/romanize';
import { normalizeWord, splitSentences } from '@/lib/text/tokenize';
import { chromeTranslatorState, detectLanguage, translateLines } from '@/lib/translate';
import { speak } from '@/lib/tts';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { AppShell } from '@/ui/AppShell';
import { Note, PageHead } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { IconDocument, IconInfo, IconSpark, IconSpeaker, IconUpload } from '@/ui/icons';
import { PaperLookup } from '@/ui/PaperLookup';
import { TokenizedText } from '@/ui/TokenizedText';
import { useAIStatus, useVocabMap } from '@/ui/useVocab';
import { useVocabIndex } from '@/ui/vocab-index';
import { ModeSwitch, type ReaderMode } from './mode';
import { VideoMode } from './VideoMode';

interface ReaderDoc {
  title: string;
  url?: string;
  text: string;
  lang: string;
}

const lastDoc = storage.defineItem<ReaderDoc | null>('local:readerLastDoc', { fallback: null });

async function readTextFile(file: File): Promise<string> {
  const raw = await file.text();
  return /\.(srt|vtt)$/i.test(file.name) ? toPlainText(parseSubtitleFile(file.name, raw)) : raw;
}

/** Below the word when there is room, above it otherwise; inside the reading column. */
function placeLookup(rect: PopupTarget['rect'], wrap: HTMLElement | null): { style: CSSProperties; maxHeight: number; growsUp?: boolean } {
  const box = wrap?.getBoundingClientRect();
  if (!box) return { style: { top: 0, left: 0 }, maxHeight: 480 };
  const width = Math.min(380, innerWidth - 32);
  const left = Math.max(Math.min(rect.left - box.left + rect.width / 2 - width / 2, box.width - width + 40), -Math.min(box.left - 16, 40));
  const below = innerHeight - (rect.top + rect.height) - 24;
  const above = rect.top - 24;
  if (below >= 320 || below >= above) {
    return { style: { left, top: rect.top - box.top + rect.height + 8, width }, maxHeight: Math.max(240, below) };
  }
  return { style: { left, bottom: box.height - (rect.top - box.top) + 8, width }, maxHeight: Math.max(240, above), growsUp: true };
}

function TextMode({ onMode }: { onMode: (m: ReaderMode) => void }) {
  const [settings] = useSettings();
  const aiStatus = useAIStatus();
  const vocab = useVocabMap();
  const [doc, setDoc] = useState<ReaderDoc | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [popup, setPopup] = useState<(PopupTarget & { sentenceIndex: number }) | null>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<{ done: boolean; error?: string } | null>(null);
  const [romanized, setRomanized] = useState<string[]>([]);
  const [freq, setFreq] = useState<Map<string, number> | null>(null);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      if (location.hash === '#import') {
        const imported = await readerImport.getValue();
        if (imported) {
          await readerImport.setValue(null);
          history.replaceState(null, '', location.pathname);
          const lang = imported.lang ? normalizeLang(imported.lang) : ((await detectLanguage(imported.text)) ?? 'en');
          return setDoc({ title: imported.title, url: imported.url, text: imported.text, lang });
        }
      }
      setDoc(await lastDoc.getValue());
    })();
  }, []);
  useEffect(() => {
    if (doc) void lastDoc.setValue(doc);
    setTranslations({});
    setTranslating(null);
    setPopup(null);
  }, [doc]);

  const paragraphs = useMemo(() => {
    if (!doc) return [];
    let n = 0;
    return doc.text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => splitSentences(p.replace(/\s*\n\s*/g, ' '), doc.lang).map((text) => ({ text: text.trim(), i: n++ })));
  }, [doc]);
  const sentences = useMemo(() => paragraphs.flat(), [paragraphs]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPopup(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const index = useVocabIndex(vocab, doc?.lang ?? '');
  const showRoman = !!settings?.subtitles.showRomanization && !!doc && canRomanize(doc.lang);
  const wantFreq = !!settings?.subtitles.frequencyColors && !!doc;
  useEffect(() => {
    setFreq(null);
    if (!wantFreq || !doc) return;
    let alive = true;
    bg({ type: 'freq.list', lang: doc.lang })
      .then((words) => alive && setFreq(words ? buildRankMap(words, doc.lang) : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [wantFreq, doc]);
  useEffect(() => {
    setRomanized([]);
    if (!showRoman || !doc) return;
    let alive = true;
    bg({ type: 'text.romanize', lang: doc.lang, lines: sentences.map((s) => s.text) })
      .then((out) => alive && setRomanized(out))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [showRoman, sentences, doc]);

  const load = async (text: string, title = 'Pasted text', url?: string) => {
    const detected = await detectLanguage(text);
    const fallback = settings && settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
    setDoc({ title, url, text, lang: detected ? normalizeLang(detected) : fallback });
  };

  // Drop a file anywhere on the page.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDragging(false);
    const drop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      setDragging(false);
      if (!file) return;
      e.preventDefault();
      void readTextFile(file).then((text) => load(text, file.name));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  });

  if (!settings || doc === undefined) return null;
  const native = settings.nativeLanguage;

  const translateAll = async () => {
    if (!doc) return;
    const chrome = await chromeTranslatorState(doc.lang, native);
    const engine = chrome === 'available' || chrome === 'downloadable' ? 'chrome' : 'ai';
    setTranslating({ done: false });
    try {
      await translateLines(
        sentences.map((s) => s.text),
        {
          engine,
          sourceLang: doc.lang,
          targetLang: native,
          onBatch: (start, out) =>
            setTranslations((t) => {
              const next = { ...t };
              out.forEach((o, k) => (next[start + k] = o));
              return next;
            }),
        },
      );
      setTranslating({ done: true });
    } catch (err) {
      setTranslating({ done: true, error: (err as Error).message });
    }
  };

  const openPopup = (
    kind: 'word' | 'sentence',
    text: string,
    sentenceIndex: number,
    rect: PopupTarget['rect'],
    range?: [number, number],
  ) => {
    const s = sentences[sentenceIndex];
    setPopup({
      kind,
      text,
      lang: doc!.lang,
      cueIndex: -1,
      sentence: s?.text ?? text,
      translation: translations[sentenceIndex],
      before: sentences.slice(Math.max(0, sentenceIndex - 2), sentenceIndex).map((x) => x.text),
      after: sentences.slice(sentenceIndex + 1, sentenceIndex + 3).map((x) => x.text),
      rect,
      surface: 'reader',
      tokenRange: range,
      sentenceIndex,
    });
  };

  if (!doc) {
    return (
      <AppShell current="reader" narrow>
        <PageHead title="Reader" lead="Any text, with every word clickable: look-ups, translations and the tutor, as on the video sites.">
          <ModeSwitch mode="text" onMode={onMode} />
        </PageHead>
        <section className="cap-card" aria-label="Text to read" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="cap-label" htmlFor="reader-text">
            Paste text
          </label>
          <textarea
            id="reader-text"
            className="cap-input"
            style={{ minHeight: 220, fontFamily: 'var(--font-sans)', fontSize: 15 }}
            placeholder="An article, song lyrics, a dialogue…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="cap-row">
            <button className="cap-btn cap-btn--primary cap-btn--lg" disabled={!draft.trim()} onClick={() => void load(draft)}>
              Read
            </button>
            <span className="cap-help">or</span>
            <label className="cap-btn cap-btn--lg cap-file-btn">
              <IconDocument className="cap-ico" />
              Open a file
              <input
                type="file"
                accept=".txt,.md,.srt,.vtt,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await load(await readTextFile(file), file.name);
                }}
              />
            </label>
            <span className="cap-help">.txt, .srt or .vtt — subtitle files become plain text</span>
          </div>
        </section>
        <div className={`cap-drop${dragging ? ' is-dragging' : ''}`} aria-hidden="true">
          <IconUpload className="cap-ico-lg" />
          <span>Drop a file anywhere on this page</span>
        </div>
        <div className="cap-note cap-note--plain">
          <IconInfo className="cap-ico" />
          <div>
            On any web page, right-click and choose <strong>Open this page in the Captionary reader</strong>. The article comes here without
            the site’s menus and ads.
          </div>
        </div>
      </AppShell>
    );
  }

  const done = Object.keys(translations).length;
  const busy = translating && !translating.done;
  let source = doc.url;
  try {
    source = doc.url ? new URL(doc.url).hostname.replace(/^www\./, '') : undefined;
  } catch {
    // keep the raw URL
  }

  return (
    <AppShell current="reader">
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="cap-pagehead" style={{ alignItems: 'center' }}>
          <div className="cap-pagehead__text">
            <h1 className="cap-reader__title" lang={doc.lang}>
              {doc.title}
            </h1>
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                {source} · opened from the page
              </a>
            ) : (
              <span className="cap-help">{languageName(doc.lang)}</span>
            )}
          </div>
          <LanguageSelect variant="button" label="Language of the text" value={doc.lang} onChange={(v) => setDoc({ ...doc, lang: v })} />
          <button className="cap-btn" disabled={sameLang(doc.lang, native) || !!busy} onClick={() => void translateAll()}>
            {busy ? (
              <>
                <span className="cap-spinner" />
                Translating {done} of {sentences.length}
              </>
            ) : (
              `Translate to ${languageName(native)}`
            )}
          </button>
          <button className="cap-btn cap-btn--ghost" onClick={() => setDoc(null)}>
            New text
          </button>
        </div>
        {translating?.error && <Note tone="danger">The translation failed: {translating.error}</Note>}
        <div className="cap-reader-wrap" ref={wrapRef}>
          <div className="cap-reader">
            {paragraphs.map((p, pi) => (
              <p key={pi} style={{ margin: '0 0 18px' }}>
                {p.map((s) => (
                  <span key={s.i} className={`cap-sent${popup?.sentenceIndex === s.i ? ' is-active' : ''}`} lang={doc.lang}>
                    <TokenizedText
                      text={s.text}
                      lang={doc.lang}
                      index={index}
                      highlight={settings.subtitles.highlight}
                      freq={freq}
                      selected={popup?.sentenceIndex === s.i && popup.kind === 'word' ? popup.tokenRange : undefined}
                      onSelect={(sel) => openPopup('word', sel.text, s.i, sel.rect, sel.range)}
                    />{' '}
                    {romanized[s.i] && <span className="cap-sent__roman">{romanized[s.i]}</span>}
                    {translations[s.i] && (
                      <span className={`cap-sent__tr${settings.subtitles.blurTranslation ? ' is-blurred' : ''}`} lang={native}>
                        {translations[s.i]}
                      </span>
                    )}
                    <span className="cap-sent__tools">
                      <button
                        className="cap-iconbtn cap-iconbtn--sm"
                        aria-label="Listen to the sentence"
                        title="Listen"
                        onClick={() => void speak(s.text, doc.lang, settings.dictionary.speechRate)}
                      >
                        <IconSpeaker className="cap-ico" />
                      </button>
                      <button
                        className="cap-iconbtn cap-iconbtn--sm"
                        aria-label="Break down the sentence"
                        title="Break down"
                        onClick={(e) => {
                          const r = (e.currentTarget.closest('.cap-sent') as HTMLElement).getBoundingClientRect();
                          openPopup('sentence', s.text, s.i, { left: r.left, top: r.top, width: r.width, height: r.height });
                        }}
                      >
                        <IconSpark className="cap-ico" />
                      </button>
                    </span>
                  </span>
                ))}
              </p>
            ))}
          </div>
          {popup &&
            (() => {
              const place = placeLookup(popup.rect, wrapRef.current);
              return (
                <PaperLookup
                  key={`${popup.kind}:${popup.text}:${popup.sentence}`}
                  target={popup}
                  settings={settings}
                  aiStatus={aiStatus}
                  vocab={vocab}
                  style={place.style}
                  maxHeight={place.maxHeight}
                  growsUp={place.growsUp}
                  mediaTitle={doc.title}
                  rankKnown={!!freq}
                  rank={popup.kind === 'word' && freq ? frequencyRank(freq, normalizeWord(popup.text, popup.lang)) : undefined}
                  onClose={() => setPopup(null)}
                  onSave={(status, entry) => {
                    if (!status) return void removeVocab(vocabKey(entry.text, popup.lang).id);
                    void saveVocab({
                      lang: popup.lang,
                      ...entry,
                      status,
                      context: { sentence: popup.sentence, translation: popup.translation, title: doc.title, url: doc.url, site: 'reader' },
                    });
                  }}
                  onSelectWord={(sel) =>
                    setPopup({ ...popup, kind: 'word', text: sel.text, rect: sel.rect, tokenRange: sel.range, base: sel.base })
                  }
                />
              );
            })()}
        </div>
      </div>
    </AppShell>
  );
}

export function ReaderApp() {
  const [mode, setMode] = useState<ReaderMode>(() => (location.hash === '#video' ? 'video' : 'text'));
  useEffect(() => {
    document.title = mode === 'video' ? 'Local video · Captionary' : 'Reader · Captionary';
  }, [mode]);
  return mode === 'text' ? <TextMode onMode={setMode} /> : <VideoMode onMode={setMode} />;
}
