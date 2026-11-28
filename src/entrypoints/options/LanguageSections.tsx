import { useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { baseLang, languageName } from '@/lib/languages';
import type { Settings } from '@/lib/settings';
import { HINT_SCALES, hintLevelFor, type HintScale } from '@/lib/text/hints';
import { Note, PageHead, Segment, SettingRow, SettingsCard, Switch } from '@/ui/controls';
import { useSettings } from '@/ui/form';

type Update = (fn: (s: Settings) => void) => void;

/** One module per group of learning languages; each holds only what applies to it. */
export type LanguageModule = 'ja' | 'zh' | 'ko' | 'en' | 'other';

const MODULES: LanguageModule[] = ['ja', 'zh', 'ko', 'en', 'other'];

/** The module a learning language belongs to; 'auto' (each video's language) has none. */
export function moduleFor(lang: string): LanguageModule | null {
  if (lang === 'auto') return null;
  const code = baseLang(lang);
  return code === 'ja' || code === 'zh' || code === 'ko' || code === 'en' ? code : 'other';
}

/** "Chinese", not "Chinese (Simplified)": the module covers every Chinese variant. */
function moduleName(mod: Exclude<LanguageModule, 'other'>, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(mod) ?? languageName(mod, locale);
  } catch {
    return languageName(mod, locale);
  }
}

/** The vocabulary level a module's definition hints use, on its own scale. */
function HintLevelRow({ scale, s, set, help }: { scale: HintScale; s: Settings; set: Update; help: ReactNode }) {
  const { m } = useI18n(s);
  const { name, levels } = HINT_SCALES[scale];
  const off = !s.subtitles.definitionHints;
  return (
    <SettingRow title={`${m.options.language.hintLevel} · ${name}`} help={help} disabled={off}>
      {(id) => (
        <Segment
          labelledBy={id}
          disabled={off}
          value={hintLevelFor(scale, s.subtitles.hintLevels, s.learnerLevel).id}
          options={levels.map((l) => ({ value: l.id, label: l.label.replace(`${name} `, '') }))}
          onChange={(v) => set((st) => void (st.subtitles.hintLevels = { ...st.subtitles.hintLevels, [scale]: v }))}
        />
      )}
    </SettingRow>
  );
}

/** The reading line under the subtitle. One stored switch for now, so each module says it is shared. */
function ReadingRow({ s, set, title, help }: { s: Settings; set: Update; title: string; help: string }) {
  const { m } = useI18n(s);
  return (
    <SettingRow
      title={title}
      help={
        <>
          {help} {m.options.language.readingShared}
        </>
      }
    >
      {(id) => (
        <Switch
          labelledBy={id}
          checked={s.subtitles.showRomanization}
          onChange={(v) => set((st) => void (st.subtitles.showRomanization = v))}
        />
      )}
    </SettingRow>
  );
}

function JapaneseModule({ s, set }: { s: Settings; set: Update }) {
  const { m } = useI18n(s);
  const t = m.options.language;
  return (
    <>
      <SettingsCard title={t.readingCard}>
        <ReadingRow s={s} set={set} title={t.jaReading} help={t.jaReadingHelp} />
        {/* Japanese reading script (romaji / hiragana / katakana) goes here. */}
      </SettingsCard>
      <SettingsCard title={t.hintsCard}>
        <HintLevelRow scale="jlpt" s={s} set={set} help={t.hintLevelHelp('JLPT')} />
      </SettingsCard>
    </>
  );
}

function ChineseModule({ s, set }: { s: Settings; set: Update }) {
  const { m } = useI18n(s);
  const t = m.options.language;
  return (
    <>
      <SettingsCard title={t.readingCard}>
        <ReadingRow s={s} set={set} title={t.zhReading} help={t.zhReadingHelp} />
      </SettingsCard>
      <SettingsCard title={t.hintsCard}>
        <HintLevelRow scale="hsk" s={s} set={set} help={t.hintLevelHelp('HSK')} />
      </SettingsCard>
    </>
  );
}

function KoreanModule({ s, set }: { s: Settings; set: Update }) {
  const { m } = useI18n(s);
  const t = m.options.language;
  return (
    <>
      <SettingsCard title={t.readingCard}>
        <ReadingRow s={s} set={set} title={t.koReading} help={t.koReadingHelp} />
      </SettingsCard>
      <SettingsCard title={t.hintsCard}>
        <HintLevelRow scale="topik" s={s} set={set} help={t.hintLevelHelp('TOPIK')} />
      </SettingsCard>
    </>
  );
}

function EnglishModule({ s, set }: { s: Settings; set: Update }) {
  const { m } = useI18n(s);
  const t = m.options.language;
  return (
    <SettingsCard title={t.hintsCard}>
      <HintLevelRow scale="cefr" s={s} set={set} help={`${t.hintLevelHelp('CEFR')} ${t.cefrShared}`} />
      <Note tone="plain">{t.enPhrases}</Note>
    </SettingsCard>
  );
}

function OtherModule({ s, set }: { s: Settings; set: Update }) {
  const { m } = useI18n(s);
  const t = m.options.language;
  return (
    <>
      <SettingsCard title={t.readingCard}>
        <ReadingRow s={s} set={set} title={t.otherReading} help={t.otherReadingHelp} />
      </SettingsCard>
      <SettingsCard title={t.hintsCard}>
        <HintLevelRow scale="cefr" s={s} set={set} help={`${t.hintLevelHelp('CEFR')} ${t.cefrShared}`} />
      </SettingsCard>
    </>
  );
}

const MODULE_VIEWS: Record<LanguageModule, (p: { s: Settings; set: Update }) => ReactNode> = {
  ja: JapaneseModule,
  zh: ChineseModule,
  ko: KoreanModule,
  en: EnglishModule,
  other: OtherModule,
};

/**
 * Settings that only make sense for some languages, one module per language. The module of the
 * language being learned opens first; the others stay one click away for "each video's language"
 * and for anyone learning more than one.
 */
export function LanguageSection() {
  const [s, update] = useSettings();
  const { m, locale } = useI18n(s);
  const learning = s ? moduleFor(s.targetLanguage) : null;
  const [picked, setPicked] = useState<LanguageModule | null>(null);
  if (!s) return null;
  const set: Update = (fn) => void update(fn);
  const t = m.options.language;
  const shown = picked ?? learning ?? 'ja';
  const label = (mod: LanguageModule) => {
    const name = mod === 'other' ? t.otherLanguages : moduleName(mod, locale);
    return mod === learning ? `${name} ✓` : name;
  };
  const View = MODULE_VIEWS[shown];
  return (
    <>
      <PageHead
        title={t.title}
        lead={learning ? t.leadLearning(s.targetLanguage === 'auto' ? '' : languageName(s.targetLanguage, locale)) : t.leadAuto}
      />
      <SettingsCard>
        <SettingRow title={t.showFor} help={learning ? t.showForHelp : t.showForAutoHelp}>
          {(id) => (
            <Segment
              labelledBy={id}
              value={shown}
              options={MODULES.map((mod) => ({ value: mod, label: label(mod) }))}
              onChange={setPicked}
            />
          )}
        </SettingRow>
      </SettingsCard>
      {!s.subtitles.definitionHints && (
        <Note
          action={
            <a href="#subtitles" className="cap-btn cap-btn--ghost">
              {t.hintsOffAction}
            </a>
          }
        >
          {t.hintsOff}
        </Note>
      )}
      <View s={s} set={set} />
    </>
  );
}
