import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconCheck, IconChevronDown, IconError, IconInfo, IconWarning } from './icons';

/** On/off control for settings that take effect at once (`cap-switch`). */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="cap-switch"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** The switch used inside player menus and host panels, in the host's own switch colour. */
export function PlayerSwitch({
  checked,
  onChange,
  label,
  labelledBy,
  role = 'switch',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  role?: 'switch' | 'menuitemcheckbox';
}) {
  return (
    <button
      type="button"
      className="cap-pswitch"
      role={role}
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

export interface Choice<T extends string | number> {
  value: T;
  label: ReactNode;
}

/** Pick one of two to six short options (`cap-segment`). */
export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  role = 'group',
}: {
  value: T | undefined;
  options: Choice<T>[];
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  role?: 'group' | 'tablist';
}) {
  return (
    <div className="cap-segment" role={role} aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role={role === 'tablist' ? 'tab' : undefined}
          aria-selected={role === 'tablist' ? o.value === value : undefined}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Slider with its value printed beside it (`cap-range`). */
export function Range({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="cap-range">
      <input
        type="range"
        className="cap-range__input"
        aria-label={label}
        aria-valuetext={format(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': fill } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="cap-range__value">{format(value)}</span>
    </div>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  /** Shown on the control when selected. */
  label: string;
  /** Shown in the system list; defaults to the label. */
  text?: string;
  /** Secondary detail on the control ("auto", "subtitle track"). */
  meta?: string;
}

/**
 * A select drawn in one of the system's shapes, with the browser's own listbox underneath
 * (a transparent native <select> covers the control, so keyboard and screen readers get the real thing).
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  variant = 'field',
  className = '',
  style,
  disabled,
  mono,
  id,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  variant?: 'field' | 'sentence' | 'chip' | 'button';
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  mono?: boolean;
  id?: string;
}) {
  const current = options.find((o) => o.value === value);
  const shape = {
    field: 'cap-select',
    sentence: 'cap-sentence-pick',
    chip: 'cap-chip cap-pick',
    button: 'cap-btn cap-pick',
  }[variant];
  return (
    <span className={`${shape}${disabled ? ' is-disabled' : ''} ${className}`.trim()} style={style}>
      {variant === 'field' ? (
        <>
          <span className={`cap-select__value${mono ? ' cap-mono' : ''}`} style={mono ? { fontSize: 13 } : undefined}>
            {current?.label ?? ''}
          </span>
          {current?.meta && <span className="cap-select__meta">{current.meta}</span>}
        </>
      ) : (
        current?.label
      )}
      <IconChevronDown className="cap-ico" />
      <select
        id={id}
        className="cap-select__native"
        value={value}
        disabled={disabled}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text ?? (o.meta ? `${o.label} · ${o.meta}` : o.label)}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Kbd({ children, large }: { children: ReactNode; large?: boolean }) {
  return <span className={`cap-kbd${large ? ' cap-kbd--lg' : ''}`}>{children}</span>;
}

/** Show a key as the learner presses it. */
export function keyLabel(key: string, spaceLabel = 'Space'): string {
  if (!key) return '';
  if (key === ' ') return spaceLabel;
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Inline message next to the thing it is about (`cap-note`). */
export function Note({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'plain' | 'success';
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'warn' ? IconWarning : tone === 'danger' ? IconError : tone === 'success' ? IconCheck : IconInfo;
  return (
    <div className={`cap-note${tone === 'info' ? '' : ` cap-note--${tone}`}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className="cap-ico" />
      <div className="cap-spacer">{children}</div>
      {action}
    </div>
  );
}

/** A group of settings rows in a card (`SettingsCard`). */
export function SettingsCard({
  title,
  help,
  action,
  children,
  style,
}: {
  title?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  return (
    <section className="cap-card" aria-labelledby={title ? id : undefined} style={style}>
      {title && (
        <div className="cap-card__head">
          {help ? (
            <div className="cap-spacer" style={{ minWidth: 0 }}>
              <h2 className="cap-card__title" id={id} style={{ display: 'block' }}>
                {title}
              </h2>
              <div className="cap-help">{help}</div>
            </div>
          ) : (
            <h2 className="cap-card__title" id={id}>
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** One settings row: title and help on the left, the control on the right (`cap-setting`). */
export function SettingRow({
  title,
  help,
  children,
  below,
}: {
  title: ReactNode | ((id: string) => ReactNode);
  help?: ReactNode;
  children?: ReactNode | ((id: string) => ReactNode);
  /** Extra content under the help text (a usage bar). */
  below?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="cap-setting">
      <div className="cap-setting__text">
        <div className="cap-setting__title" id={id}>
          {typeof title === 'function' ? title(id) : title}
        </div>
        {help && <div className="cap-setting__help">{help}</div>}
        {below}
      </div>
      {children !== undefined && <div className="cap-setting__control">{typeof children === 'function' ? children(id) : children}</div>}
    </div>
  );
}

/** Page title block: the display title, a lead paragraph and up to two actions. */
export function PageHead({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="cap-pagehead">
      <div className="cap-pagehead__text">
        <h1 className="cap-h1">{title}</h1>
        {lead && <p className="cap-lead">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/** Open state for a small popover menu that closes on Esc and on a click outside it. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.composedPath().includes(ref.current)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return { open, setOpen, ref };
}
