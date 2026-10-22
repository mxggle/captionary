import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, languageName } from '@/lib/languages';
import type { SidePanelPayload } from '@/lib/messaging';
import { sidePanelPayload } from '@/lib/session-items';
import { selectionKind } from '@/lib/text/selection-kind';
import { detectLanguage } from '@/lib/translate';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { AppShell } from '@/ui/AppShell';
import { Note, PageHead, Select, type SelectOption } from '@/ui/controls';
import { useSettings } from '@/ui/form';
import { BrandMark, IconChevronLeft, IconSettings, IconSpark } from '@/ui/icons';
import { isComposing, PaperLookup } from '@/ui/PaperLookup';
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
  const { m, locale } = useI18n(settings);
  const aiStatus = useAIStatus();
  const vocab = useVocabMap();
  const [payload, setPayload] = useState<SidePanelPayload | null>(null);
  /** The cards the learner came from (a sentence, then a word picked in it), for the way back. */
  const [trail, setTrail] = useState<SidePanelPayload[]>([]);
  /** The card was opened from the one before it, so it takes focus from the control that went away. */
  const [stepped, setStepped] = useState(false);
  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [draft, setDraft] = useState('');
  /** The language picked for typed text; 'auto' detects it again for each text. */
  const [pick, setPick] = useState('auto');

  // A selection from a page, or typed text, starts afresh.
  const open = (next: SidePanelPayload | null) => {
    setTrail([]);
    setStepped(false);
    setPayload(next);
  };
  useEffect(() => {
    void sidePanelPayload.getValue().then(open);
    return sidePanelPayload.watch(open);
    // `open` only calls state setters.
  }, []);

  useEffect(() => {
    if (!payload || !settings) return;
    let alive = true;
    void (async () => {
      const fallback = settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
      const detected = payload.lang ?? (await detectLanguage(payload.sentence ?? payload.text)) ?? fallback;
      if (!alive) return;
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

  const languages = useMemo<SelectOption<string>[]>(
    () => [
      { value: 'auto', label: m.sidepanel.autoDetect },
      ...LANGUAGES.map((l) => {
        const name = languageName(l.code, locale);
        return { value: l.code, label: name, text: name === l.native ? name : `${name} — ${l.native}` };
      }),
    ],
    [m, locale],
  );

  if (!settings) return null;

  const explain = async () => {
    const text = draft.trim();
    if (!text) return;
    const fallback = settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
    const lang = pick !== 'auto' ? pick : ((await detectLanguage(text)) ?? fallback);
    // Word or sentence is decided once the language is known: Chinese and Japanese have no spaces to count.
    open({ kind: selectionKind(text, lang), text, lang });
  };
  const back = trail[trail.length - 1];
  const goBack = () => {
    setTrail((t) => t.slice(0, -1));
    setStepped(true);
    setPayload(back);
  };
  const host = hostOf(payload?.url);
  const tutorMissing = !!aiStatus && !(aiStatus.enabled && aiStatus.configured);

  return (
    <>
      {tutorMissing && (
        <Note>
          {aiStatus.enabled ? m.lookup.addTutorPrompt : m.lookup.tutorOff}{' '}
          <a href={aiStatus.enabled ? '/welcome.html#tutor' : '/options.html#ai'} target="_blank" rel="noopener noreferrer">
            {aiStatus.enabled ? m.lookup.setUpTutor : m.lookup.openAISettings}
          </a>
        </Note>
      )}
      <div className="cap-card cap-sidepanel__ask">
        <label className="cap-sr" htmlFor="tutor-text">
          {m.sidepanel.wordOrSentenceAria}
        </label>
        <textarea
          id="tutor-text"
          className="cap-input cap-sidepanel__input"
          placeholder={m.sidepanel.inputPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || isComposing(e)) return;
            e.preventDefault();
            void explain();
          }}
        />
        <div className="cap-row">
          <label className="cap-sidepanel__label" htmlFor="tutor-lang">
            {m.sidepanel.languageOfText}
          </label>
          <Select id="tutor-lang" variant="button" className="cap-btn--sm" value={pick} options={languages} onChange={setPick} />
          <button
            className="cap-btn cap-btn--primary cap-btn--sm cap-sidepanel__explain"
            disabled={!draft.trim()}
            onClick={() => void explain()}
          >
            <IconSpark className="cap-ico" />
            {m.common.explain}
          </button>
        </div>
      </div>
      {target ? (
        <>
          {back && (
            <button className="cap-link cap-sidepanel__back" onClick={goBack}>
              <IconChevronLeft className="cap-ico" />
              <span className="cap-ellipsis">{m.sidepanel.backTo(back.text)}</span>
            </button>
          )}
          <div className="cap-sidepanel__source">
            {payload?.url ? (
              <>
                {m.sidepanel.fromSource}
                <a href={payload.url} target="_blank" rel="noopener noreferrer">
                  {host ?? payload.title}
                </a>{' '}
                ·{' '}
              </>
            ) : null}
            {payload?.url ? (target.kind === 'word' ? m.sidepanel.selectedText : m.sidepanel.selectedSentence) : m.sidepanel.typedHere} ·{' '}
            {languageName(target.lang, locale)}
          </div>
          <PaperLookup
            key={`${target.kind}:${target.text}:${target.lang}`}
            docked
            autoFocus={stepped}
            autoExplain
            target={target}
            settings={settings}
            aiStatus={aiStatus}
            vocab={vocab}
            onSave={(status, entry) => {
              if (!status) return removeVocab(vocabKey(entry.text, target.lang).id);
              return saveVocab({
                lang: target.lang,
                ...entry,
                status,
                context: { sentence: target.sentence, title: payload?.title, url: payload?.url, site: 'web' },
              });
            }}
            onSelectWord={(sel) => {
              if (payload) setTrail((t) => [...t, payload]);
              setStepped(true);
              setPayload({
                kind: 'word',
                text: sel.text,
                base: sel.base,
                sentence: target.sentence,
                lang: target.lang,
                url: payload?.url,
                title: payload?.title,
              });
            }}
          />
        </>
      ) : (
        <p className="cap-help cap-sidepanel__empty">
          {m.sidepanel.emptyTipBefore}
          <strong>{m.sidepanel.emptyTipStrong}</strong>
          {m.sidepanel.emptyTipAfter}
        </p>
      )}
    </>
  );
}

export function SidePanelApp() {
  const [settings] = useSettings();
  const { m } = useI18n(settings);
  // Opened as a tab from the navigation: the same tutor inside the page shell.
  if (location.hash === '#page') {
    document.title = `${m.sidepanel.pageTitle} · Captionary`;
    return (
      <AppShell current="tutor" narrow>
        <PageHead title={m.sidepanel.pageTitle} lead={m.sidepanel.pageLead} />
        <Tutor />
      </AppShell>
    );
  }
  return (
    <div className="cap-sidepanel">
      <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
        <BrandMark />
        <h1 className="cap-spacer cap-sidepanel__title">{m.sidepanel.pageTitle}</h1>
        <a
          className="cap-iconbtn cap-iconbtn--sm"
          href="/options.html#ai"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={m.common.settings}
          title={m.common.settings}
        >
          <IconSettings className="cap-ico" />
        </a>
      </div>
      <Tutor />
    </div>
  );
}
