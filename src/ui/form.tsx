import { useEffect, useState, type ReactNode } from 'react';
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

export function Field({ label, help, children, htmlFor }: { label: ReactNode; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="lr-field">
      <label htmlFor={htmlFor}>{label}</label>
      <div className="control">{children}</div>
      {help && <div className="help">{help}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-label={label}
      className="lr-toggle"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function LanguageSelect({
  value,
  onChange,
  allowAuto,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAuto?: boolean;
  id?: string;
}) {
  return (
    <select id={id} className="lr-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAuto && <option value="auto">Auto (the video's language)</option>}
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name} — {l.native}
        </option>
      ))}
    </select>
  );
}

/**
 * Text input that keeps its own state while typing and commits on blur / Enter,
 * so storage writes don't fight the cursor.
 */
export function CommitInput({
  value,
  onCommit,
  className = 'lr-input',
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
  width = 90,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
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
      type="number"
      className="lr-input"
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
