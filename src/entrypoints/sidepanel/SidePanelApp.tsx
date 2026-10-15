import { useEffect, useState } from 'react';
import { languageName } from '@/lib/languages';
import type { SidePanelPayload } from '@/lib/messaging';
import { sidePanelPayload } from '@/lib/session-items';
import { detectLanguage } from '@/lib/translate';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { LanguageSelect, useSettings } from '@/ui/form';
import { IconSparkles } from '@/ui/icons';
import { useAIStatus, useVocabMap } from '@/ui/useVocab';
import { WordPopup } from '@/ui/WordPopup';

const NO_RECT = { left: 0, top: 0, width: 0, height: 0 };

/** AI tutor in Chrome's side panel: explains selections from any page and answers follow-ups. */
export function SidePanelApp() {
  const [settings] = useSettings();
  const aiStatus = useAIStatus();
  const vocab = useVocabMap();
  const [payload, setPayload] = useState<SidePanelPayload | null>(null);
  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [draft, setDraft] = useState('');
  const [lang, setLang] = useState<string>('');

  useEffect(() => {
    void sidePanelPayload.getValue().then(setPayload);
    return sidePanelPayload.watch(setPayload);
  }, []);

  useEffect(() => {
    if (!payload || !settings) return;
    let alive = true;
    void (async () => {
      const fallback = settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
      const detected = payload.lang ?? (await detectLanguage(payload.sentence ?? payload.text)) ?? fallback;
      if (!alive) return;
      setLang(detected);
      setTarget({
        kind: payload.kind,
        text: payload.text,
        lang: detected,
        cueIndex: -1,
        sentence: payload.sentence ?? payload.text,
        before: [],
        after: [],
        rect: NO_RECT,
        surface: 'reader',
      });
    })();
    return () => {
      alive = false;
    };
  }, [payload, settings]);

  if (!settings) return null;

  const explain = () => {
    const text = draft.trim();
    if (!text) return;
    const words = text.split(/\s+/).length;
    setPayload({ kind: words > 3 ? 'sentence' : 'word', text, lang: lang || undefined });
  };

  return (
    <div className="lr-panel">
      <div className="lr-brand">
        <span className="dot" /> AI tutor
      </div>
      <div className="lr-card" style={{ marginBottom: 0, padding: 12 }}>
        <textarea
          className="lr-input"
          style={{ minHeight: 70, fontFamily: 'inherit', fontSize: 14 }}
          placeholder="Type or paste a word or sentence… (or select text on any page → right-click → Explain with Captionary)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              explain();
            }
          }}
        />
        <div className="lr-row" style={{ marginTop: 8 }}>
          <LanguageSelect value={lang || (settings.targetLanguage === 'auto' ? 'en' : settings.targetLanguage)} onChange={setLang} />
          <span className="lr-spacer" />
          <button className="lr-btn primary" disabled={!draft.trim()} onClick={explain}>
            <IconSparkles /> Explain
          </button>
        </div>
      </div>
      {target ? (
        <>
          {payload?.title && (
            <div className="lr-status">
              From: {payload.title} · {languageName(target.lang)}
            </div>
          )}
          <WordPopup
            key={`${target.kind}:${target.text}:${target.lang}`}
            embedded
            target={target}
            settings={settings}
            aiStatus={aiStatus ? { ...aiStatus, autoExplain: true } : null}
            vocab={vocab}
            bounds={NO_RECT}
            onClose={() => setTarget(null)}
            onSave={(status, extra) => {
              if (!status) return void removeVocab(vocabKey(target.text, target.lang).id);
              void saveVocab({
                lang: target.lang,
                text: target.text,
                status,
                ...extra,
                context: { sentence: target.sentence, title: payload?.title, url: payload?.url, site: 'web' },
              });
            }}
            onSelectWord={(sel) =>
              setPayload({
                kind: 'word',
                text: sel.text,
                sentence: target.sentence,
                lang: target.lang,
                url: payload?.url,
                title: payload?.title,
              })
            }
          />
        </>
      ) : (
        <p className="lr-status">
          Select text on any web page, right-click and choose <b>Explain with Captionary</b>, or click “Open in side panel” in a word
          pop-up.
        </p>
      )}
    </div>
  );
}
