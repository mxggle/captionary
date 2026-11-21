import { useI18n } from '@/lib/i18n';
import type { SessionController } from '../controller';
import { useSession } from '../store';
import { aiNeedsSetup, openAISetup } from './subtitles';

/**
 * The way out of a failed translation, wherever it is reported (over the video, the drawer, the
 * panel): set up AI when that is what the translation needs, else try it again.
 */
export function TranslationErrorAction({ controller, className = 'cap-pbtn' }: { controller: SessionController; className?: string }) {
  const { m } = useI18n();
  const source = useSession((s) => s.translationSource);
  const aiStatus = useSession((s) => s.aiStatus);
  if (source.type === 'ai' && aiNeedsSetup(aiStatus)) {
    return (
      <button className={className} onClick={() => openAISetup(aiStatus)}>
        {m.content.overlay.setUpAI}
      </button>
    );
  }
  return (
    <button className={className} onClick={() => void controller.selectTranslation(source)}>
      {m.common.retry}
    </button>
  );
}
