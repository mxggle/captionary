import { useEffect, useState } from 'react';
import { languageName } from '@/lib/languages';
import type { SidePanelPayload } from '@/lib/messaging';
import { sidePanelPayload } from '@/lib/session-items';
import { detectLanguage } from '@/lib/translate';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { AppShell } from '@/ui/AppShell';
import { PageHead } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { BrandMark, IconSettings, IconSpark } from '@/ui/icons';
import { PaperLookup } from '@/ui/PaperLookup';
import { useAIStatus, useVocabMap } from '@/ui/useVocab';

const NO_RECT = { left: 0, top: 0, width: 0, height: 0 };

function hostOf(url: string | undefined): string | undefined {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : undefined;
  } catch {
    return undefined;
  }
}

/** The AI tutor: explains selections from any page and answers follow-ups. */
function Tutor() {
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
        base: payload.base,
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
  const host = hostOf(payload?.url);

  return (
    <>
      <div className="cap-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="cap-sr" htmlFor="tutor-text">
          Word or sentence to explain
        </label>
        <textarea
          id="tutor-text"
          className="cap-input"
          style={{ minHeight: 70, fontFamily: 'var(--font-sans)', fontSize: 14 }}
          placeholder="Type or paste a word or sentence…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              explain();
            }
          }}
        />
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <LanguageSelect
            variant="button"
            className="cap-btn--sm"
            label="Language of the text"
            value={lang || (settings.targetLanguage === 'auto' ? 'en' : settings.targetLanguage)}
            onChange={setLang}
          />
          <span className="cap-spacer" />
          <button className="cap-btn cap-btn--primary cap-btn--sm" disabled={!draft.trim()} onClick={explain}>
            <IconSpark className="cap-ico" />
            Explain
          </button>
        </div>
      </div>
      {target ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink-subtle)' }}>
            {payload?.url ? (
              <>
                From{' '}
                <a href={payload.url} target="_blank" rel="noopener noreferrer">
                  {host ?? payload.title}
                </a>{' '}
                ·{' '}
              </>
            ) : null}
            {payload?.url ? (target.kind === 'word' ? 'selected text' : 'selected sentence') : 'typed here'} · {languageName(target.lang)}
          </div>
          <PaperLookup
            key={`${target.kind}:${target.text}:${target.lang}`}
            docked
            autoExplain
            target={target}
            settings={settings}
            aiStatus={aiStatus}
            vocab={vocab}
            onSave={(status, entry) => {
              if (!status) return void removeVocab(vocabKey(entry.text, target.lang).id);
              void saveVocab({
                lang: target.lang,
                ...entry,
                status,
                context: { sentence: target.sentence, title: payload?.title, url: payload?.url, site: 'web' },
              });
            }}
            onSelectWord={(sel) =>
              setPayload({
                kind: 'word',
                text: sel.text,
                base: sel.base,
                sentence: target.sentence,
                lang: target.lang,
                url: payload?.url,
                title: payload?.title,
              })
            }
          />
        </>
      ) : (
        <p className="cap-help" style={{ margin: 0 }}>
          Select text on any web page, right-click and choose <strong>Explain with Captionary</strong>, or choose Open in side panel in a
          look-up.
        </p>
      )}
    </>
  );
}

export function SidePanelApp() {
  // Opened as a tab from the navigation: the same tutor inside the page shell.
  if (location.hash === '#page') {
    document.title = 'AI tutor · Captionary';
    return (
      <AppShell current="tutor" narrow>
        <PageHead title="AI tutor" lead="Explain a word or a sentence from anywhere, then ask follow-up questions." />
        <Tutor />
      </AppShell>
    );
  }
  return (
    <div className="cap-sidepanel">
      <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
        <BrandMark />
        <h1 className="cap-spacer cap-sidepanel__title">AI tutor</h1>
        <a
          className="cap-iconbtn cap-iconbtn--sm"
          href="/options.html#ai"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Settings"
          title="Settings"
        >
          <IconSettings className="cap-ico" />
        </a>
      </div>
      <Tutor />
    </div>
  );
}
