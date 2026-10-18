import { browser } from '#imports';
import { useState, type CSSProperties } from 'react';
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
import { clearCache } from '@/lib/ai/cache';
import { releaseOrigins } from '@/lib/ai/host-access';
import { clearFrequencyLists } from '@/lib/frequency';
import { importVocab, listVocab, toAnkiTsv, toCsv, type VocabItem } from '@/lib/vocab';
import { useVocabCount } from '@/ui/AppShell';
import { keyLabel, Note, PageHead, Range, Segment, Select, SettingRow, SettingsCard, Switch, type Choice } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { IconExternal, IconUpload } from '@/ui/icons';

type Update = (fn: (s: Settings) => void) => void;

function useSet(): [Settings | null, Update] {
  const [s, update] = useSettings();
  return [s, (fn) => void update(fn)];
}

const LEVELS: Choice<Settings['learnerLevel']>[] = (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => ({ value: l, label: l }));

export function GeneralSection() {
  const [s, set] = useSet();
  if (!s) return null;
  return (
    <>
      <PageHead title="General" lead="Your languages, where Captionary runs, and how look-ups work." />
      <SettingsCard title="Languages">
        <SettingRow title="I’m learning" help="“Each video’s language” follows the original audio of whatever you watch.">
          {(id) => (
            <LanguageSelect
              labelledBy={id}
              allowAuto
              value={s.targetLanguage}
              onChange={(v) => set((st) => void (st.targetLanguage = v))}
            />
          )}
        </SettingRow>
        <SettingRow title="My language" help="Translations and explanations are written in this language.">
          {(id) => <LanguageSelect labelledBy={id} value={s.nativeLanguage} onChange={(v) => set((st) => void (st.nativeLanguage = v))} />}
        </SettingRow>
        <SettingRow title="My level" help="The tutor pitches explanations at this level.">
          {(id) => (
            <Segment labelledBy={id} value={s.learnerLevel} options={LEVELS} onChange={(v) => set((st) => void (st.learnerLevel = v))} />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Where Captionary runs"
        action={<Switch label="Captionary on everywhere" checked={s.enabled} onChange={(v) => set((st) => void (st.enabled = v))} />}
      >
        <SettingRow title="YouTube">
          {(id) => <Switch labelledBy={id} checked={s.sites.youtube} onChange={(v) => set((st) => void (st.sites.youtube = v))} />}
        </SettingRow>
        <SettingRow title="Netflix">
          {(id) => <Switch labelledBy={id} checked={s.sites.netflix} onChange={(v) => set((st) => void (st.sites.netflix = v))} />}
        </SettingRow>
        <SettingRow title="Apple TV+" help="The player on tv.apple.com. Purchases and rentals don’t play on the web.">
          {(id) => <Switch labelledBy={id} checked={s.sites.appletv} onChange={(v) => set((st) => void (st.sites.appletv = v))} />}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Look-ups">
        <SettingRow title="Instant translation" help="Translate clicked words on this computer with Chrome’s built-in translator.">
          {(id) => (
            <Switch
              labelledBy={id}
              checked={s.dictionary.quickTranslate}
              onChange={(v) => set((st) => void (st.dictionary.quickTranslate = v))}
            />
          )}
        </SettingRow>
        <SettingRow title="Wiktionary definitions" help="Free dictionary entries under More. Definitions are in English.">
          {(id) => (
            <Switch labelledBy={id} checked={s.dictionary.wiktionary} onChange={(v) => set((st) => void (st.dictionary.wiktionary = v))} />
          )}
        </SettingRow>
        <SettingRow title="Pronunciation speed">
          <Range
            label="Pronunciation speed"
            min={0.5}
            max={1.5}
            step={0.05}
            value={s.dictionary.speechRate}
            format={(v) => `${Number(v.toFixed(2))}×`}
            onChange={(v) => set((st) => void (st.dictionary.speechRate = v))}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <SettingRow title="Extension pages" help="On video sites Captionary always follows the site’s own look.">
          {(id) => (
            <Segment
              labelledBy={id}
              value={s.pageTheme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(v) => set((st) => void (st.pageTheme = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>
    </>
  );
}

const PREVIEW = {
  text: ['No sé si vamos a llegar a tiempo, pero hay que ', 'intentarlo', '.'],
  translation: 'I don’t know if we’ll make it in time, but we have to try.',
};

/** A live preview of the caption settings in each host's caption style. */
function CaptionPreview({ s }: { s: Settings }) {
  const [host, setHost] = useState<'youtube-dark' | 'netflix' | 'appletv'>('youtube-dark');
  const sub = s.subtitles;
  // The frame is about 760px wide; captions are tuned for a 1000px player.
  const size = Math.round(sub.fontSize * 0.85);
  const captions: CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: `${sub.bottomOffset}%`,
    transform: 'translateX(-50%)',
    width: 'max-content',
    maxWidth: '92%',
  };
  return (
    <SettingsCard
      title="Preview"
      style={{ overflow: 'hidden' }}
      action={
        <Segment
          label="Preview as"
          value={host}
          options={[
            { value: 'youtube-dark', label: 'YouTube' },
            { value: 'netflix', label: 'Netflix' },
            { value: 'appletv', label: 'Apple TV+' },
          ]}
          onChange={setHost}
        />
      }
    >
      <div className="cap-preview-frame" data-theme={host} aria-hidden="true">
        <div className="cap-captions" style={captions}>
          {sub.showOriginal && (
            <div className="cap-cap" style={{ fontSize: size }}>
              {PREVIEW.text[0]}
              <span className={sub.highlight === 'none' ? 'cap-w' : 'cap-w is-learn'}>{PREVIEW.text[1]}</span>
              {PREVIEW.text[2]}
            </div>
          )}
          {sub.showTranslation && (
            <div
              className={`cap-cap cap-cap--tr${sub.blurTranslation ? ' is-blurred' : ''}`}
              style={{ fontSize: Math.round(size * sub.translationScale) }}
            >
              {PREVIEW.translation}
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}

const ENGINE_OPTIONS = [
  {
    value: 'platform',
    label: 'The site’s auto-translate',
    meta: 'then on-device',
    text: 'The site’s auto-translate, then on-device, then the tutor',
  },
  { value: 'chrome', label: 'On-device translation', meta: 'Chrome', text: 'On-device translation (Chrome)' },
  { value: 'ai', label: 'The tutor', meta: 'uses requests', text: 'The tutor (AI provider, uses requests)' },
  { value: 'none', label: 'No translation' },
] as const;

export function SubtitlesSection() {
  const [s, set] = useSet();
  if (!s) return null;
  const sub = s.subtitles;
  const keys = s.shortcuts;
  const steps = [0.1, 0.25].includes(s.playback.rateStep) ? [0.1, 0.25] : [0.1, 0.25, s.playback.rateStep].sort((a, b) => a - b);
  const k = (key: string) => key && <span className="cap-kbd">{keyLabel(key)}</span>;
  return (
    <>
      <PageHead title="Subtitles & playback" lead="How captions look on the video and how playback helps you follow along." />
      <CaptionPreview s={s} />

      <SettingsCard title="On the video">
        <SettingRow title={<>Original subtitle {k(keys.toggleOriginal)}</>}>
          {(id) => (
            <Switch labelledBy={id} checked={sub.showOriginal} onChange={(v) => set((st) => void (st.subtitles.showOriginal = v))} />
          )}
        </SettingRow>
        <SettingRow title={<>Translation {k(keys.toggleTranslation)}</>}>
          {(id) => (
            <Switch labelledBy={id} checked={sub.showTranslation} onChange={(v) => set((st) => void (st.subtitles.showTranslation = v))} />
          )}
        </SettingRow>
        <SettingRow title="Romanization" help="Pinyin, romaji or Latin letters under Chinese, Japanese, Korean, Russian, Greek and more.">
          {(id) => (
            <Switch
              labelledBy={id}
              checked={sub.showRomanization}
              onChange={(v) => set((st) => void (st.subtitles.showRomanization = v))}
            />
          )}
        </SettingRow>
        <SettingRow title="Blur translation until hover" help="Try to understand first, then check.">
          {(id) => (
            <Switch labelledBy={id} checked={sub.blurTranslation} onChange={(v) => set((st) => void (st.subtitles.blurTranslation = v))} />
          )}
        </SettingRow>
        <SettingRow title="Underline saved words">
          {(id) => (
            <Segment
              labelledBy={id}
              value={sub.highlight}
              options={[
                { value: 'learning', label: 'Learning' },
                { value: 'all', label: 'All saved' },
                { value: 'none', label: 'None' },
              ]}
              onChange={(v) => set((st) => void (st.subtitles.highlight = v))}
            />
          )}
        </SettingRow>
        <SettingRow
          title="Colour words by frequency"
          help={
            <>
              Underlines rarer words in three colours. Downloads a word list once per language from the{' '}
              <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener noreferrer">
                OpenSubtitles frequency lists
              </a>
              .
            </>
          }
        >
          {(id) => (
            <Switch labelledBy={id} checked={sub.frequencyColors} onChange={(v) => set((st) => void (st.subtitles.frequencyColors = v))} />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Size and position">
        <SettingRow title="Text size" help="At a 1000-pixel-wide player; scales with the player.">
          <Range
            label="Text size"
            min={14}
            max={48}
            value={sub.fontSize}
            format={(v) => `${v} px`}
            onChange={(v) => set((st) => void (st.subtitles.fontSize = v))}
          />
        </SettingRow>
        <SettingRow title="Translation size">
          <Range
            label="Translation size"
            min={0.5}
            max={1.2}
            step={0.05}
            value={sub.translationScale}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set((st) => void (st.subtitles.translationScale = v))}
          />
        </SettingRow>
        <SettingRow title="Distance from the bottom">
          <Range
            label="Distance from the bottom"
            min={2}
            max={40}
            value={sub.bottomOffset}
            format={(v) => `${v}%`}
            onChange={(v) => set((st) => void (st.subtitles.bottomOffset = v))}
          />
        </SettingRow>
        <SettingRow title="Hide the site’s own subtitles">
          {(id) => (
            <Switch
              labelledBy={id}
              checked={sub.hideNativeSubtitles}
              onChange={(v) => set((st) => void (st.subtitles.hideNativeSubtitles = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Translation">
        <SettingRow
          title="When the video has no subtitles in your language"
          help="A human subtitle track is always used first when there is one."
        >
          {(id) => (
            <Select
              labelledBy={id}
              style={{ minWidth: 260 }}
              value={sub.translationEngine}
              options={[...ENGINE_OPTIONS]}
              onChange={(v) => set((st) => void (st.subtitles.translationEngine = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Playback and the subtitle list">
        <SettingRow
          title={<>Pause after each line {k(keys.toggleAutoPause)}</>}
          help="Stops at the end of every subtitle so you can read and repeat."
        >
          {(id) => (
            <Switch labelledBy={id} checked={s.playback.autoPause} onChange={(v) => set((st) => void (st.playback.autoPause = v))} />
          )}
        </SettingRow>
        <SettingRow title="Pause while the pointer is on the subtitles">
          {(id) => (
            <Switch labelledBy={id} checked={s.playback.pauseOnHover} onChange={(v) => set((st) => void (st.playback.pauseOnHover = v))} />
          )}
        </SettingRow>
        <SettingRow
          title={
            <>
              Speed step {k(keys.slower)} {k(keys.faster)}
            </>
          }
        >
          {(id) => (
            <Segment
              labelledBy={id}
              value={s.playback.rateStep}
              options={steps.map((v) => ({ value: v, label: `${v}×` }))}
              onChange={(v) => set((st) => void (st.playback.rateStep = v))}
            />
          )}
        </SettingRow>
        <SettingRow
          title={<>Show the subtitle list {k(keys.toggleSidebar)}</>}
          help="In YouTube’s side column. In fullscreen, on Netflix and on Apple TV+ it opens as a drawer with the same key."
        >
          {(id) => <Switch labelledBy={id} checked={s.sidebar.open} onChange={(v) => set((st) => void (st.sidebar.open = v))} />}
        </SettingRow>
        <SettingRow title="Follow playback in the list">
          {(id) => (
            <Switch labelledBy={id} checked={s.sidebar.autoScroll} onChange={(v) => set((st) => void (st.sidebar.autoScroll = v))} />
          )}
        </SettingRow>
      </SettingsCard>
    </>
  );
}

/** Keys the sites use themselves (YouTube and Netflix); Captionary leaves them alone by default. */
const SITE_KEYS = new Set(['t', 'f', 'j', 'k', 'l', 'c', 'm', 'i', ' ']);
const KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

function KeyButton({
  action,
  value,
  clashWith,
  onChange,
}: {
  action: ShortcutAction;
  value: string;
  clashWith?: ShortcutAction;
  onChange: (k: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const label = SHORTCUT_LABELS[action];
  const state = value ? `${keyLabel(value)}${clashWith ? `, clashes with ${SHORTCUT_LABELS[clashWith]}` : ''}` : 'unassigned';
  return (
    <button
      className={`cap-kbd cap-kbd--lg${listening ? ' is-listening' : ''}${clashWith ? ' is-clash' : ''}${value ? '' : ' is-empty'}`}
      aria-label={`${label}: ${state}. Press to change`}
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
      {listening ? 'Press a key…' : value ? keyLabel(value) : '—'}
    </button>
  );
}

const KEY_GROUPS: { title: string; rows: (ShortcutAction | [ShortcutAction, ShortcutAction])[] }[] = [
  { title: 'Moving between lines', rows: ['prevLine', 'repeatLine', 'nextLine', 'toggleAutoPause', 'togglePlay', ['slower', 'faster']] },
  { title: 'What you see', rows: ['toggleTranslation', 'toggleOriginal', 'toggleSidebar'] },
  { title: 'Learning', rows: ['explainLine', 'saveLine'] },
];

export function ShortcutsSection() {
  const [s, set] = useSet();
  if (!s) return null;
  const used = new Map<string, ShortcutAction[]>();
  for (const [a, k] of Object.entries(s.shortcuts) as [ShortcutAction, string][]) if (k) used.set(k, [...(used.get(k) ?? []), a]);
  const clash = (a: ShortcutAction) => {
    const key = s.shortcuts[a];
    return key ? used.get(key)?.find((other) => other !== a) : undefined;
  };
  const assign = (a: ShortcutAction) => (k: string) => set((st) => void (st.shortcuts[a] = k));
  return (
    <>
      <PageHead
        title="Keyboard shortcuts"
        lead="Single keys that work while a video plays. Click a key, then press the new one; Backspace clears it."
      >
        <button className="cap-btn cap-btn--lg" onClick={() => set((st) => void (st.shortcuts = { ...DEFAULT_SHORTCUTS }))}>
          Restore defaults
        </button>
      </PageHead>

      <section className="cap-card" aria-label="Keys in use" style={{ overflowX: 'auto' }}>
        <div className="cap-keymap" aria-hidden="true">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="cap-keymap__row" style={{ paddingLeft: i * 16 }}>
              {row.map((key) => (
                <span key={key} className={`cap-key${used.has(key) ? ' is-on' : SITE_KEYS.has(key) ? ' is-site' : ''}`}>
                  {key.toUpperCase()}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="cap-row" style={{ gap: 16, padding: '0 18px 14px', fontSize: 12.5, color: 'var(--ink-subtle)' }}>
          <span className="cap-row" style={{ gap: 6 }}>
            <span className="cap-key cap-key--legend is-on" />
            Captionary
          </span>
          <span className="cap-row" style={{ gap: 6 }}>
            <span className="cap-key cap-key--legend is-site" />
            Kept free for the site’s own keys
          </span>
        </div>
      </section>

      {KEY_GROUPS.map((group) => (
        <SettingsCard key={group.title} title={group.title}>
          {group.rows.map((row) => {
            if (Array.isArray(row)) {
              const [a, b] = row;
              return (
                <SettingRow key={a} title="Slower · faster">
                  <KeyButton action={a} value={s.shortcuts[a]} clashWith={clash(a)} onChange={assign(a)} />
                  <KeyButton action={b} value={s.shortcuts[b]} clashWith={clash(b)} onChange={assign(b)} />
                </SettingRow>
              );
            }
            const other = clash(row);
            const help = other ? (
              <span style={{ color: 'var(--danger)' }}>
                {keyLabel(s.shortcuts[row])} is already {SHORTCUT_LABELS[other]}. Pick another key.
              </span>
            ) : row === 'togglePlay' && !s.shortcuts[row] ? (
              'Unassigned: the site’s Space and K already do this.'
            ) : undefined;
            return (
              <SettingRow key={row} title={SHORTCUT_LABELS[row]} help={help}>
                <KeyButton action={row} value={s.shortcuts[row]} clashWith={other} onChange={assign(row)} />
              </SettingRow>
            );
          })}
        </SettingsCard>
      ))}

      <p className="cap-help" style={{ margin: 0 }}>
        Esc closes the look-up. Alt+L opens the AI tutor; change it at chrome://extensions/shortcuts.
      </p>
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

function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file.text().then((text) => resolve({ name: file.name, text }));
    };
    input.click();
  });
}

export function DataSection() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const count = useVocabCount();
  const stamp = new Date().toISOString().slice(0, 10);

  const exportSettings = async () => {
    const ai = await getAISettings();
    // API keys live under separate storage keys and are never part of an export.
    const data = { app: 'captionary', version: 1, settings: await getSettings(), ai };
    download(`captionary-settings-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  };
  const importSettings = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const data = JSON.parse(file.text) as { app?: string; settings?: unknown; ai?: unknown };
      // 'language-react' is the app id of backups made before the rename to Captionary.
      if (data.app !== 'captionary' && data.app !== 'language-react') throw new Error('This is not a Captionary settings file.');
      if (data.settings) await settingsItem.setValue(mergeDefaults(DEFAULT_SETTINGS, data.settings));
      if (data.ai) await aiSettingsItem.setValue(mergeDefaults(await getAISettings(), data.ai));
      setMessage({
        ok: true,
        text: `Imported settings from ${file.name}. Enter the API keys again under AI providers: exports never contain them.`,
      });
    } catch (err) {
      setMessage({ ok: false, text: `The import failed: ${(err as Error).message}` });
    }
  };
  const exportVocab = async (format: 'csv' | 'anki' | 'json') => {
    const items = await listVocab();
    if (format === 'csv') download(`captionary-words-${stamp}.csv`, `﻿${toCsv(items)}`, 'text/csv');
    else if (format === 'anki') download(`captionary-anki-${stamp}.txt`, toAnkiTsv(items), 'text/plain');
    else download(`captionary-words-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json');
  };
  const importWords = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const n = await importVocab(JSON.parse(file.text) as VocabItem[]);
      setMessage({ ok: true, text: `Imported ${n} words from ${file.name}.` });
    } catch (err) {
      setMessage({ ok: false, text: `The import failed: ${(err as Error).message}` });
    }
  };
  const resetAll = async () => {
    // Everything the privacy policy lists: storage, the AI answer and word-frequency caches,
    // and access to AI services (no connection needs it once settings are gone).
    await Promise.all([browser.storage.local.clear(), browser.storage.session.clear(), clearCache(), clearFrequencyLists()]);
    await releaseOrigins((await browser.permissions.getAll()).origins ?? []);
    setConfirming(false);
    setMessage({ ok: true, text: 'Everything was deleted. Captionary starts fresh.' });
  };

  return (
    <>
      <PageHead
        title="Data & backup"
        lead="Everything Captionary keeps lives in this browser. Back it up or move it to another computer."
      />
      <SettingsCard title="Saved words" action={count !== null && <span className="cap-tag">{count} items</span>}>
        <SettingRow
          title="Export"
          help="Anki: File → Import the .txt file. Fields are separated by tabs and the sentence has the word in bold."
        >
          <button className="cap-btn" onClick={() => void exportVocab('csv')}>
            CSV
          </button>
          <button className="cap-btn" onClick={() => void exportVocab('anki')}>
            Anki
          </button>
          <button className="cap-btn" onClick={() => void exportVocab('json')}>
            JSON backup
          </button>
        </SettingRow>
        <SettingRow title="Import a JSON backup" help="Words in the file replace saved copies of the same words; everything else is kept.">
          <button className="cap-btn" onClick={() => void importWords()}>
            <IconUpload className="cap-ico" />
            Choose file
          </button>
        </SettingRow>
      </SettingsCard>

      {message && <Note tone={message.ok ? 'success' : 'danger'}>{message.text}</Note>}

      <SettingsCard title="Settings">
        <SettingRow
          title="Export or import settings"
          help="Includes providers and prompts but never API keys; enter keys again after importing."
        >
          <button className="cap-btn" onClick={() => void exportSettings()}>
            Export
          </button>
          <button className="cap-btn" onClick={() => void importSettings()}>
            Import
          </button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Start over" style={confirming ? { borderColor: 'var(--danger)' } : undefined}>
        {confirming ? (
          <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0 }}>
              Delete all settings, AI providers, API keys, ChatGPT sign-ins, cached answers and <strong>{count ?? 0} saved words</strong>{' '}
              from this browser? This can’t be undone. Export a backup first if you might want them back.
            </p>
            <div className="cap-row">
              <button className="cap-btn cap-btn--danger-fill" onClick={() => void resetAll()}>
                Delete everything
              </button>
              <button className="cap-btn cap-btn--ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <SettingRow title="Delete everything" help="Settings, AI providers, API keys, sign-ins, cached answers and saved words.">
            <button className="cap-btn cap-btn--danger" onClick={() => setConfirming(true)}>
              Delete everything…
            </button>
          </SettingRow>
        )}
      </SettingsCard>
    </>
  );
}

export function WelcomeSection() {
  const [s] = useSet();
  if (!s) return null;
  const keys = s.shortcuts;
  const key = (k: string) => <span className="cap-kbd">{keyLabel(k)}</span>;
  return (
    <>
      <PageHead
        title="Get started"
        lead="The setup guide takes you through Captionary one question at a time: your languages, the toolbar icon, an optional AI tutor and a short practice."
      >
        <a className="cap-btn cap-btn--primary cap-btn--lg" href="/welcome.html#hello">
          Open the setup guide
        </a>
      </PageHead>
      <section className="cap-card cap-steps" aria-labelledby="welcome-video">
        <div className="cap-step">
          <div className="cap-step__body" style={{ flexBasis: 300 }}>
            <h2 className="cap-h2" id="welcome-video">
              On a video
            </h2>
            <p className="cap-step__text">
              Captions show both languages. Click a word to look it up; drag across words, or Shift+click another word, for a phrase. Find
              Captionary in the player’s control bar.
            </p>
            <div className="cap-row" style={{ gap: '6px 12px', fontSize: 13.5, color: 'var(--ink-muted)' }}>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.prevLine)}
                {key(keys.repeatLine)}
                {key(keys.nextLine)} previous · repeat · next
              </span>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.toggleAutoPause)} pause after each line
              </span>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.explainLine)} explain the line
              </span>
            </div>
            <div className="cap-row">
              <a
                className="cap-btn"
                href="https://www.youtube.com/results?search_query=easy+spanish+street+interviews"
                target="_blank"
                rel="noopener noreferrer"
              >
                Try a YouTube video
                <IconExternal className="cap-ico" />
              </a>
            </div>
          </div>
          <div className="cap-step__preview" aria-hidden="true">
            <div className="cap-captions" data-theme="youtube-dark" style={{ gap: 2 }}>
              <div className="cap-cap" style={{ fontSize: 13 }}>
                Pues vámonos <span className="cap-w is-learn">ya</span>.
              </div>
              <div className="cap-cap cap-cap--tr" style={{ fontSize: 11 }}>
                Then let’s go now.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
