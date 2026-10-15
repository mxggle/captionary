import { useCallback, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { bg } from '@/lib/messaging';
import { frequencyRank } from '@/lib/text/frequency-map';
import { normalizeWord } from '@/lib/text/tokenize';
import { removeVocab, vocabKey } from '@/lib/vocab';
import { WordPopup } from '@/ui/WordPopup';
import type { SessionController } from '../controller';
import { useSession, type Surface } from '../store';

interface Props {
  controller: SessionController;
  surface: Surface;
  /** Element the pop-up is absolutely positioned in; omitted = fixed to the viewport. */
  hostRef?: RefObject<HTMLElement | null>;
}

/** Connects the shared WordPopup to the session store for one UI surface. */
export function PopupHost({ controller, surface, hostRef }: Props) {
  const { popup, settings, aiStatus, vocab, media, frequency } = useSession(
    useShallow((s) => ({
      popup: s.popup,
      settings: s.settings,
      aiStatus: s.aiStatus,
      vocab: s.vocab,
      media: s.media,
      frequency: s.frequency,
    })),
  );
  const close = useCallback(() => controller.closePopup(), [controller]);
  if (!popup || popup.surface !== surface) return null;

  const host = hostRef?.current?.getBoundingClientRect();
  const bounds = host
    ? { left: host.left, top: host.top, width: host.width, height: host.height }
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };

  return (
    <WordPopup
      key={`${popup.kind}:${popup.text}:${popup.cueIndex}`}
      target={popup}
      settings={settings}
      aiStatus={aiStatus}
      vocab={vocab}
      bounds={bounds}
      fixed={!host}
      mediaTitle={media?.title}
      rank={popup.kind === 'word' && frequency ? frequencyRank(frequency, normalizeWord(popup.text, popup.lang)) : undefined}
      onClose={close}
      onSave={(status, extra) => {
        if (status) void controller.saveWord(popup.text, status, popup.cueIndex, extra);
        else void removeVocab(vocabKey(popup.text, popup.lang).id);
      }}
      onPlayLine={popup.cueIndex >= 0 ? () => controller.playCue(popup.cueIndex) : undefined}
      onSelectWord={(sel) => controller.openPopup({ kind: 'word', text: sel.text, cueIndex: popup.cueIndex, rect: sel.rect, surface })}
      onOpenSidePanel={() =>
        void bg({
          type: 'sidepanel.open',
          payload: {
            kind: popup.kind,
            text: popup.text,
            sentence: popup.sentence,
            lang: popup.lang,
            url: media?.url,
            title: media?.title,
          },
        }).catch(() => undefined)
      }
    />
  );
}
