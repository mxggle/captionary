import type { CSSProperties, ReactNode } from 'react';
import { getCurrentUILocale, getMessages, useI18n } from '@/lib/i18n';
import { languageName, sameLang } from '@/lib/languages';
import type { AIStatus } from '@/lib/messaging';
import type { TrackInfo } from '@/lib/subtitles/types';
import { IconCheck, IconChevronLeft, IconChevronRight } from '@/ui/icons';
import type { SessionController } from '../controller';
import { pickTranslation, sourceKey, trackLabel, type TranslationChoice } from './subtitles';
import type { TranslationSource } from '@/lib/subtitles/types';

/** A menu row that opens a sub-page or runs an action: label, value, chevron (`cap-menu__item`). */
export function MenuRow({
  label,
  value,
  icon,
  chevron = true,
  onClick,
}: {
  label: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cap-menu__item" role="menuitem" onClick={onClick}>
      {icon}
      <span className="cap-menu__label">{label}</span>
      {value && <span className="cap-menu__value">{value}</span>}
      {chevron && <IconChevronRight className="cap-menu__chev" />}
    </button>
  );
}

/** An on/off row with the host's switch; the whole row toggles it, as in the host's own menus. */
export function MenuSwitch({
  label,
  keyName,
  checked,
  onChange,
}: {
  label: string;
  keyName?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" className="cap-menu__item" role="menuitemcheckbox" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="cap-menu__label">
        {label}
        {keyName && <span className="cap-menu__key"> ({keyName})</span>}
      </span>
      <span className={`cap-pswitch${checked ? ' is-on' : ''}`} aria-hidden="true" />
    </button>
  );
}

/** A labelled section of a menu (Apple TV+'s "Original", "Translation"); the heading names the group. */
export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="cap-menu__section" aria-hidden="true">
        {label}
      </div>
      {children}
    </div>
  );
}

/** A rule between groups of menu items. */
export function MenuSep({ style }: { style?: CSSProperties }) {
  return <div className="cap-menu__sep" role="separator" style={style} />;
}

/** One choice in a list of choices, with a check when it is the current one. */
export function MenuRadio({
  label,
  meta,
  checked,
  onClick,
}: {
  label: ReactNode;
  meta?: ReactNode;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cap-menu__item" role="menuitemradio" aria-checked={checked} onClick={onClick}>
      <IconCheck className="cap-menu__check" />
      <span className="cap-menu__label">{label}</span>
      {meta && <span className="cap-menu__value">{meta}</span>}
    </button>
  );
}

/** Sub-page head with a back arrow, like the host's own quality and speed menus. */
export function MenuBack({ title, onBack }: { title: string; onBack: () => void }) {
  const { m } = useI18n();
  return (
    <>
      <div className="cap-menu__head">
        <button type="button" className="cap-menu__back" role="menuitem" aria-label={m.common.back} onClick={onBack}>
          <IconChevronLeft className="cap-ico" />
        </button>
        <span className="cap-menu__label">{title}</span>
      </div>
      <MenuSep />
    </>
  );
}

/** Subtitle tracks that can be the original line (forced tracks only carry foreign-language lines). */
export function originalTracks(tracks: TrackInfo[]): TrackInfo[] {
  return tracks.filter((t) => !t.forced);
}

/** The current original track as menus show it: "Español (auto)". */
export function originalValue(tracks: TrackInfo[], id: string | null): string {
  const m = getMessages(getCurrentUILocale());
  const t = tracks.find((x) => x.id === id);
  return t ? trackLabel(t) : m.common.none;
}

/** Tracks in the same language as the current original, for short inline lists. */
export function sameLanguageTracks(tracks: TrackInfo[], id: string | null): TrackInfo[] {
  const current = tracks.find((t) => t.id === id);
  const all = originalTracks(tracks);
  if (!current) return all.slice(0, 4);
  return all.filter((t) => sameLang(t.lang, current.lang));
}

export function OriginalChoices({
  controller,
  tracks,
  originalTrackId,
  onDone,
}: {
  controller: SessionController;
  tracks: TrackInfo[];
  originalTrackId: string | null;
  onDone?: () => void;
}) {
  const { m, locale } = useI18n();
  return (
    <>
      {tracks.length === 0 && <div className="cap-menu__section">{m.content.playerMenu.noSubtitleTracks}</div>}
      {tracks.map((t) => {
        const langLabel = languageName(t.lang, locale);
        const label = trackLabel(t);
        return (
          <MenuRadio
            key={t.id}
            label={label}
            meta={label.includes(langLabel) || label.includes(languageName(t.lang)) ? undefined : langLabel}
            checked={t.id === originalTrackId}
            onClick={() => {
              if (t.id !== originalTrackId) void controller.selectOriginalTrack(t.id);
              onDone?.();
            }}
          />
        );
      })}
    </>
  );
}

export function TranslationChoices({
  controller,
  choices,
  current,
  aiStatus,
  onDone,
}: {
  controller: SessionController;
  choices: TranslationChoice[];
  current: TranslationSource;
  aiStatus: AIStatus | null;
  onDone?: () => void;
}) {
  const key = sourceKey(current);
  return (
    <>
      {choices.map((c) => (
        <MenuRadio
          key={c.key}
          label={c.label}
          meta={c.meta}
          checked={c.key === key}
          onClick={() => {
            if (c.key !== key || c.setup) pickTranslation(controller, c, aiStatus);
            onDone?.();
          }}
        />
      ))}
    </>
  );
}
