import { browser } from '#imports';
import { useEffect, useState } from 'react';
import { bg, type AIStatus } from '@/lib/messaging';
import { Field, LanguageSelect, Toggle, useSettings } from '@/ui/form';
import { IconBook, IconSettings, IconSparkles } from '@/ui/icons';

function open(page: 'options' | 'vocab' | 'reader', hash?: string) {
  void bg({ type: 'open.page', page, hash }).then(() => window.close());
}

export function Popup() {
  const [s, update] = useSettings();
  const [ai, setAi] = useState<AIStatus | null>(null);
  const [windowId, setWindowId] = useState<number | undefined>();
  useEffect(() => {
    void bg({ type: 'ai.status' })
      .then(setAi)
      .catch(() => undefined);
    void browser.windows.getCurrent().then((w) => setWindowId(w.id));
  }, []);
  if (!s) return null;
  return (
    <div className="lr-action-popup">
      <div className="lr-row">
        <div className="lr-brand">
          <span className="dot" /> Captionary
        </div>
        <span className="lr-spacer" />
        <Toggle label="Enabled" checked={s.enabled} onChange={(v) => void update((st) => void (st.enabled = v))} />
      </div>
      <div>
        <Field label="Learning">
          <LanguageSelect allowAuto value={s.targetLanguage} onChange={(v) => void update((st) => void (st.targetLanguage = v))} />
        </Field>
        <Field label="My language">
          <LanguageSelect value={s.nativeLanguage} onChange={(v) => void update((st) => void (st.nativeLanguage = v))} />
        </Field>
        <Field label="Auto-pause">
          <Toggle checked={s.playback.autoPause} onChange={(v) => void update((st) => void (st.playback.autoPause = v))} />
        </Field>
        <Field label="Subtitle list">
          <Toggle checked={s.sidebar.open} onChange={(v) => void update((st) => void (st.sidebar.open = v))} />
        </Field>
      </div>
      <div className="lr-note" style={{ margin: 0 }}>
        <IconSparkles style={{ width: 13, height: 13, verticalAlign: -2 }} />{' '}
        {ai?.configured && ai.enabled ? (
          <>
            AI: <b>{ai.providerName}</b> · {ai.model}
          </>
        ) : (
          <>
            AI explanations are not set up.{' '}
            <button className="lr-link" onClick={() => open('options', 'ai')}>
              Connect a provider
            </button>
          </>
        )}
      </div>
      <div className="lr-row">
        <button className="lr-btn" onClick={() => open('vocab')}>
          <IconBook /> Saved words
        </button>
        <button className="lr-btn" onClick={() => open('reader')}>
          Reader
        </button>
        <button
          className="lr-btn"
          title="AI tutor side panel (Alt+L)"
          disabled={windowId === undefined}
          // Called synchronously so the click still counts as a user gesture.
          onClick={() => void browser.sidePanel.open({ windowId: windowId! }).then(() => window.close())}
        >
          Tutor
        </button>
        <span className="lr-spacer" />
        <button className="lr-icon-btn" title="Settings" onClick={() => open('options')}>
          <IconSettings />
        </button>
      </div>
    </div>
  );
}
