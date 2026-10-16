import { useEffect, useState, type CSSProperties } from 'react';
import type { AISettings } from '@/lib/ai/types';
import { LANGUAGES } from '@/lib/languages';
import {
  getAISettings,
  getSettings,
  updateAISettings,
  updateSettings,
  watchAISettings,
  watchSettings,
  type Settings,
} from '@/lib/settings';
import { Select, type SelectOption } from './controls';

export function useSettings(): [Settings | null, (fn: (s: Settings) => void) => Promise<unknown>] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
    return watchSettings(setSettings);
  }, []);
  return [settings, (fn) => updateSettings(fn).then(setSettings)];
}

export function useAISettings(): [AISettings | null, (fn: (s: AISettings) => void) => Promise<unknown>] {
  const [settings, setSettings] = useState<AISettings | null>(null);
  useEffect(() => {
    void getAISettings().then(setSettings);
    return watchAISettings(setSettings);
  }, []);
  return [settings, (fn) => updateAISettings(fn).then(setSettings)];
}

const LANGUAGE_OPTIONS: SelectOption<string>[] = LANGUAGES.map((l) => ({ value: l.code, label: l.name, text: `${l.name} — ${l.native}` }));
const AUTO_OPTION: SelectOption<string> = { value: 'auto', label: 'Each video’s language', text: 'Each video’s language (automatic)' };

export function LanguageSelect({
  value,
  onChange,
  allowAuto,
  label,
  labelledBy,
  variant = 'field',
  style,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAuto?: boolean;
  label?: string;
  labelledBy?: string;
  variant?: 'field' | 'sentence' | 'chip' | 'button';
  style?: CSSProperties;
  className?: string;
}) {
  const options = allowAuto ? [AUTO_OPTION, ...LANGUAGE_OPTIONS] : LANGUAGE_OPTIONS;
  // Keep codes we have no name for (a detected language outside the list) selectable.
  const all = options.some((o) => o.value === value) ? options : [...options, { value, label: value }];
  return (
    <Select
      value={value}
      options={all}
      onChange={onChange}
      label={label}
      labelledBy={labelledBy}
      variant={variant}
      style={style}
      className={className}
    />
  );
}

/**
 * Text input that keeps its own state while typing and commits on blur / Enter,
 * so storage writes don't fight the cursor.
 */
export function CommitInput({
  value,
  onCommit,
  className = 'cap-input',
  ...rest
}: { value: string; onCommit: (v: string) => void; className?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      {...rest}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  width = 96,
  label,
  id,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  label?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    let n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(value));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    setDraft(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      className="cap-input"
      aria-label={id ? undefined : label}
      style={{ width, minWidth: 0 }}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
