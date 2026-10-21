import { useEffect, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getCurrentUILocale, getMessages, resolveUILocale } from '@/lib/i18n';
import { languageName, regionalLanguageName, sameLang } from '@/lib/languages';
import { bg, type AIStatus } from '@/lib/messaging';
import { toPlainText } from '@/lib/subtitles/parse';
import type { TrackInfo, TranslationSource } from '@/lib/subtitles/types';
import type { SessionController } from '../controller';
import { useSession, type SessionState } from '../store';

/** Everything the subtitle panel, the drawer and the menus read from the session. */
export function useSubtitleData() {
  return useSession(
    useShallow((st) => ({
      settings: st.settings,
      site: st.site,
      cues: st.cues,
      translations: st.translations,
      romanizations: st.romanizations,
      frequency: st.frequency,
      activeIndex: st.activeIndex,
      lastIndex: st.lastIndex,
      lang: st.lang,
      tracks: st.tracks,
      originalTrackId: st.originalTrackId,
      translationSource: st.translationSource,
      translationStatus: st.translationStatus,
      translationMessage: st.translationMessage,
      status: st.status,
      message: st.message,
      vocab: st.vocab,
      media: st.media,
      aiStatus: st.aiStatus,
      theme: st.theme,
      popup: st.popup,
    })),
  );
}

export type SubtitleData = ReturnType<typeof useSubtitleData>;

export function sourceKey(src: TranslationSource): string {
  switch (src.type) {
    case 'none':
      return 'none';
    case 'track':
      return `track:${src.trackId}`;
    default:
      return src.type;
  }
}

export interface TranslationChoice {
  key: string;
  label: string;
  /** Where the translation comes from: "subtitle track", "auto-translate", "on-device", "AI". */
  meta?: string;
  source: TranslationSource;
  /** Listed first; the rest sit behind "Other subtitle tracks". */
  primary: boolean;
  /** AI is not set up yet: picking this opens the setup instead (see {@link pickTranslation}). */
  setup?: boolean;
}

/** AI translation cannot run yet: the tutor is turned off or has no provider (unknown status: assume it can). */
export function aiNeedsSetup(aiStatus: AIStatus | null): boolean {
  return !!aiStatus && !(aiStatus.enabled && aiStatus.configured);
}

/** Open where AI gets set up: the AI settings when it is turned off, else the setup guide's tutor step. */
export function openAISetup(aiStatus: AIStatus | null) {
  const off = !!aiStatus && !aiStatus.enabled;
  void bg({ type: 'open.page', page: off ? 'options' : 'welcome', hash: off ? 'ai' : 'tutor' }).catch(() => undefined);
}

/** A translation picked in a menu: show it, or open the AI setup when that is what it still needs. */
export function pickTranslation(controller: SessionController, choice: TranslationChoice, aiStatus: AIStatus | null) {
  if (choice.setup) openAISetup(aiStatus);
  else void controller.chooseTranslation(choice.source);
}

/** Translation sources for this video, the learner's language first. */
export function translationChoices(
  s: Pick<SessionState, 'tracks' | 'originalTrackId' | 'site' | 'settings' | 'aiStatus'>,
): TranslationChoice[] {
  const locale = resolveUILocale(s.settings);
  const m = getMessages(locale);
  const native = s.settings.nativeLanguage;
  // Off first, as in each host's own subtitle menu; then the learner's language, by where it comes
  // from (the title's own subtitles, then translations into it); then tracks in other languages.
  const out: TranslationChoice[] = [{ key: 'none', label: m.common.off, source: { type: 'none' }, primary: true }];
  const tracks = s.tracks.filter((t) => t.id !== s.originalTrackId && !t.forced);
  for (const t of tracks.filter((t) => sameLang(t.lang, native))) {
    out.push({
      key: `track:${t.id}`,
      label: trackLabel(t),
      meta: m.content.subtitles.metaOfficial,
      source: { type: 'track', trackId: t.id },
      primary: true,
    });
  }
  if (s.site === 'youtube') {
    out.push({
      key: 'platform-mt',
      label: m.content.subtitles.choiceAutoTranslate,
      source: { type: 'platform-mt', lang: native },
      primary: true,
    });
  }
  out.push({ key: 'chrome', label: m.content.subtitles.choiceOnDevice, source: { type: 'chrome', lang: native }, primary: true });
  const setup = aiNeedsSetup(s.aiStatus);
  out.push({
    key: 'ai',
    label: m.content.subtitles.choiceAi,
    meta: setup ? m.content.subtitles.metaAiNeedsSetup : undefined,
    source: { type: 'ai', lang: native },
    primary: true,
    setup,
  });
  for (const t of tracks.filter((t) => !sameLang(t.lang, native))) {
    out.push({ key: `track:${t.id}`, label: trackLabel(t), source: { type: 'track', trackId: t.id }, primary: false });
  }
  return out;
}

