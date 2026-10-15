import { useEffect, useId, useRef, useState } from 'react';
import { IconChevronDown } from './icons';

/**
 * Model ID input with a dropdown of known models. Unlike a <datalist>, which Chrome filters
 * by whatever is already in the field, opening it shows every model and only typing narrows
 * the list. Any other ID can still be typed by hand. Commits on blur, Enter or picking an option.
 */
export function ModelPicker({
  value,
  models,
  onCommit,
  placeholder,
  label,
}: {
  value: string;
  models: string[];
  onCommit: (v: string) => void;
  placeholder?: string;
  label: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  // null while browsing the full list; the typed text once the user starts typing.
  const [filter, setFilter] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  useEffect(() => setDraft(value), [value]);

  const q = filter?.trim().toLowerCase();
  const shown = q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
  const expanded = open && shown.length > 0;

  useEffect(() => {
    if (expanded && active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [expanded, active]);

  const commit = (v: string) => {
    const next = v.trim();
    setDraft(next);
    if (next !== value) onCommit(next);
  };
  const showAll = () => {
    setFilter(null);
    setActive(models.indexOf(draft.trim()));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setFilter(null);
    setActive(-1);
  };
  const pick = (m: string) => {
    commit(m);
    close();
  };

  return (
    <div className="lr-combo">
      <input
        ref={inputRef}
        className="lr-input"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={expanded && active >= 0 ? `${id}-${active}` : undefined}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setDraft(e.target.value);
          setFilter(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onClick={() => !open && showAll()}
        onBlur={() => {
          commit(draft);
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!expanded) return showAll();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => Math.max(0, Math.min(shown.length - 1, i + step)));
          } else if (e.key === 'Enter') {
            if (expanded && active >= 0) pick(shown[active]);
            else pick(draft);
          } else if (e.key === 'Escape') {
            if (expanded) {
              e.preventDefault();
              close();
            } else setDraft(value);
          }
        }}
      />
      {models.length > 0 && (
        <button
          type="button"
          className="lr-icon-btn lr-combo-toggle"
          tabIndex={-1}
          aria-label={`Show all ${models.length} models`}
          title={`Show all ${models.length} models`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (expanded) return close();
            inputRef.current?.focus();
            showAll();
          }}
        >
          <IconChevronDown />
        </button>
      )}
      {expanded && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="lr-combo-list"
          onMouseDown={(e) => e.preventDefault()}
        >
          {shown.map((m, i) => (
            <li
              key={m}
              id={`${id}-${i}`}
              role="option"
              aria-selected={m === value}
              className={i === active ? 'active' : undefined}
              title={m}
              onClick={() => pick(m)}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
