import { Segment } from '@/ui/controls';

export type ReaderMode = 'text' | 'video';

export function ModeSwitch({ mode, onMode }: { mode: ReaderMode; onMode: (m: ReaderMode) => void }) {
  return (
    <Segment
      label="Mode"
      value={mode}
      options={[
        { value: 'text', label: 'Text' },
        { value: 'video', label: 'Local video' },
      ]}
      onChange={onMode}
    />
  );
}
