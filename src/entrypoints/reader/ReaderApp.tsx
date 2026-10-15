import { storage } from '#imports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { languageName, normalizeLang, sameLang } from '@/lib/languages';
import { bg } from '@/lib/messaging';
import { readerImport } from '@/lib/session-items';
import { parseSubtitleFile, toPlainText } from '@/lib/subtitles/parse';
import { buildRankMap } from '@/lib/text/frequency-map';
import { canRomanize } from '@/lib/text/romanize';
import { splitSentences } from '@/lib/text/tokenize';
import { chromeTranslatorState, detectLanguage, translateLines } from '@/lib/translate';
import { speak } from '@/lib/tts';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { LanguageSelect, useSettings } from '@/ui/form';
import { IconSparkles, IconSpeaker } from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useAIStatus, useVocabMap } from '@/ui/useVocab';
import { useVocabIndex } from '@/ui/vocab-index';
import { WordPopup } from '@/ui/WordPopup';
import { VideoMode } from './VideoMode';

interface ReaderDoc {
  title: string;
  url?: string;
  text: string;
  lang: string;
}

const lastDoc = storage.defineItem<ReaderDoc | null>('local:readerLastDoc', { fallback: null });

function TextMode() {
  const [settings] = useSettings();
  const aiStatus = useAIStatus();
  const vocab = useVocabMap();
  const [doc, setDoc] = useState<ReaderDoc | null>(null);
  const [draft, setDraft] = useState('');
  const [popup, setPopup] = useState<PopupTarget | null>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [romanized, setRomanized] = useState<string[]>([]);
  const [freq, setFreq] = useState<Map<string, number> | null>(null);

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

  if (!settings) return null;
  const native = settings.nativeLanguage;

  const load = async (text: string, title = 'Pasted text', url?: string) => {
    const detected = await detectLanguage(text);
    const fallback = settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
    setDoc({ title, url, text, lang: detected ? normalizeLang(detected) : fallback });
  };

  const translateAll = async () => {
    if (!doc) return;
    const chrome = await chromeTranslatorState(doc.lang, native);
    const engine = chrome === 'available' || chrome === 'downloadable' ? 'chrome' : 'ai';
    setTranslating(`Translating with ${engine === 'chrome' ? 'on-device translation' : 'AI'}…`);
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
      setTranslating(null);
    } catch (err) {
      setTranslating(`Translation failed: ${(err as Error).message}`);
    }
  };

  const openPopup = (kind: 'word' | 'sentence', text: string, sentenceIndex: number, rect: PopupTarget['rect']) => {
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
    });
  };

  if (!doc) {
    return (
      <div className="lr-card">
        <div className="lr-card-head">
          <div className="title">Read any text</div>
        </div>
        <textarea
          className="lr-input"
          style={{ minHeight: 220, fontFamily: 'inherit', fontSize: 15 }}
          placeholder="Paste an article, song lyrics, a dialogue… Every word becomes clickable."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="lr-row" style={{ marginTop: 10 }}>
          <button className="lr-btn primary" disabled={!draft.trim()} onClick={() => void load(draft)}>
            Read
          </button>
          <label className="lr-btn">
            Open a file (.txt, .srt, .vtt)
            <input
              type="file"
              accept=".txt,.md,.srt,.vtt,text/plain"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const raw = await file.text();
                const text = /\.(srt|vtt)$/i.test(file.name) ? toPlainText(parseSubtitleFile(file.name, raw)) : raw;
                await load(text, file.name);
              }}
            />
          </label>
          <span className="lr-status">Tip: right-click any web page → “Open this page in the Captionary reader”.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lr-row" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.title}
          </div>
          {doc.url && (
            <a className="lr-link" href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
              {doc.url}
            </a>
          )}
        </div>
        <LanguageSelect value={doc.lang} onChange={(v) => setDoc({ ...doc, lang: v })} />
        <button
          className="lr-btn"
          disabled={sameLang(doc.lang, native) || !!translating?.endsWith('…')}
          onClick={() => void translateAll()}
        >
          Translate all → {languageName(native)}
        </button>
        <button className="lr-btn" onClick={() => setDoc(null)}>
          New text
        </button>
      </div>
      {translating && <div className="lr-note">{translating}</div>}
      <div className="lr-reader-text">
        {paragraphs.map((p, pi) => (
          <p key={pi} style={{ margin: '0 0 18px' }}>
            {p.map((s) => (
              <span key={s.i} className="lr-sentence">
                <TokenizedText
                  text={s.text}
                  lang={doc.lang}
                  index={index}
                  highlight={settings.subtitles.highlight}
                  freq={freq}
                  onSelect={(sel) => openPopup('word', sel.text, s.i, sel.rect)}
                />
                {romanized[s.i] && <span className="roman">{romanized[s.i]}</span>}
                {translations[s.i] && <span className="tr">{translations[s.i]}</span>}
                <span className="tools">
                  <button
                    className="lr-icon-btn"
                    title="Listen"
                    onClick={() => void speak(s.text, doc.lang, settings.dictionary.speechRate)}
                  >
                    <IconSpeaker />
                  </button>
                  <button
                    className="lr-icon-btn"
                    title="Explain sentence"
                    onClick={(e) => {
                      const r = (e.currentTarget.closest('.lr-sentence') as HTMLElement).getBoundingClientRect();
                      openPopup('sentence', s.text, s.i, { left: r.left, top: r.top, width: r.width, height: r.height });
                    }}
                  >
                    <IconSparkles />
                  </button>
                </span>
              </span>
            ))}
          </p>
        ))}
      </div>
      {popup && (
        <WordPopup
          key={`${popup.kind}:${popup.text}:${popup.sentence}`}
          target={popup}
          settings={settings}
          aiStatus={aiStatus}
          vocab={vocab}
          bounds={{ left: 0, top: 0, width: innerWidth, height: innerHeight }}
          fixed
          mediaTitle={doc.title}
          onClose={() => setPopup(null)}
          onSave={(status, extra) => {
            if (!status) return void removeVocab(vocabKey(popup.text, popup.lang).id);
            void saveVocab({
              lang: popup.lang,
              text: popup.text,
              status,
              ...extra,
              context: { sentence: popup.sentence, translation: popup.translation, title: doc.title, url: doc.url, site: 'reader' },
            });
          }}
          onSelectWord={(sel) => setPopup({ ...popup, kind: 'word', text: sel.text, rect: sel.rect })}
        />
      )}
    </>
  );
}

export function ReaderApp() {
  const [mode, setMode] = useState<'text' | 'video'>(() => (location.hash === '#video' ? 'video' : 'text'));
  const top = useRef<HTMLDivElement>(null);
  return (
    <div className="lr-reader" ref={top} style={mode === 'video' ? { maxWidth: 1400 } : undefined}>
      <div className="lr-row" style={{ marginBottom: 18 }}>
        <div className="lr-brand" style={{ fontSize: 16 }}>
          <span className="dot" /> Captionary Reader
        </div>
        <span className="lr-spacer" />
        <div className="lr-tabs">
          <button className={`lr-tab${mode === 'text' ? ' active' : ''}`} onClick={() => setMode('text')}>
            Text
          </button>
          <button className={`lr-tab${mode === 'video' ? ' active' : ''}`} onClick={() => setMode('video')}>
            Video file
          </button>
        </div>
        <a className="lr-btn" href="/vocab.html">
          Saved words
        </a>
        <a className="lr-btn" href="/options.html">
          Settings
        </a>
      </div>
      {mode === 'text' ? <TextMode /> : <VideoMode />}
    </div>
  );
}