export function trackLabel(t: TrackInfo): string {
  const locale = getCurrentUILocale();
  const m = getMessages(locale);
  if (t.namedByLang) return `${regionalLanguageName(t.lang, locale)}${t.cc ? ' (CC)' : ''}`;
  return `${t.label}${t.auto && !/auto/i.test(t.label) ? m.content.subtitles.autoSuffix : ''}`;
}

/** "English · auto-translate", "Off": the current translation as the menus show it. */
export function translationValue(choices: TranslationChoice[], source: TranslationSource): string {
  const m = getMessages(getCurrentUILocale());
  const c = choices.find((x) => x.key === sourceKey(source));
  if (!c) return m.common.off;
  return c.meta ? `${c.label} · ${c.meta}` : c.label;
}

/** "Spanish · English translation" under the list title. */
export function languagePair(d: Pick<SubtitleData, 'lang' | 'translationSource' | 'tracks' | 'settings'>, short = false): string {
  if (!d.lang) return '';
  const locale = resolveUILocale(d.settings);
  const m = getMessages(locale);
  const orig = languageName(d.lang, locale);
  if (d.translationSource.type === 'none') return orig;
  const trLang = translationLang(d);
  return m.content.subtitles.pairTranslation(orig, trLang ? languageName(trLang, locale) : '', short);
}

/** Language of the translation lines: a subtitle track's own, else the language translated into. */
export function translationLang(d: Pick<SubtitleData, 'translationSource' | 'tracks'>): string | undefined {
  const src = d.translationSource;
  if (src.type === 'none') return undefined;
  return src.type === 'track' ? d.tracks.find((t) => t.id === src.trackId)?.lang : src.lang;
}

export function downloadText(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileBase(title: string | undefined): string {
  return (title ?? 'subtitles').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
}

/** Send the whole transcript to the reader as text. */
export function openInReader(d: Pick<SubtitleData, 'cues' | 'translations' | 'media' | 'lang'>) {
  const m = getMessages(getCurrentUILocale());
  void bg({
    type: 'reader.import',
    doc: {
      title: d.media?.title ?? m.content.subtitles.subtitlesFallbackTitle,
      url: d.media?.url ?? location.href,
      text: toPlainText(d.cues, []),
      lang: d.lang,
    },
  }).catch(() => undefined);
}

/**
 * Keep the line playing now in view while the list follows playback; the learner's own scrolling
 * wins while the pointer is over the list.
 */
export function useFollowPlayback(
  listRef: RefObject<HTMLElement | null>,
  index: number,
  enabled: boolean,
  align: 'third' | 'center' = 'third',
): { onPointerEnter: () => void; onPointerLeave: () => void } {
  const hovering = useRef(false);
  useEffect(() => {
    if (!enabled || hovering.current) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (!list || !row) return;
    const rowTop = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    const target = align === 'center' ? rowTop - list.clientHeight / 2 + row.offsetHeight / 2 : rowTop - list.clientHeight / 3;
    const smooth = Math.abs(list.scrollTop - target) <= 2000 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
  }, [index, enabled, listRef, align]);
  return {
    onPointerEnter: () => void (hovering.current = true),
    onPointerLeave: () => void (hovering.current = false),
  };
}
