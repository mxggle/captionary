import { useCallback, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { bg } from '@/lib/messaging';
import { frequencyRank } from '@/lib/text/frequency-map';
import { normalizeWord } from '@/lib/text/tokenize';
import { removeVocab, vocabKey } from '@/lib/vocab';
import { drawerAnchor, lineAnchor, type SessionController } from '../controller';
import { useSession, type AnchorRect, type Surface } from '../store';
import { LookupCard, placeCard } from './LookupCard';

interface Props {
  controller: SessionController;
  surfaces: Surface[];
  /** Element the card is absolutely positioned in; omitted = fixed to the viewport. */
  hostRef?: RefObject<HTMLElement | null>;
}

/** Connects the native look-up card to the session store for the surfaces drawn in one shadow root. */
export function LookupHost({ controller, surfaces, hostRef }: Props) {
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
  if (!popup || !surfaces.includes(popup.surface)) return null;

  const host = hostRef?.current?.getBoundingClientRect();
  const bounds: AnchorRect = host
    ? { left: host.left, top: host.top, width: host.width, height: host.height }
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  // Over the video the card must never cover the caption line; elsewhere it only avoids the word.
  const avoid = popup.surface === 'overlay' ? (lineAnchor.get?.() ?? popup.rect) : popup.rect;
  const side = popup.surface === 'drawer' ? (drawerAnchor.get?.() ?? null) : null;
  const surface = popup.surface;

  return (
    <LookupCard
      key={`${popup.kind}:${popup.text}:${popup.cueIndex}`}
      target={popup}
      settings={settings}
      aiStatus={aiStatus}
      vocab={vocab}
      place={(width) => placeCard(width, { anchor: popup.rect, avoid, bounds, side })}
      fixed={!host}
      mediaTitle={media?.title}
      rankKnown={!!frequency}
      rank={popup.kind === 'word' && frequency ? frequencyRank(frequency, normalizeWord(popup.text, popup.lang)) : undefined}
      onClose={close}
      onSave={(status, extra) => {
        if (status) void controller.saveWord(popup.text, status, popup.cueIndex, extra);
        else void removeVocab(vocabKey(popup.text, popup.lang).id);
      }}
      onPlayLine={popup.cueIndex >= 0 ? () => controller.playCue(popup.cueIndex) : undefined}
      onSelectWord={(sel) =>
        controller.openPopup({ kind: 'word', text: sel.text, cueIndex: popup.cueIndex, rect: sel.rect, surface, tokenRange: sel.range })
      }
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
