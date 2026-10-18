import type { ReactNode } from 'react';
import { getCurrentUILocale, getMessages, useI18n } from '@/lib/i18n';
import { languageName, sameLang } from '@/lib/languages';
import type { TrackInfo } from '@/lib/subtitles/types';
import { PlayerSwitch } from '@/ui/controls';
import { IconCheck, IconChevronLeft, IconChevronRight } from '@/ui/icons';
import type { SessionController } from '../controller';
import { sourceKey, trackLabel, type TranslationChoice } from './subtitles';
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

/** An on/off row with the host's switch. */
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
    <div className="cap-menu__item">
      <span className="cap-menu__label">
        {label}
        {keyName && <span className="cap-menu__key"> ({keyName})</span>}
      </span>
      <PlayerSwitch role="menuitemcheckbox" label={label} checked={checked} onChange={onChange} />
    </div>
  );
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
        <button type="button" className="cap-menu__back" aria-label={m.common.back} onClick={onBack}>
          <IconChevronLeft className="cap-ico" />
        </button>
        <span className="cap-menu__label">{title}</span>
      </div>
      <div className="cap-menu__sep" />
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
        return (
          <MenuRadio
            key={t.id}
            label={trackLabel(t)}
            meta={t.label.includes(langLabel) || t.label.includes(languageName(t.lang)) ? undefined : langLabel}
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
  onDone,
}: {
  controller: SessionController;
  choices: TranslationChoice[];
  current: TranslationSource;
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
            if (c.key !== key) void controller.selectTranslation(c.source);
            onDone?.();
          }}
        />
      ))}
    </>
  );
}
