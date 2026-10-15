import { browser } from '#imports';
import { useState } from 'react';
import {
  aiSettingsItem,
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  getAISettings,
  getSettings,
  mergeDefaults,
  settingsItem,
  SHORTCUT_LABELS,
  type Settings,
  type ShortcutAction,
} from '@/lib/settings';
import { importVocab, listVocab, toAnkiTsv, toCsv, type VocabItem } from '@/lib/vocab';
import { Field, LanguageSelect, NumberInput, Toggle, useSettings } from '@/ui/form';

export function GeneralSection() {
  const [s, update] = useSettings();
  if (!s) return null;
  const set = (fn: (st: Settings) => void) => void update(fn);
  return (
    <>
      <h1>General</h1>
      <p className="lr-lead">Your languages and where Captionary runs.</p>
      <div className="lr-card">
        <Field label="Extension enabled">
          <Toggle label="Enabled" checked={s.enabled} onChange={(v) => set((st) => void (st.enabled = v))} />
        </Field>
        <Field label="I am learning" htmlFor="target" help="“Automatic” uses each video's original language.">
          <LanguageSelect id="target" allowAuto value={s.targetLanguage} onChange={(v) => set((st) => void (st.targetLanguage = v))} />
        </Field>
        <Field label="My language" htmlFor="native" help="Translations and explanations are shown in this language.">
          <LanguageSelect id="native" value={s.nativeLanguage} onChange={(v) => set((st) => void (st.nativeLanguage = v))} />
        </Field>
        <Field label="My level" help="AI explanations are pitched at this level.">
          <select
            className="lr-select"
            value={s.learnerLevel}
            onChange={(e) => set((st) => void (st.learnerLevel = e.target.value as Settings['learnerLevel']))}
          >
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => (
              <option key={l} value={l}>
                {l} —{' '}
                {{ A1: 'beginner', A2: 'elementary', B1: 'intermediate', B2: 'upper intermediate', C1: 'advanced', C2: 'proficient' }[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="YouTube">
          <Toggle label="YouTube" checked={s.sites.youtube} onChange={(v) => set((st) => void (st.sites.youtube = v))} />
        </Field>
        <Field label="Netflix">
          <Toggle label="Netflix" checked={s.sites.netflix} onChange={(v) => set((st) => void (st.sites.netflix = v))} />
        </Field>
        <Field label="Apple TV+" help="tv.apple.com in the browser (Apple TV+ subscription titles).">
          <Toggle label="Apple TV+" checked={s.sites.appletv} onChange={(v) => set((st) => void (st.sites.appletv = v))} />
        </Field>
      </div>
    </>
  );
}

export function SubtitlesSection() {
  const [s, update] = useSettings();
  if (!s) return null;
  const set = (fn: (st: Settings) => void) => void update(fn);
  const sub = s.subtitles;
  return (
    <>
      <h1>Subtitles &amp; playback</h1>
      <div className="lr-card">
        <Field label="Show original subtitle">
          <Toggle checked={sub.showOriginal} onChange={(v) => set((st) => void (st.subtitles.showOriginal = v))} />
        </Field>
        <Field label="Show translation">
          <Toggle checked={sub.showTranslation} onChange={(v) => set((st) => void (st.subtitles.showTranslation = v))} />
        </Field>
        <Field
          label="Show romanization"
          help="Pinyin for Chinese, romaji for Japanese kana, and romanized Korean, Russian, Ukrainian, Greek…"
        >
          <Toggle checked={sub.showRomanization} onChange={(v) => set((st) => void (st.subtitles.showRomanization = v))} />
        </Field>
        <Field
          label="Color words by frequency"
          help={
            <>
              Underlines less common words (blue 2k–8k, violet 8k–20k, orange rarer) using{' '}
              <a className="lr-link" href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener noreferrer">
                OpenSubtitles frequency lists
              </a>
              . A ~600 KB list is downloaded once per language.
            </>
          }
        >
          <Toggle checked={sub.frequencyColors} onChange={(v) => set((st) => void (st.subtitles.frequencyColors = v))} />
        </Field>
        <Field label="Blur translation" help="Hover to reveal — try to understand first.">
          <Toggle checked={sub.blurTranslation} onChange={(v) => set((st) => void (st.subtitles.blurTranslation = v))} />
        </Field>
        <Field
          label="Translation source"
          help="Automatic: a human subtitle track in your language, else the site's machine translation, else on-device translation, else your AI provider."
        >
          <select
            className="lr-select"
            value={sub.translationEngine}
            onChange={(e) =>
              set((st) => void (st.subtitles.translationEngine = e.target.value as Settings['subtitles']['translationEngine']))
            }
          >
            <option value="platform">Automatic (recommended)</option>
            <option value="chrome">On-device Chrome translation</option>
            <option value="ai">AI provider (uses requests)</option>
            <option value="none">No translation</option>
          </select>
        </Field>
        <Field label="Highlight saved words">
          <select
            className="lr-select"
            value={sub.highlight}
            onChange={(e) => set((st) => void (st.subtitles.highlight = e.target.value as Settings['subtitles']['highlight']))}
          >
            <option value="learning">Words I'm learning</option>
            <option value="all">Learning and known words</option>
            <option value="none">Don't highlight</option>
          </select>
        </Field>
        <Field label="Font size">
          <input
            type="range"
            min={14}
            max={48}
            value={sub.fontSize}
            onChange={(e) => set((st) => void (st.subtitles.fontSize = Number(e.target.value)))}
          />
          <span className="lr-kbd">{sub.fontSize}px</span>
        </Field>
        <Field label="Translation size">
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={sub.translationScale}
            onChange={(e) => set((st) => void (st.subtitles.translationScale = Number(e.target.value)))}
          />
          <span className="lr-kbd">{Math.round(sub.translationScale * 100)}%</span>
        </Field>
        <Field label="Distance from bottom">
          <input
            type="range"
            min={2}
            max={40}
            value={sub.bottomOffset}
            onChange={(e) => set((st) => void (st.subtitles.bottomOffset = Number(e.target.value)))}
          />
          <span className="lr-kbd">{sub.bottomOffset}%</span>
        </Field>
        <Field label="Hide the site's own subtitles">
          <Toggle checked={sub.hideNativeSubtitles} onChange={(v) => set((st) => void (st.subtitles.hideNativeSubtitles = v))} />
        </Field>
      </div>
      <div className="lr-card">
        <Field label="Auto-pause" help="Pause at the end of every subtitle so you can read and repeat.">
          <Toggle checked={s.playback.autoPause} onChange={(v) => set((st) => void (st.playback.autoPause = v))} />
        </Field>
        <Field label="Pause while hovering subtitles">
          <Toggle checked={s.playback.pauseOnHover} onChange={(v) => set((st) => void (st.playback.pauseOnHover = v))} />
        </Field>
        <Field label="Speed step" help="How much the slower/faster keys change the speed.">
          <NumberInput
            value={s.playback.rateStep}
            min={0.05}
            max={0.5}
            step={0.05}
            onCommit={(v) => set((st) => void (st.playback.rateStep = v))}
          />
        </Field>
        <Field label="Show subtitle list">
          <Toggle checked={s.sidebar.open} onChange={(v) => set((st) => void (st.sidebar.open = v))} />
        </Field>
        <Field label="Follow playback in the list">
          <Toggle checked={s.sidebar.autoScroll} onChange={(v) => set((st) => void (st.sidebar.autoScroll = v))} />
        </Field>
      </div>
      <div className="lr-card">
        <Field label="Wiktionary definitions" help="Free dictionary entries (definitions are in English).">
          <Toggle checked={s.dictionary.wiktionary} onChange={(v) => set((st) => void (st.dictionary.wiktionary = v))} />
        </Field>
        <Field label="Instant translation" help="Translate clicked words on-device with Chrome's built-in translator, when available.">
          <Toggle checked={s.dictionary.quickTranslate} onChange={(v) => set((st) => void (st.dictionary.quickTranslate = v))} />
        </Field>
        <Field label="Pronunciation speed">
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={s.dictionary.speechRate}
            onChange={(e) => set((st) => void (st.dictionary.speechRate = Number(e.target.value)))}
          />
          <span className="lr-kbd">{s.dictionary.speechRate.toFixed(2)}×</span>
        </Field>
      </div>
    </>
  );
}

function KeyInput({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [listening, setListening] = useState(false);
  return (
    <button
      className={`lr-btn${listening ? ' active' : ''}`}
      style={{ minWidth: 120, justifyContent: 'center' }}
      onClick={() => setListening(true)}
      onBlur={() => setListening(false)}
      onKeyDown={(e) => {
        if (!listening) return;
        e.preventDefault();
        if (e.key === 'Escape') return setListening(false);
        if (e.key === 'Backspace' || e.key === 'Delete') onChange('');
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) onChange(e.key.toLowerCase());
        setListening(false);
      }}
    >
      {listening ? (
        'Press a key…'
      ) : value ? (
        <span className="lr-kbd">{value === ' ' ? 'Space' : value.toUpperCase()}</span>
      ) : (
        <span className="lr-status">Not set</span>
      )}
    </button>
  );
}

export function ShortcutsSection() {
  const [s, update] = useSettings();
  if (!s) return null;
  const used = new Map<string, ShortcutAction[]>();
  for (const [a, k] of Object.entries(s.shortcuts) as [ShortcutAction, string][]) if (k) used.set(k, [...(used.get(k) ?? []), a]);
  return (
    <>
      <h1>Keyboard shortcuts</h1>
      <p className="lr-lead">Single keys used while watching. Click a key, then press the new key (Backspace to clear).</p>
      <div className="lr-card">
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((action) => {
          const key = s.shortcuts[action];
          const clash = key && (used.get(key)?.length ?? 0) > 1;
          return (
            <Field
              key={action}
              label={SHORTCUT_LABELS[action]}
              help={clash ? <span className="lr-error">Used by more than one action.</span> : undefined}
            >
              <KeyInput value={key} onChange={(k) => void update((st) => void (st.shortcuts[action] = k))} />
            </Field>
          );
        })}
        <div className="lr-row" style={{ marginTop: 10 }}>
          <button className="lr-btn" onClick={() => void update((st) => void (st.shortcuts = { ...DEFAULT_SHORTCUTS }))}>
            Restore defaults
          </button>
          <span className="lr-status">
            Esc closes the pop-up. Alt+L opens the AI side panel (change it at chrome://extensions/shortcuts).
          </span>
        </div>
      </div>
    </>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file.text().then(resolve);
    };
    input.click();
  });
}

export function DataSection() {
  const [message, setMessage] = useState<string | null>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportSettings = async () => {
    const ai = await getAISettings();
    // API keys live under separate storage keys and are never part of an export.
    const data = { app: 'captionary', version: 1, settings: await getSettings(), ai };
    download(`captionary-settings-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  };
  const importSettings = async () => {
    const text = await pickFile('.json,application/json');
    if (!text) return;
    try {
      const data = JSON.parse(text) as { app?: string; settings?: unknown; ai?: unknown };
      // 'language-react' is the app id of backups made before the rename to Captionary.
      if (data.app !== 'captionary' && data.app !== 'language-react') throw new Error('Not a Captionary settings file');
      if (data.settings) await settingsItem.setValue(mergeDefaults(DEFAULT_SETTINGS, data.settings));
      if (data.ai) await aiSettingsItem.setValue(mergeDefaults(await getAISettings(), data.ai));
      setMessage('Settings imported. Re-enter API keys for imported providers — keys are never exported.');
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  };
  const exportVocab = async (format: 'csv' | 'anki' | 'json') => {
    const items = await listVocab();
    if (format === 'csv') download(`captionary-words-${stamp}.csv`, `\ufeff${toCsv(items)}`, 'text/csv');
    else if (format === 'anki') download(`captionary-anki-${stamp}.txt`, toAnkiTsv(items), 'text/plain');
    else download(`captionary-words-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json');
  };
  const importWords = async () => {
    const text = await pickFile('.json,application/json');
    if (!text) return;
    try {
      const n = await importVocab(JSON.parse(text) as VocabItem[]);
      setMessage(`Imported ${n} words.`);
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  };
  const resetAll = async () => {
    if (!confirm('Delete all settings, AI providers, API keys and saved words? This cannot be undone.')) return;
    await browser.storage.local.clear();
    setMessage('Everything was reset.');
  };

  return (
    <>
      <h1>Data</h1>
      <p className="lr-lead">Back up or move your settings and saved words.</p>
      <div className="lr-card">
        <Field label="Settings" help="Exports never contain API keys.">
          <button className="lr-btn" onClick={() => void exportSettings()}>
            Export
          </button>
          <button className="lr-btn" onClick={() => void importSettings()}>
            Import
          </button>
        </Field>
        <Field label="Saved words" help="Anki: File → Import the .txt file; fields are separated by tabs and contain HTML.">
          <button className="lr-btn" onClick={() => void exportVocab('csv')}>
            CSV
          </button>
          <button className="lr-btn" onClick={() => void exportVocab('anki')}>
            Anki
          </button>
          <button className="lr-btn" onClick={() => void exportVocab('json')}>
            JSON backup
          </button>
          <button className="lr-btn" onClick={() => void importWords()}>
            Import JSON
          </button>
        </Field>
        <Field label="Reset">
          <button className="lr-btn" style={{ color: 'var(--lr-danger)' }} onClick={() => void resetAll()}>
            Delete everything
          </button>
        </Field>
      </div>
      {message && <div className="lr-note">{message}</div>}
    </>
  );
}

export function WelcomeSection({ go }: { go: (hash: string) => void }) {
  const [s, update] = useSettings();
  if (!s) return null;
  return (
    <>
      <h1>Welcome to Captionary</h1>
      <p className="lr-lead">Learn languages from the videos you already watch. Three quick steps:</p>
      <div className="lr-card">
        <div className="lr-card-head">
          <div className="title">1. Your languages</div>
        </div>
        <Field label="I am learning">
          <LanguageSelect allowAuto value={s.targetLanguage} onChange={(v) => void update((st) => void (st.targetLanguage = v))} />
        </Field>
        <Field label="My language">
          <LanguageSelect value={s.nativeLanguage} onChange={(v) => void update((st) => void (st.nativeLanguage = v))} />
        </Field>
      </div>
      <div className="lr-card">
        <div className="lr-card-head">
          <div className="title">2. Connect an AI provider (optional)</div>
          <button className="lr-btn primary" onClick={() => go('ai')}>
            Set up AI
          </button>
        </div>
        <p className="lr-status" style={{ margin: 0 }}>
          The dictionary and translations work without AI. With a provider, every word gets an explanation of what it means in that exact
          sentence, plus grammar breakdowns and a tutor you can ask follow-up questions.
        </p>
      </div>
      <div className="lr-card">
        <div className="lr-card-head">
          <div className="title">3. Open a video</div>
          <a
            className="lr-btn"
            href="https://www.youtube.com/results?search_query=easy+spanish+street+interviews"
            target="_blank"
            rel="noopener noreferrer"
          >
            Try YouTube
          </a>
        </div>
        <p className="lr-status" style={{ margin: 0 }}>
          Dual subtitles appear on the video and the full transcript in the side list. Click any word to look it up; drag across words to
          select a phrase. Keys: <span className="lr-kbd">A</span> previous line, <span className="lr-kbd">S</span> repeat,{' '}
          <span className="lr-kbd">D</span> next, <span className="lr-kbd">Q</span> auto-pause, <span className="lr-kbd">E</span> explain
          the line.
        </p>
      </div>
    </>
  );
}
