import { browser } from '#imports';
import { useEffect, useState } from 'react';
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
const NUMBERED: { step: SetupStep; label: string }[] = [
  { step: 'language', label: 'Language' },
  { step: 'level', label: 'Level' },
  { step: 'pin', label: 'Toolbar' },
  { step: 'tutor', label: 'AI tutor' },
  { step: 'try', label: 'Try it' },
];

function stepFromHash(): SetupStep | null {
  const h = location.hash.replace(/^#/, '');
  return (SETUP_STEPS as readonly string[]).includes(h) ? (h as SetupStep) : null;
}

/** The setup guide: one question per screen, in plain words, with every answer saved as it is given. */
export function WelcomeApp() {
  const [s, update] = useSettings();
  const [step, setStep] = useState<SetupStep | null>(stepFromHash);

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
    const n = NUMBERED.findIndex((x) => x.step === step);
    document.title = n >= 0 ? `Step ${n + 1} of ${NUMBERED.length}: ${NUMBERED[n].label} · Captionary` : 'Set up Captionary';
    // Remember the step; reaching the summary (or skipping to it) finishes the guide.
    void setupProgress.getValue().then((p) => setupProgress.setValue({ done: p.done || step === 'done', step }));
  }, [step]);

  if (!s || !step) return null;
  const go = (next: SetupStep) => {
    location.hash = next;
  };
  const props: StepProps = { s, set: (fn) => void update(fn), go };
  const index = NUMBERED.findIndex((x) => x.step === step);

  return (
    <div className="cap-wizard">
      <header className="cap-wizard__bar">
        <span className="cap-wizard__brand">
          <BrandMark />
          Captionary
        </span>
        {index >= 0 && (
          <div className="cap-wizard__progress">
            <span className="cap-wizard__count">
              Step {index + 1} of {NUMBERED.length}
            </span>
            <ol className="cap-wizard__track" aria-label="Setup steps">
              {NUMBERED.map((x, i) => (
                <li
                  key={x.step}
                  className={i < index ? 'is-done' : i === index ? 'is-current' : undefined}
                  aria-current={i === index ? 'step' : undefined}
                >
                  <span className="cap-wizard__track-bar" />
                  <span className="cap-wizard__track-label">
                    {x.label}
                    {i < index && <span className="cap-sr"> (done)</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {step !== 'done' && (
          <button className="cap-btn cap-btn--ghost cap-btn--sm cap-wizard__skip" onClick={() => go('done')}>
            Skip setup
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

function HelloStep({ go }: StepProps) {
  return (
    <Step
      title={
        <>
          Learn a language from the shows you <mark className="cap-mark">already watch</mark>
        </>
      }
      lead="Captionary puts a translation under the subtitles on YouTube, Netflix and Apple TV+. Click any word to see what it means."
      foot={<Foot onNext={() => go('language')} nextLabel="Set it up" note="About two minutes. You can change anything later." />}
    >
      <div className="cap-wizard__frame" aria-hidden="true">
        <div className="cap-captions">
          <div className="cap-cap" lang="es">
            ¿Quieres tomar un{' '}
            <span className="cap-wizard__word">
              <span className="cap-w is-learn is-selected">café</span>
              <span className="cap-wizard__bubble">
                <b>café</b> coffee
              </span>
            </span>{' '}
            antes de la película?
          </div>
          <div className="cap-cap cap-cap--tr">Do you want to get a coffee before the movie?</div>
        </div>
      </div>
      <ul className="cap-wizard__points">
        <li>
          <strong>Two subtitles at once</strong>
          <span>The original line, with your language underneath.</span>
        </li>
        <li>
          <strong>Click any word</strong>
          <span>See what it means, hear it, and save it.</span>
        </li>
        <li>
          <strong>Review what you saved</strong>
          <span>Flashcards made from the words you clicked.</span>
        </li>
      </ul>
    </Step>
  );
}

/* ---------- language ---------- */

/** Offered as tiles; every other language is in the list below them. */
const POPULAR = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh-CN', 'ru', 'ar', 'hi'];
const OTHER_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'Another language…' },
  ...LANGUAGES.map((l) => ({ value: l.code, label: l.name, text: `${l.name} — ${l.native}` })),
];

function LanguageStep({ s, set, go }: StepProps) {
  const tiles = POPULAR.filter((code) => !sameLang(code, s.nativeLanguage));
  const other = s.targetLanguage !== 'auto' && !tiles.includes(s.targetLanguage) ? s.targetLanguage : '';
  const same = s.targetLanguage !== 'auto' && sameLang(s.targetLanguage, s.nativeLanguage);
  const pick = (code: string) => set((st) => void (st.targetLanguage = code));
  return (
    <Step
      title="Which language are you learning?"
      lead="You can change it at any time."
      foot={<Foot onBack={() => go('hello')} onNext={() => go('level')} disabled={same} />}
    >
      <fieldset className="cap-wizard__choices cap-wizard__choices--grid">
        <legend className="cap-sr">The language you are learning</legend>
        {tiles.map((code) => (
          <Choice
            key={code}
            name="target"
            checked={s.targetLanguage === code}
            onSelect={() => pick(code)}
            title={shortLanguageName(code)}
            sub={languageAutonym(code)}
            subLang={code}
          />
        ))}
        <Choice
          name="target"
          wide
          checked={s.targetLanguage === 'auto'}
          onSelect={() => pick('auto')}
          title="It depends on the video"
          sub="Captionary uses whatever language each video is in."
        />
      </fieldset>
      <div className="cap-row cap-wizard__other">
        <span className="cap-muted">Not in the list?</span>
        <Select
          variant="button"
          label="Another language"
          className={other ? 'is-chosen' : undefined}
          value={other}
          options={OTHER_OPTIONS}
          onChange={(v) => v && pick(v)}
        />
      </div>

      <section className="cap-wizard__section" aria-labelledby="native-title">
        <h2 className="cap-h2" id="native-title">
          Your own language
        </h2>
        <p className="cap-wizard__sentence">
          Translations and explanations will be in{' '}
          <LanguageSelect
            variant="sentence"
            label="Your own language"
            value={s.nativeLanguage}
            onChange={(v) => set((st) => void (st.nativeLanguage = v))}
          />
          .
        </p>
        {same && (
          <Note tone="warn">
            You picked {shortLanguageName(s.nativeLanguage)} for both. Choose the language you are learning above, or change your own
            language here.
          </Note>
        )}
      </section>
    </Step>
  );
}

/* ---------- level ---------- */

const LEVELS: { level: Settings['learnerLevel']; title: string; sub: string }[] = [
  { level: 'A1', title: 'I’m just starting', sub: 'I know a few words and greetings.' },
  { level: 'A2', title: 'I know the basics', sub: 'I can follow simple, everyday sentences.' },
  { level: 'B1', title: 'I can get by', sub: 'I understand clear speech about familiar things.' },
  { level: 'B2', title: 'I’m fairly confident', sub: 'I follow most conversations, with some effort.' },
  { level: 'C1', title: 'I’m advanced', sub: 'I understand nearly everything but miss some expressions.' },
  { level: 'C2', title: 'I’m almost fluent', sub: 'I want to polish the finer points.' },
];

function LevelStep({ s, set, go }: StepProps) {
  const name = s.targetLanguage === 'auto' ? 'the language' : shortLanguageName(s.targetLanguage);
  return (
    <Step
      title={`How well do you know ${name}?`}
      lead="The AI tutor uses this to pitch its explanations at the right level. A rough guess is fine."
      foot={<Foot onBack={() => go('language')} onNext={() => go('pin')} />}
    >
      <fieldset className="cap-wizard__choices">
        <legend className="cap-sr">Your level</legend>
        {LEVELS.map((l) => (
          <Choice
            key={l.level}
            name="level"
            checked={s.learnerLevel === l.level}
            onSelect={() => set((st) => void (st.learnerLevel = l.level))}
            title={l.title}
            sub={l.sub}
            meta={<span title="Level on the European scale (CEFR)">{l.level}</span>}
          />
        ))}
      </fieldset>
    </Step>
  );
}

/* ---------- pin ---------- */

function PinStep({ go }: StepProps) {
  const pinned = usePinned();
  return (
    <Step
      title="Pin Captionary to your toolbar"
      lead="Its icon then sits next to the address bar, one click away: turn Captionary on or off, switch languages, and open your saved words."
      foot={
        <Foot
          onBack={() => go('level')}
          onNext={() => go('tutor')}
          nextLabel={pinned === false ? 'Skip this step' : 'Continue'}
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
          <div className="cap-wizard__menu-title">Extensions</div>
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
            Click the <strong>puzzle piece</strong> <IconPuzzle className="cap-ico" aria-label="puzzle piece icon" /> at the top right of
            Chrome, next to the address bar.
          </span>
        </li>
        <li>
          <span className="cap-wizard__n">2</span>
          <span>
            Find <strong>Captionary</strong> in the list and click the <strong>pin</strong>{' '}
            <IconPin className="cap-ico" aria-label="pin icon" /> beside it.
          </span>
        </li>
      </ol>
      <div aria-live="polite">
        {pinned === true && <Note tone="success">Pinned. The Captionary icon is now next to the address bar.</Note>}
        {pinned === false && (
          <p className="cap-wizard__waiting">
            <span className="cap-spinner" />
            Waiting for you to pin it…
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
  const [tutor] = useTutorStatus();
  const pinned = usePinned();
  const learning = s.targetLanguage === 'auto' ? 'The language of each video' : shortLanguageName(s.targetLanguage);
  const keys = s.shortcuts;
  const key = (k: string) => k && <span className="cap-kbd">{keyLabel(k)}</span>;
  const summary: { label: string; value: string; step: SetupStep; action?: string }[] = [
    {
      label: 'Learning',
      value: `${learning} · ${LEVELS.find((l) => l.level === s.learnerLevel)?.title ?? s.learnerLevel}`,
      step: 'language',
    },
    { label: 'Translations', value: `In ${languageName(s.nativeLanguage)}`, step: 'language' },
    ...(pinned === null
      ? []
      : [{ label: 'Toolbar', value: pinned ? 'Pinned' : 'Not pinned yet', step: 'pin' as const, action: pinned ? undefined : 'Pin it' }]),
    {
      label: 'AI tutor',
      value: tutor?.configured ? `${tutor.providerName}` : 'Not set up. The dictionary and translations still work.',
      step: 'tutor',
      action: tutor?.configured ? undefined : 'Set up',
    },
  ];
  return (
    <Step
      title="You’re all set"
      lead="Open any video with subtitles and Captionary starts on its own."
      foot={
        <Foot
          onBack={() => go('try')}
          onNext={closeGuide}
          nextLabel="Done"
          extra={
            <a className="cap-btn cap-btn--lg cap-btn--ghost" href="/options.html#general">
              All settings
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
                aria-label={`${row.action ?? 'Change'}: ${row.label}`}
              >
                {row.action ?? 'Change'}
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <section className="cap-wizard__section" aria-labelledby="watch-title">
        <h2 className="cap-h2" id="watch-title">
          Start watching
        </h2>
        <div className="cap-wizard__sites">
          <a className="cap-wizard__site" href={youtubeUrl(s.targetLanguage)} target="_blank" rel="noopener noreferrer">
            <strong>
              YouTube <IconExternal className="cap-ico" />
            </strong>
            <span>{s.targetLanguage === 'auto' ? 'Any video with subtitles' : `Easy ${shortLanguageName(s.targetLanguage)} videos`}</span>
          </a>
          <a className="cap-wizard__site" href="https://www.netflix.com/browse" target="_blank" rel="noopener noreferrer">
            <strong>
              Netflix <IconExternal className="cap-ico" />
            </strong>
            <span>Films and series</span>
          </a>
          <a className="cap-wizard__site" href="https://tv.apple.com/" target="_blank" rel="noopener noreferrer">
            <strong>
              Apple TV+ <IconExternal className="cap-ico" />
            </strong>
            <span>Films and series</span>
          </a>
        </div>
        <p className="cap-wizard__text">
          On a video, look for the Captionary button <IconGlyph className="cap-ico cap-wizard__glyph" aria-label="Captionary" /> in the
          player’s controls. It turns the translation on or off and changes languages.
        </p>
        <Note tone="plain">Had a video open before you installed Captionary? Reload that tab so Captionary can start there.</Note>
      </section>

      <section className="cap-wizard__section" aria-labelledby="keys-title">
        <h2 className="cap-h2" id="keys-title">
          Handy keys while you watch
        </h2>
        <ul className="cap-wizard__keys">
          <li>
            <span className="cap-row" style={{ gap: 4 }}>
              {key(keys.prevLine)}
              {key(keys.repeatLine)}
              {key(keys.nextLine)}
            </span>
            Previous line, repeat, next line
          </li>
          <li>
            {key(keys.toggleAutoPause)}
            Pause after every line
          </li>
          <li>
            {key(keys.toggleTranslation)}
            Show or hide the translation
          </li>
          {tutor?.configured && (
            <li>
              {key(keys.explainLine)}
              Ask the tutor about the line
            </li>
          )}
        </ul>
      </section>
    </Step>
  );
}
