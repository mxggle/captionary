import { browser } from '#imports';
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useI18n, type UILocale } from '@/lib/i18n';
import { languageName } from '@/lib/languages';
import { bg, type AIStatus } from '@/lib/messaging';
import type { SetupStep } from '@/lib/onboarding';
import { watchAISettings, type Settings } from '@/lib/settings';
import { IconArrowRight, IconCheck, IconChevronLeft } from '@/ui/icons';

export interface StepProps {
  s: Settings;
  set: (fn: (s: Settings) => void) => void;
  go: (step: SetupStep) => void;
}

/**
 * One screen of the guide: the question as the page title, its answers, and the bar with Back and
 * Continue pinned to the bottom of the window so the next move is always in the same place.
 */
export function Step({
  title,
  meta,
  lead,
  children,
  foot,
}: {
  title: ReactNode;
  meta?: string;
  lead?: ReactNode;
  children: ReactNode;
  foot: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Move focus to the new question so keyboard and screen-reader users start from the top of it.
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <>
      <main className="cap-wizard__main">
        <div className="cap-wizard__inner">
          <div className="cap-wizard__head">
            <h1 className="cap-h1 cap-wizard__title" ref={ref} tabIndex={-1}>
              {title}
              {meta && <span className="cap-wizard__meta">{meta}</span>}
            </h1>
            {lead && <p className="cap-lead cap-wizard__lead">{lead}</p>}
          </div>
          {children}
        </div>
      </main>
      <footer className="cap-wizard__foot">
        <div className="cap-wizard__foot-inner">{foot}</div>
      </footer>
    </>
  );
}

/** Back on the left, the one next move on the right. */
export function Foot({
  onBack,
  onNext,
  nextLabel,
  quiet,
  disabled,
  note,
  extra,
  nextRef,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  /** Draw Continue as a plain button, when the step's own action is the primary one. */
  quiet?: boolean;
  disabled?: boolean;
  note?: ReactNode;
  extra?: ReactNode;
  /** For a step that moves focus to Continue once its task is done. */
  nextRef?: Ref<HTMLButtonElement>;
}) {
  const { m } = useI18n();
  return (
    <>
      {onBack && (
        <button className="cap-btn cap-btn--ghost cap-btn--lg" onClick={onBack}>
          <IconChevronLeft className="cap-ico" />
          {m.common.back}
        </button>
      )}
      <span className="cap-spacer cap-wizard__note">{note}</span>
      {extra}
      <button ref={nextRef} className={`cap-btn cap-btn--lg${quiet ? '' : ' cap-btn--primary'}`} disabled={disabled} onClick={onNext}>
        {nextLabel ?? m.common.continue}
        <IconArrowRight className="cap-ico" />
      </button>
    </>
  );
}

/** One answer of a question: a real radio button (arrow keys move between answers) drawn as a tile. */
export function Choice({
  name,
  checked,
  onSelect,
  title,
  sub,
  subLang,
  meta,
  wide,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  sub?: ReactNode;
  /** Language of the sub line (a language's own name). */
  subLang?: string;
  meta?: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`cap-choice${wide ? ' cap-choice--wide' : ''}`}>
      <input type="radio" className="cap-sr" name={name} checked={checked} onChange={onSelect} />
      <span className="cap-choice__mark" aria-hidden="true">
        <IconCheck className="cap-ico" strokeWidth={3} />
      </span>
      <span className="cap-choice__text">
        <span className="cap-choice__title">{title}</span>
        {sub && (
          <span className="cap-choice__sub" lang={subLang}>
            {sub}
          </span>
        )}
      </span>
      {meta && <span className="cap-choice__meta">{meta}</span>}
    </label>
  );
}

/**
 * Whether Captionary's icon is pinned to the toolbar, followed live while the learner pins it.
 * null when the browser cannot tell (Firefox, older Chrome).
 */
export function usePinned(): boolean | null {
  const [pinned, setPinned] = useState<boolean | null>(null);
  useEffect(() => {
    const action = browser.action as typeof browser.action | undefined;
    if (!action?.getUserSettings) return;
    let alive = true;
    const check = () =>
      void action
        .getUserSettings()
        .then((u) => alive && setPinned(u.isOnToolbar))
        .catch(() => undefined);
    check();
    // onUserSettingsChanged is newer than getUserSettings: poll where it is missing.
    const changed = action.onUserSettingsChanged;
    const onChange = (c: { isOnToolbar?: boolean }) => c.isOnToolbar !== undefined && setPinned(c.isOnToolbar);
    changed?.addListener(onChange);
    const timer = changed ? undefined : setInterval(check, 1000);
    return () => {
      alive = false;
      changed?.removeListener(onChange);
      clearInterval(timer);
    };
  }, []);
  return pinned;
}

/** The tutor's state from the background, read again whenever AI settings change; `refresh` reads it now. */
export function useTutorStatus(): [AIStatus | null, () => Promise<void>] {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const refresh = useCallback(
    () =>
      bg({ type: 'ai.status' })
        .then(setStatus)
        // No answer from the background: the tutor counts as not set up, so its step still offers the choices.
        .catch(() => setStatus((s) => s ?? { enabled: false, configured: false, autoExplain: false })),
    [],
  );
  useEffect(() => {
    void refresh();
    return watchAISettings(() => void refresh());
  }, [refresh]);
  return [status, refresh];
}

/** "Chinese (Simplified)" reads as "Chinese" in a sentence. */
export function shortLanguageName(code: string, uiLocale?: UILocale): string {
  return languageName(code, uiLocale).replace(/\s*[(\uff08].*[)\uff09]$/, '');
}
