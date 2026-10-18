import { useI18n } from '@/lib/i18n';
import { Segment } from '@/ui/controls';

export type ReaderMode = 'text' | 'video';

export function ModeSwitch({ mode, onMode }: { mode: ReaderMode; onMode: (m: ReaderMode) => void }) {
  const { m } = useI18n();
  return (
    <Segment
      label={m.reader.modeLabel}
      value={mode}
      options={[
        { value: 'text', label: m.reader.modeText },
        { value: 'video', label: m.reader.modeVideo },
      ]}
      onChange={onMode}
    />
  );
}
