import { browser } from '#imports';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, languageAutonym, languageName, sameLang } from '@/lib/languages';
import { SETUP_STEPS, setupProgress, type SetupStep } from '@/lib/onboarding';
import type { Settings } from '@/lib/settings';
import { keyLabel, Note, Select, type SelectOption } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { BrandMark, IconExternal, IconGlyph, IconPin, IconPuzzle } from '@/ui/icons';
import { Choice, Foot, shortLanguageName, Step, usePinned, useTutorStatus, type StepProps } from './parts';
import { TryStep } from './TryStep';
import { TutorStep } from './TutorStep';

/** The numbered steps; the welcome and the summary sit outside the count. */
const NUMBERED_STEPS = ['language', 'level', 'pin', 'tutor', 'try'] as const;

function stepFromHash(): SetupStep | null {
  const h = location.hash.replace(/^#/, '');
  return (SETUP_STEPS as readonly string[]).includes(h) ? (h as SetupStep) : null;
}

/** The setup guide: one question per screen, in plain words, with every answer saved as it is given. */
export function WelcomeApp() {
  const [s, update] = useSettings();
  const { m } = useI18n(s);
  const [step, setStep] = useState<SetupStep | null>(stepFromHash);

  const numbered = NUMBERED_STEPS.map((st) => ({ step: st, label: m.welcome.steps[st] }));

  useEffect(() => {
    // Opened without a step (from install or the pop-up): resume where the guide was left.
    if (!stepFromHash()) {
      void setupProgress.getValue().then((p) => {
        const resume = p.done ? 'hello' : p.step;
        history.replaceState(null, '', `#${resume}`);
        setStep(resume);
      });
    }
    // Steps live in the address, so the browser's Back button goes back a step too.
    const onHash = () => {
      const next = stepFromHash();
      if (next) setStep(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!step) return;
    window.scrollTo(0, 0);
    const n = NUMBERED_STEPS.indexOf(step as (typeof NUMBERED_STEPS)[number]);
    document.title =
      n >= 0 ? m.welcome.stepTitle(n + 1, NUMBERED_STEPS.length, m.welcome.steps[NUMBERED_STEPS[n]]) : m.welcome.setUpCaptionary;
    // Remember the step; reaching the summary (or skipping to it) finishes the guide.
    void setupProgress.getValue().then((p) => setupProgress.setValue({ done: p.done || step === 'done', step }));
  }, [step, m]);

  if (!s || !step) return null;
  const go = (next: SetupStep) => {
    location.hash = next;
  };
  const props: StepProps = { s, set: (fn) => void update(fn), go };
  const index = numbered.findIndex((x) => x.step === step);

  return (
    <div className="cap-wizard">
      <header className="cap-wizard__bar">
        <span className="cap-wizard__brand">
          <BrandMark />
          Captionary
        </span>
        {index >= 0 && (
          <div className="cap-wizard__progress">
            <span className="cap-wizard__count">{m.welcome.stepCount(index + 1, numbered.length)}</span>
            <ol className="cap-wizard__track" aria-label={m.welcome.setupStepsAria}>
              {numbered.map((x, i) => (
                <li
                  key={x.step}
                  className={i < index ? 'is-done' : i === index ? 'is-current' : undefined}
                  aria-current={i === index ? 'step' : undefined}
                >
                  <span className="cap-wizard__track-bar" />
                  <span className="cap-wizard__track-label">
                    {x.label}
                    {i < index && <span className="cap-sr">{m.welcome.doneSr}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {step !== 'done' && (
          <button className="cap-btn cap-btn--ghost cap-btn--sm cap-wizard__skip" onClick={() => go('done')}>
            {m.welcome.skipSetup}
          </button>
        )}
      </header>
      {step === 'hello' && <HelloStep {...props} />}
      {step === 'language' && <LanguageStep {...props} />}
      {step === 'level' && <LevelStep {...props} />}
      {step === 'pin' && <PinStep {...props} />}
      {step === 'tutor' && <TutorStep {...props} />}
      {step === 'try' && <TryStep {...props} />}
      {step === 'done' && <DoneStep {...props} />}
    </div>
  );
}

/* ---------- welcome ---------- */

function HelloStep({ s, go }: StepProps) {
  const { m } = useI18n(s);
  return (
    <Step
      title={
        <>
          {m.welcome.hello.titleBefore}
          <mark className="cap-mark">{m.welcome.hello.titleMark}</mark>
          {m.welcome.hello.titleAfter}
        </>
      }
      lead={m.welcome.hello.lead}
      foot={<Foot onNext={() => go('language')} nextLabel={m.welcome.hello.setItUp} note={m.welcome.hello.note} />}
    >
      <div className="cap-wizard__frame" aria-hidden="true">
        <div className="cap-captions">
          <div className="cap-cap" lang="es">
            ¿Quieres tomar un{' '}
            <span className="cap-wizard__word">
              <span className="cap-w is-learn is-selected">café</span>
              <span className="cap-wizard__bubble">
                <b>café</b> {m.welcome.hello.sampleWordTr}
              </span>
            </span>{' '}
            antes de la película?
          </div>
          <div className="cap-cap cap-cap--tr">{m.welcome.hello.sampleSentenceTr}</div>
        </div>
      </div>
      <ul className="cap-wizard__points">
        <li>
          <strong>{m.welcome.hello.point1Title}</strong>
          <span>{m.welcome.hello.point1Sub}</span>
        </li>
        <li>
          <strong>{m.welcome.hello.point2Title}</strong>
          <span>{m.welcome.hello.point2Sub}</span>
        </li>
        <li>
          <strong>{m.welcome.hello.point3Title}</strong>
          <span>{m.welcome.hello.point3Sub}</span>
        </li>
      </ul>
    </Step>
  );
}

/* ---------- language ---------- */

/** Offered as tiles; every other language is in the list below them. */
const POPULAR = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh-CN', 'ru', 'ar', 'hi'];

function LanguageStep({ s, set, go }: StepProps) {
  const { m, locale } = useI18n(s);
  const tiles = POPULAR.filter((code) => !sameLang(code, s.nativeLanguage));
  const other = s.targetLanguage !== 'auto' && !tiles.includes(s.targetLanguage) ? s.targetLanguage : '';
  const same = s.targetLanguage !== 'auto' && sameLang(s.targetLanguage, s.nativeLanguage);
  const pick = (code: string) => set((st) => void (st.targetLanguage = code));
  const otherOptions: SelectOption<string>[] = [
    { value: '', label: m.welcome.language.anotherLanguage },
    ...LANGUAGES.map((l) => {
      const label = languageName(l.code, locale);
      return { value: l.code, label, text: `${label} — ${l.native}` };
    }),
  ];
  return (
    <Step
      title={m.welcome.language.title}
      lead={m.welcome.language.lead}
      foot={<Foot onBack={() => go('hello')} onNext={() => go('level')} disabled={same} />}
    >
      <fieldset className="cap-wizard__choices cap-wizard__choices--grid">
        <legend className="cap-sr">{m.welcome.language.legendSr}</legend>
        {tiles.map((code) => (
          <Choice
            key={code}
            name="target"
            checked={s.targetLanguage === code}
            onSelect={() => pick(code)}
            title={shortLanguageName(code, locale)}
            sub={languageAutonym(code)}
            subLang={code}
          />
        ))}
        <Choice
          name="target"
          wide
          checked={s.targetLanguage === 'auto'}
          onSelect={() => pick('auto')}
          title={m.welcome.language.dependsOnVideoTitle}
          sub={m.welcome.language.dependsOnVideoSub}
        />
      </fieldset>
      <div className="cap-row cap-wizard__other">
        <span className="cap-muted">{m.welcome.language.notInList}</span>
        <Select
          variant="button"
          label={m.welcome.language.anotherLanguageAria}
          className={other ? 'is-chosen' : undefined}
          value={other}
          options={otherOptions}
          onChange={(v) => v && pick(v)}
        />
      </div>

      <section className="cap-wizard__section" aria-labelledby="native-title">
        <h2 className="cap-h2" id="native-title">
          {m.welcome.language.yourOwnLanguage}
        </h2>
        <p className="cap-wizard__sentence">
          {m.welcome.language.translationsInBefore}
          <LanguageSelect
            variant="sentence"
            label={m.welcome.language.yourOwnLanguage}
            value={s.nativeLanguage}
            onChange={(v) => set((st) => void (st.nativeLanguage = v))}
          />
          {m.welcome.language.translationsInAfter}
        </p>
        {same && <Note tone="warn">{m.welcome.language.sameLangWarn(shortLanguageName(s.nativeLanguage, locale))}</Note>}
      </section>
    </Step>
  );
}

/* ---------- level ---------- */

const LEVEL_CODES: Settings['learnerLevel'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function LevelStep({ s, set, go }: StepProps) {
  const { m, locale } = useI18n(s);
  const name = s.targetLanguage === 'auto' ? m.welcome.level.theLanguage : shortLanguageName(s.targetLanguage, locale);
  return (
    <Step
      title={m.welcome.level.title(name)}
      lead={m.welcome.level.lead}
      foot={<Foot onBack={() => go('language')} onNext={() => go('pin')} />}
    >
      <fieldset className="cap-wizard__choices">
        <legend className="cap-sr">{m.welcome.level.legendSr}</legend>
        {LEVEL_CODES.map((code) => {
          const lv = m.welcome.level.levels[code];
          return (
            <Choice
              key={code}
              name="level"
              checked={s.learnerLevel === code}
              onSelect={() => set((st) => void (st.learnerLevel = code))}
              title={lv.title}
              sub={lv.sub}
              meta={<span title={m.welcome.level.cefrTitle}>{code}</span>}
            />
          );
        })}
      </fieldset>
    </Step>
  );
}

/* ---------- pin ---------- */

function PinStep({ s, go }: StepProps) {
  const { m } = useI18n(s);
  const pinned = usePinned();
  return (
    <Step
      title={m.welcome.pin.title}
      lead={m.welcome.pin.lead}
      foot={
        <Foot
          onBack={() => go('level')}
          onNext={() => go('tutor')}
          nextLabel={pinned === false ? m.welcome.pin.skipThisStep : m.common.continue}
          quiet={pinned === false}
        />
      }
    >
      <div className="cap-wizard__browser" aria-hidden="true">
        <div className="cap-wizard__toolbar">
          <span className="cap-wizard__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="cap-wizard__address">youtube.com</span>
          {pinned && (
            <span className="cap-wizard__tb is-pinned">
              <BrandMark />
            </span>
          )}
          <span className={`cap-wizard__tb${pinned ? '' : ' is-target'}`}>
            <IconPuzzle className="cap-ico" />
            {!pinned && <b className="cap-wizard__badge">1</b>}
          </span>
          <span className="cap-wizard__avatar" />
        </div>
        <div className="cap-wizard__menu">
          <div className="cap-wizard__menu-title">{m.welcome.pin.extensionsMenuTitle}</div>
          <div className="cap-wizard__menu-row">
            <BrandMark />
            <span className="cap-spacer">Captionary</span>
            <span className={`cap-wizard__tb cap-wizard__tb--sm${pinned ? ' is-on' : ' is-target'}`}>
              <IconPin className="cap-ico" />
              {!pinned && <b className="cap-wizard__badge">2</b>}
            </span>
          </div>
        </div>
      </div>
      <ol className="cap-wizard__howto">
        <li>
          <span className="cap-wizard__n">1</span>
          <span>
            {m.welcome.pin.step1Before}
            <strong>{m.welcome.pin.step1Puzzle}</strong> <IconPuzzle className="cap-ico" aria-label={m.welcome.pin.step1PuzzleAria} />
            {m.welcome.pin.step1After}
          </span>
        </li>
        <li>
          <span className="cap-wizard__n">2</span>
          <span>
            {m.welcome.pin.step2Before}
            <strong>Captionary</strong>
            {m.welcome.pin.step2Mid}
            <strong>{m.welcome.pin.step2Pin}</strong> <IconPin className="cap-ico" aria-label={m.welcome.pin.step2PinAria} />
            {m.welcome.pin.step2After}
          </span>
        </li>
      </ol>
      <div aria-live="polite">
        {pinned === true && <Note tone="success">{m.welcome.pin.pinnedSuccess}</Note>}
        {pinned === false && (
          <p className="cap-wizard__waiting">
            <span className="cap-spinner" />
            {m.welcome.pin.waitingToPin}
          </p>
        )}
      </div>
    </Step>
  );
}

/* ---------- summary ---------- */

/** A YouTube search for easy videos in the learner's language. */
function youtubeUrl(target: string): string {
  if (target === 'auto') return 'https://www.youtube.com/';
  const q = `easy ${shortLanguageName(target)} street interviews`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function closeGuide() {
  void browser.tabs.getCurrent().then((t) => (t?.id !== undefined ? browser.tabs.remove(t.id) : window.close()));
}

function DoneStep({ s, go }: StepProps) {
  const { m, locale } = useI18n(s);
  const [tutor] = useTutorStatus();
  const pinned = usePinned();
  const learning = s.targetLanguage === 'auto' ? m.welcome.done.languageOfEachVideo : shortLanguageName(s.targetLanguage, locale);
  const keys = s.shortcuts;
  const key = (k: string) => k && <span className="cap-kbd">{keyLabel(k, m.common.space)}</span>;
  const summary: { label: string; value: string; step: SetupStep; action?: string }[] = [
    {
      label: m.welcome.done.summaryLearning,
      value: `${learning} · ${m.welcome.level.levels[s.learnerLevel]?.title ?? s.learnerLevel}`,
      step: 'language',
    },
    { label: m.welcome.done.summaryTranslations, value: m.welcome.done.inLang(languageName(s.nativeLanguage, locale)), step: 'language' },
    ...(pinned === null
      ? []
      : [
          {
            label: m.welcome.done.summaryToolbar,
            value: pinned ? m.welcome.done.pinned : m.welcome.done.notPinnedYet,
            step: 'pin' as const,
            action: pinned ? undefined : m.welcome.done.pinIt,
          },
        ]),
    {
      label: m.welcome.done.summaryTutor,
      value: tutor?.configured ? `${tutor.providerName}` : m.welcome.done.tutorNotSetUp,
      step: 'tutor',
      action: tutor?.configured ? undefined : m.welcome.done.setUp,
    },
  ];
  return (
    <Step
      title={m.welcome.done.title}
      lead={m.welcome.done.lead}
      foot={
        <Foot
          onBack={() => go('try')}
          onNext={closeGuide}
          nextLabel={m.common.done}
          extra={
            <a className="cap-btn cap-btn--lg cap-btn--ghost" href="/options.html#general">
              {m.welcome.done.allSettings}
            </a>
          }
        />
      }
    >
      <dl className="cap-wizard__summary">
        {summary.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <dd className="cap-wizard__change">
              <button
                className="cap-btn cap-btn--ghost cap-btn--sm"
                onClick={() => go(row.step)}
                aria-label={`${row.action ?? m.welcome.done.change}: ${row.label}`}
              >
                {row.action ?? m.welcome.done.change}
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <section className="cap-wizard__section" aria-labelledby="watch-title">
        <h2 className="cap-h2" id="watch-title">
          {m.welcome.done.startWatching}
        </h2>
        <div className="cap-wizard__sites">
          <a className="cap-wizard__site" href={youtubeUrl(s.targetLanguage)} target="_blank" rel="noopener noreferrer">
            <strong>
              YouTube <IconExternal className="cap-ico" />
            </strong>
            <span>
              {s.targetLanguage === 'auto'
                ? m.welcome.done.anyVideoWithSubtitles
                : m.welcome.done.easyVideos(shortLanguageName(s.targetLanguage, locale))}
            </span>
          </a>
          <a className="cap-wizard__site" href="https://www.netflix.com/browse" target="_blank" rel="noopener noreferrer">
            <strong>
              Netflix <IconExternal className="cap-ico" />
            </strong>
            <span>{m.welcome.done.filmsAndSeries}</span>
          </a>
          <a className="cap-wizard__site" href="https://tv.apple.com/" target="_blank" rel="noopener noreferrer">
            <strong>
              Apple TV+ <IconExternal className="cap-ico" />
            </strong>
            <span>{m.welcome.done.filmsAndSeries}</span>
          </a>
        </div>
        <p className="cap-wizard__text">
          {m.welcome.done.playerButtonTextBefore}
          <IconGlyph className="cap-ico cap-wizard__glyph" aria-label="Captionary" />
          {m.welcome.done.playerButtonTextAfter}
        </p>
        <Note tone="plain">{m.welcome.done.reloadOpenVideoNote}</Note>
      </section>

      <section className="cap-wizard__section" aria-labelledby="keys-title">
        <h2 className="cap-h2" id="keys-title">
          {m.welcome.done.handyKeys}
        </h2>
        <ul className="cap-wizard__keys">
          <li>
            <span className="cap-row" style={{ gap: 4 }}>
              {key(keys.prevLine)}
              {key(keys.repeatLine)}
              {key(keys.nextLine)}
            </span>
            {m.welcome.done.prevRepeatNext}
          </li>
          <li>
            {key(keys.toggleAutoPause)}
            {m.welcome.done.pauseEveryLine}
          </li>
          <li>
            {key(keys.toggleTranslation)}
            {m.welcome.done.showHideTranslation}
          </li>
          {tutor?.configured && (
            <li>
              {key(keys.explainLine)}
              {m.welcome.done.askTutorLine}
            </li>
          )}
        </ul>
      </section>
    </Step>
  );
}
