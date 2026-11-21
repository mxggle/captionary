import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useI18n } from '@/lib/i18n';
import { IconCheck, IconChevronDown, IconError, IconInfo, IconWarning } from './icons';

/** The help text of the settings row a control sits in, so the control can point at it. */
const RowHelp = createContext<string | undefined>(undefined);

/** Id of the surrounding settings row's help text, for `aria-describedby`. */
export function useRowHelp(): string | undefined {
  return useContext(RowHelp);
}

/** On/off control for settings that take effect at once (`cap-switch`). */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const rowHelp = useRowHelp();
  return (
    <button
      type="button"
      className="cap-switch"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy ?? rowHelp}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** A switch with its name beside it, for a switch outside a settings row (a card's master switch). */
export function LabelledSwitch({ label, ...rest }: Omit<Parameters<typeof Switch>[0], 'label' | 'labelledBy'> & { label: string }) {
  const id = useId();
  return (
    <label className="cap-switch-label">
      <span id={id}>{label}</span>
      <Switch {...rest} labelledBy={id} />
    </label>
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

/** Pick one of two to six short options (`cap-segment`). Wraps onto more lines when its column is narrow. */
export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
}: {
  value: T | undefined;
  options: Choice<T>[];
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const rowHelp = useRowHelp();
  return (
    <div
      className="cap-segment"
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy ?? rowHelp}
      aria-disabled={disabled || undefined}
    >
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Tabs drawn as a segment, with the panel they control. Arrow keys, Home and End move between tabs and select
 * them; only the selected tab is in the Tab order.
 */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
  children,
}: {
  value: T;
  options: Choice<T>[];
  onChange: (v: T) => void;
  label: string;
  children: ReactNode;
}) {
  const base = useId();
  const tabId = (v: T) => `${base}tab-${v}`;
  const panelId = `${base}panel`;
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const last = options.length - 1;
    const next = {
      ArrowRight: i >= last ? 0 : i + 1,
      ArrowLeft: i <= 0 ? last : i - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(options[next].value);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <>
      <div className="cap-segment cap-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              id={tabId(o.value)}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)}>
        {children}
      </div>
    </>
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
  const rowHelp = useRowHelp();
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="cap-range">
      <input
        type="range"
        className="cap-range__input"
        aria-label={label}
        aria-describedby={rowHelp}
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
  describedBy,
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
  describedBy?: string;
  variant?: 'field' | 'sentence' | 'chip' | 'button';
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  mono?: boolean;
  id?: string;
}) {
  const rowHelp = useRowHelp();
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
        aria-describedby={describedBy ?? rowHelp}
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

const InLiveRegion = createContext(false);

/**
 * A polite live region that stays mounted (`cap-live`), so whatever is put inside it is announced: a region
 * inserted together with its text is often missed. It takes no room while empty.
 */
export function LiveRegion({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={`cap-live ${className}`.trim()}>
      <InLiveRegion.Provider value={true}>{children}</InLiveRegion.Provider>
    </div>
  );
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
  // Inside a live region the region announces it; an alert of its own would be read twice.
  const live = useContext(InLiveRegion);
  const Icon = tone === 'warn' ? IconWarning : tone === 'danger' ? IconError : tone === 'success' ? IconCheck : IconInfo;
  return (
    <div className={`cap-note${tone === 'info' ? '' : ` cap-note--${tone}`}`} role={tone === 'danger' && !live ? 'alert' : undefined}>
      <Icon className="cap-ico" />
      <div className="cap-spacer">{children}</div>
      {action}
    </div>
  );
}

/** Open state of an inline confirmation; closing it puts focus back on the button that asked. */
export function useConfirm<T extends HTMLElement = HTMLButtonElement>(): {
  open: boolean;
  ask: () => void;
  close: () => void;
  trigger: RefObject<T | null>;
} {
  const [open, setOpen] = useState(false);
  const trigger = useRef<T>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    trigger.current?.focus();
  }, [open]);
  return {
    open,
    ask: () => setOpen(true),
    close: () => {
      refocus.current = true;
      setOpen(false);
    },
    trigger,
  };
}

/**
 * The second step of a destructive or overwriting action, in place (`cap-confirm`). Cancel takes focus so
 * Enter never confirms by accident; Esc cancels.
 */
export function Confirm({
  children,
  action,
  onConfirm,
  onCancel,
  tone = 'danger',
}: {
  children: ReactNode;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'primary';
}) {
  const { m } = useI18n();
  const id = useId();
  return (
    <div
      className={`cap-confirm${tone === 'primary' ? ' cap-confirm--plain' : ''}`}
      role="group"
      aria-labelledby={id}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onCancel();
      }}
    >
      <p className="cap-confirm__text" id={id}>
        {children}
      </p>
      <div className="cap-row">
        <button type="button" className={`cap-btn ${tone === 'danger' ? 'cap-btn--danger-fill' : 'cap-btn--primary'}`} onClick={onConfirm}>
          {action}
        </button>
        <button type="button" className="cap-btn cap-btn--ghost" autoFocus onClick={onCancel}>
          {m.common.cancel}
        </button>
      </div>
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
  className = '',
}: {
  title?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={`cap-card ${className}`.trim()} aria-labelledby={title ? id : undefined} style={style}>
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

/**
 * One settings row: title and help on the left, the control on the right (`cap-setting`). Controls inside are
 * described by the help text; `disabled` greys the row out when a switch above turns it off.
 */
export function SettingRow({
  title,
  help,
  children,
  below,
  disabled,
}: {
  title: ReactNode | ((id: string) => ReactNode);
  help?: ReactNode;
  children?: ReactNode | ((id: string) => ReactNode);
  /** Extra content under the help text (a usage bar). */
  below?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const helpId = useId();
  return (
    <div className={`cap-setting${disabled ? ' is-disabled' : ''}`}>
      <div className="cap-setting__text">
        <div className="cap-setting__title" id={id}>
          {typeof title === 'function' ? title(id) : title}
        </div>
        {help && (
          <div className="cap-setting__help" id={helpId}>
            {help}
          </div>
        )}
        {below}
      </div>
      {children !== undefined && (
        <RowHelp.Provider value={help ? helpId : undefined}>
          <div className="cap-setting__control">{typeof children === 'function' ? children(id) : children}</div>
        </RowHelp.Provider>
      )}
    </div>
  );
}

/** Set by a page that switches sections in place, so the next page title takes focus and is announced. */
export const PageTitleFocus = createContext<{ current: boolean } | null>(null);

/** Page title block: the display title, a lead paragraph and up to two actions. */
export function PageHead({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  const focusRequest = useContext(PageTitleFocus);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!focusRequest?.current) return;
    focusRequest.current = false;
    ref.current?.focus({ preventScroll: true });
  }, [focusRequest]);
  return (
    <div className="cap-pagehead">
      <div className="cap-pagehead__text">
        <h1 className="cap-h1" ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {lead && <p className="cap-lead">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * Open state for a small popover menu that closes on Esc and on a click outside it. Unless the learner clicked
 * elsewhere, closing returns focus to the control that opened it.
 */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const root = (ref.current?.getRootNode() ?? document) as Document | ShadowRoot;
    const trigger = root.activeElement as HTMLElement | null;
    let clickedAway = false;
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.composedPath().includes(ref.current)) return;
      clickedAway = true;
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
      // Focus on a menu item is lost when the menu unmounts; a click elsewhere already moved it on purpose.
      const now = root.activeElement;
      const lost = !now || now === document.body || (ref.current?.contains(now) ?? false);
      if (!clickedAway && lost && trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return { open, setOpen, ref };
}
