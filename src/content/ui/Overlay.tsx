import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { IconBookmark, IconNext, IconPrev, IconRepeat, IconSparkles } from '@/ui/icons';
import { TokenizedText } from '@/ui/TokenizedText';
import { useVocabIndex } from '@/ui/vocab-index';
import { lineAnchor, toastListeners, type SessionController } from '../controller';
import { useSession } from '../store';
import { PopupHost } from './PopupHost';

export function useToast(): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    toastListeners.add(setText);
    return () => void toastListeners.delete(setText);
  }, []);
  return text;
}

/** Scale subtitle font with the player size (settings are tuned for a ~1000px wide player). */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1000));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function Overlay({ controller }: { controller: SessionController }) {
  const s = useSession(
    useShallow((st) => ({
      settings: st.settings,
      cues: st.cues,
      translations: st.translations,
      romanizations: st.romanizations,
      frequency: st.frequency,
      activeIndex: st.activeIndex,
      lang: st.lang,
      vocab: st.vocab,
      status: st.status,
      message: st.message,
      adShowing: st.adShowing,
      translationStatus: st.translationStatus,
      hasPopup: st.popup?.surface === 'overlay',
    })),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const index = useVocabIndex(s.vocab, s.lang);
  const toastText = useToast();

  useEffect(() => {
    lineAnchor.get = () => {
      const r = linesRef.current?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };
    return () => {
      lineAnchor.get = null;
    };
  }, []);

  const { subtitles } = s.settings;
  if (!s.settings.enabled) return null;
  const cue = s.activeIndex >= 0 ? s.cues[s.activeIndex] : undefined;
  const translation = s.activeIndex >= 0 ? s.translations[s.activeIndex] : undefined;
  const romanized = subtitles.showRomanization && s.activeIndex >= 0 ? s.romanizations[s.activeIndex] : '';
  const scale = Math.min(1.6, Math.max(0.55, width / 1000));
  const fontSize = Math.round(subtitles.fontSize * scale);

  return (
    <div className="lr-root lr-overlay" ref={rootRef}>
      {toastText && <div className="lr-toast">{toastText}</div>}
      {s.status === 'loading' && <div className="lr-badge">Loading subtitles…</div>}
      {s.status === 'error' && (
        <div className="lr-badge" title={s.message}>
          Captionary: {s.message}
        </div>
      )}
      {cue && !s.adShowing && (
        <div
          className="lr-subs"
          style={{ bottom: `${subtitles.bottomOffset}%`, fontSize }}
          onMouseEnter={() => controller.hoverStart()}
          onMouseLeave={() => controller.hoverEnd()}
        >
          <div className="lr-line-tools" style={{ fontSize: 14 }}>
            <button
              className="lr-icon-btn"
              title={`Previous (${s.settings.shortcuts.prevLine.toUpperCase()})`}
              onClick={() => controller.prev()}
            >
              <IconPrev />
            </button>
            <button
              className="lr-icon-btn"
              title={`Repeat (${s.settings.shortcuts.repeatLine.toUpperCase()})`}
              onClick={() => controller.repeat()}
            >
              <IconRepeat />
            </button>
            <button
              className="lr-icon-btn"
              title={`Next (${s.settings.shortcuts.nextLine.toUpperCase()})`}
              onClick={() => controller.next()}
            >
              <IconNext />
            </button>
            <button
              className="lr-icon-btn"
              title={`Explain this line (${s.settings.shortcuts.explainLine.toUpperCase()})`}
              onClick={() => controller.explainCurrentLine()}
            >
              <IconSparkles />
            </button>
            <button
              className="lr-icon-btn"
              title={`Save line as phrase (${s.settings.shortcuts.saveLine.toUpperCase()})`}
              onClick={() => void controller.saveCurrentLine()}
            >
              <IconBookmark />
            </button>
          </div>
          <div className="lr-subs-inner" ref={linesRef}>
            {subtitles.showOriginal && (
              <div className="lr-line original">
                <TokenizedText
                  text={cue.text}
                  lang={s.lang}
                  index={index}
                  highlight={subtitles.highlight}
                  freq={s.frequency}
                  onSelect={(sel) =>
                    controller.openPopup({
                      kind: 'word',
                      text: sel.text,
                      cueIndex: s.activeIndex,
                      rect: sel.rect,
                      surface: 'overlay',
                    })
                  }
                />
              </div>
            )}
            {romanized && (
              <div className="lr-line roman" style={{ fontSize: Math.round(fontSize * 0.62) }}>
                {romanized}
              </div>
            )}
            {subtitles.showTranslation && translation && (
              <div
                className={`lr-line translation${subtitles.blurTranslation ? ' blur' : ''}`}
                style={{ fontSize: Math.round(fontSize * subtitles.translationScale) }}
              >
                {translation}
              </div>
            )}
            {subtitles.showTranslation && !translation && s.translationStatus === 'loading' && (
              <div className="lr-line translation pending" style={{ fontSize: Math.round(fontSize * subtitles.translationScale * 0.8) }}>
                translating…
              </div>
            )}
          </div>
        </div>
      )}
      {s.hasPopup && <PopupHost controller={controller} surface="overlay" hostRef={rootRef} />}
    </div>
  );
}
