import { useI18n } from '@/lib/i18n';
import type { Settings } from '@/lib/settings';
import type { JapaneseReadingScript } from '@/lib/text/furigana';
import { Segment, SettingRow } from '@/ui/controls';

/** How readings over Japanese words are written. Self-contained, so it can sit in any Japanese settings group. */
export function JapaneseReadingRow({ settings, set }: { settings: Settings; set: (fn: (s: Settings) => void) => void }) {
  const { m } = useI18n(settings);
  const t = m.options.subtitles;
  return (
    <SettingRow title={t.japaneseReading} help={t.japaneseReadingHelp}>
      {(id) => (
        <Segment<JapaneseReadingScript>
          labelledBy={id}
          value={settings.subtitles.japaneseReading}
          disabled={!settings.subtitles.showRomanization}
          options={[
            { value: 'hiragana', label: t.readingHiragana },
            { value: 'katakana', label: t.readingKatakana },
            { value: 'romaji', label: t.readingRomaji },
          ]}
          onChange={(v) => set((st) => void (st.subtitles.japaneseReading = v))}
        />
      )}
    </SettingRow>
  );
}
