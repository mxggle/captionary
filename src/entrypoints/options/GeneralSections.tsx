import { browser } from '#imports';
import { useState, type CSSProperties } from 'react';
import { UI_LANGUAGE_OPTIONS, useI18n } from '@/lib/i18n';
import {
  aiSettingsItem,
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  getAISettings,
  getSettings,
  mergeDefaults,
  settingsItem,
  type Settings,
  type ShortcutAction,
  type UILanguage,
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
  const { m } = useI18n(s);
  if (!s) return null;
  const g = m.options.general;
  const uiLangOptions = [
    { value: 'auto' as UILanguage, label: g.uiLanguageAuto },
    ...UI_LANGUAGE_OPTIONS.filter((o) => o.value !== 'auto'),
  ];
  return (
    <>
      <PageHead title={g.title} lead={g.lead} />
      <SettingsCard title={g.languagesCard}>
        <SettingRow title={g.imLearning} help={g.imLearningHelp}>
          {(id) => (
            <LanguageSelect
              labelledBy={id}
              allowAuto
              value={s.targetLanguage}
              onChange={(v) => set((st) => void (st.targetLanguage = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={g.myLanguage} help={g.myLanguageHelp}>
          {(id) => <LanguageSelect labelledBy={id} value={s.nativeLanguage} onChange={(v) => set((st) => void (st.nativeLanguage = v))} />}
        </SettingRow>
        <SettingRow title={g.myLevel} help={g.myLevelHelp}>
          {(id) => (
            <Segment labelledBy={id} value={s.learnerLevel} options={LEVELS} onChange={(v) => set((st) => void (st.learnerLevel = v))} />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title={g.whereRunsCard}
        action={<Switch label={g.captionaryOnEverywhere} checked={s.enabled} onChange={(v) => set((st) => void (st.enabled = v))} />}
      >
        <SettingRow title="YouTube">
          {(id) => <Switch labelledBy={id} checked={s.sites.youtube} onChange={(v) => set((st) => void (st.sites.youtube = v))} />}
        </SettingRow>
        <SettingRow title="Netflix">
          {(id) => <Switch labelledBy={id} checked={s.sites.netflix} onChange={(v) => set((st) => void (st.sites.netflix = v))} />}
        </SettingRow>
        <SettingRow title="Apple TV+" help={g.appleTvHelp}>
          {(id) => <Switch labelledBy={id} checked={s.sites.appletv} onChange={(v) => set((st) => void (st.sites.appletv = v))} />}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={g.lookupsCard}>
        <SettingRow title={g.instantTranslation} help={g.instantTranslationHelp}>
          {(id) => (
            <Switch
              labelledBy={id}
              checked={s.dictionary.quickTranslate}
              onChange={(v) => set((st) => void (st.dictionary.quickTranslate = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={g.wiktionary} help={g.wiktionaryHelp}>
          {(id) => (
            <Switch labelledBy={id} checked={s.dictionary.wiktionary} onChange={(v) => set((st) => void (st.dictionary.wiktionary = v))} />
          )}
        </SettingRow>
        <SettingRow title={g.pronunciationSpeed}>
          <Range
            label={g.pronunciationSpeed}
            min={0.5}
            max={1.5}
            step={0.05}
            value={s.dictionary.speechRate}
            format={(v) => `${Number(v.toFixed(2))}×`}
            onChange={(v) => set((st) => void (st.dictionary.speechRate = v))}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={g.appearanceCard}>
        <SettingRow title={g.interfaceLanguage} help={g.interfaceLanguageHelp}>
          {(id) => (
            <Select
              labelledBy={id}
              value={s.uiLanguage ?? 'auto'}
              options={uiLangOptions}
              onChange={(v) => set((st) => void (st.uiLanguage = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={g.extensionPages} help={g.extensionPagesHelp}>
          {(id) => (
            <Segment
              labelledBy={id}
              value={s.pageTheme}
              options={[
                { value: 'system', label: g.themeSystem },
                { value: 'light', label: g.themeLight },
                { value: 'dark', label: g.themeDark },
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
  const { m } = useI18n(s);
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
      title={m.options.subtitles.previewCard}
      style={{ overflow: 'hidden' }}
      action={
        <Segment
          label={m.options.subtitles.previewAs}
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
              {m.options.subtitles.previewTranslation}
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}

export function SubtitlesSection() {
  const [s, set] = useSet();
  const { m } = useI18n(s);
  if (!s) return null;
  const sub = s.subtitles;
  const keys = s.shortcuts;
  const t = m.options.subtitles;
  const engineOptions = [
    {
      value: 'platform' as const,
      label: t.enginePlatformLabel,
      meta: t.enginePlatformMeta,
      text: t.enginePlatformText,
    },
    { value: 'chrome' as const, label: t.engineChromeLabel, meta: t.engineChromeMeta, text: t.engineChromeText },
    { value: 'ai' as const, label: t.engineAiLabel, meta: t.engineAiMeta, text: t.engineAiText },
    { value: 'none' as const, label: t.engineNoneLabel },
  ];
  const steps = [0.1, 0.25].includes(s.playback.rateStep) ? [0.1, 0.25] : [0.1, 0.25, s.playback.rateStep].sort((a, b) => a - b);
  const k = (key: string) => key && <span className="cap-kbd">{keyLabel(key, m.common.space)}</span>;
  return (
    <>
      <PageHead title={t.title} lead={t.lead} />
      <CaptionPreview s={s} />

      <SettingsCard title={t.onVideoCard}>
        <SettingRow
          title={
            <>
              {t.originalSubtitle} {k(keys.toggleOriginal)}
            </>
          }
        >
          {(id) => (
            <Switch labelledBy={id} checked={sub.showOriginal} onChange={(v) => set((st) => void (st.subtitles.showOriginal = v))} />
          )}
        </SettingRow>
        <SettingRow
          title={
            <>
              {t.translation} {k(keys.toggleTranslation)}
            </>
          }
        >
          {(id) => (
            <Switch labelledBy={id} checked={sub.showTranslation} onChange={(v) => set((st) => void (st.subtitles.showTranslation = v))} />
          )}
        </SettingRow>
        <SettingRow title={t.romanization} help={t.romanizationHelp}>
          {(id) => (
            <Switch
              labelledBy={id}
              checked={sub.showRomanization}
              onChange={(v) => set((st) => void (st.subtitles.showRomanization = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={t.blurTranslation} help={t.blurTranslationHelp}>
          {(id) => (
            <Switch labelledBy={id} checked={sub.blurTranslation} onChange={(v) => set((st) => void (st.subtitles.blurTranslation = v))} />
          )}
        </SettingRow>
        <SettingRow title={t.underlineSaved}>
          {(id) => (
            <Segment
              labelledBy={id}
              value={sub.highlight}
              options={[
                { value: 'learning', label: t.highlightLearning },
                { value: 'all', label: t.highlightAll },
                { value: 'none', label: t.highlightNone },
              ]}
              onChange={(v) => set((st) => void (st.subtitles.highlight = v))}
            />
          )}
        </SettingRow>
        <SettingRow
          title={t.frequencyColors}
          help={
            <>
              {t.frequencyColorsHelpBefore}
              <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener noreferrer">
                {t.frequencyColorsLink}
              </a>
              {t.frequencyColorsHelpAfter}
            </>
          }
        >
          {(id) => (
            <Switch labelledBy={id} checked={sub.frequencyColors} onChange={(v) => set((st) => void (st.subtitles.frequencyColors = v))} />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t.sizePositionCard}>
        <SettingRow title={t.textSize} help={t.textSizeHelp}>
          <Range
            label={t.textSize}
            min={14}
            max={48}
            value={sub.fontSize}
            format={(v) => `${v} px`}
            onChange={(v) => set((st) => void (st.subtitles.fontSize = v))}
          />
        </SettingRow>
        <SettingRow title={t.translationSize}>
          <Range
            label={t.translationSize}
            min={0.5}
            max={1.2}
            step={0.05}
            value={sub.translationScale}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set((st) => void (st.subtitles.translationScale = v))}
          />
        </SettingRow>
        <SettingRow title={t.bottomDistance}>
          <Range
            label={t.bottomDistance}
            min={2}
            max={40}
            value={sub.bottomOffset}
            format={(v) => `${v}%`}
            onChange={(v) => set((st) => void (st.subtitles.bottomOffset = v))}
          />
        </SettingRow>
        <SettingRow title={t.hideNativeSubtitles}>
          {(id) => (
            <Switch
              labelledBy={id}
              checked={sub.hideNativeSubtitles}
              onChange={(v) => set((st) => void (st.subtitles.hideNativeSubtitles = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t.translationCard}>
        <SettingRow title={t.whenNoSubtitles} help={t.whenNoSubtitlesHelp}>
          {(id) => (
            <Select
              labelledBy={id}
              style={{ minWidth: 260 }}
              value={sub.translationEngine}
              options={engineOptions}
              onChange={(v) => set((st) => void (st.subtitles.translationEngine = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t.playbackCard}>
        <SettingRow
          title={
            <>
              {t.pauseAfterEachLine} {k(keys.toggleAutoPause)}
            </>
          }
          help={t.pauseAfterEachLineHelp}
        >
          {(id) => (
            <Switch labelledBy={id} checked={s.playback.autoPause} onChange={(v) => set((st) => void (st.playback.autoPause = v))} />
          )}
        </SettingRow>
        <SettingRow title={t.pauseOnHover}>
          {(id) => (
            <Switch labelledBy={id} checked={s.playback.pauseOnHover} onChange={(v) => set((st) => void (st.playback.pauseOnHover = v))} />
          )}
        </SettingRow>
        <SettingRow
          title={
            <>
              {t.speedStep} {k(keys.slower)} {k(keys.faster)}
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
          title={
            <>
              {t.showSubtitleList} {k(keys.toggleSidebar)}
            </>
          }
          help={t.showSubtitleListHelp}
        >
          {(id) => <Switch labelledBy={id} checked={s.sidebar.open} onChange={(v) => set((st) => void (st.sidebar.open = v))} />}
        </SettingRow>
        <SettingRow title={t.followPlayback}>
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
  const { m } = useI18n();
  const [listening, setListening] = useState(false);
  const label = m.shortcuts[action];
  const state = value
    ? `${keyLabel(value)}${clashWith ? m.options.shortcuts.clashesWith(m.shortcuts[clashWith]) : ''}`
    : m.options.shortcuts.unassigned;
  return (
    <button
      className={`cap-kbd cap-kbd--lg${listening ? ' is-listening' : ''}${clashWith ? ' is-clash' : ''}${value ? '' : ' is-empty'}`}
      aria-label={m.options.shortcuts.pressToChange(label, state)}
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
      {listening ? m.options.shortcuts.pressAKey : value ? keyLabel(value) : '—'}
    </button>
  );
}

export function ShortcutsSection() {
  const [s, set] = useSet();
  const { m } = useI18n(s);
  if (!s) return null;
  const sc = m.options.shortcuts;
  const keyGroups: { title: string; rows: (ShortcutAction | [ShortcutAction, ShortcutAction])[] }[] = [
    { title: sc.groupMoving, rows: ['prevLine', 'repeatLine', 'nextLine', 'toggleAutoPause', 'togglePlay', ['slower', 'faster']] },
    { title: sc.groupSeeing, rows: ['toggleTranslation', 'toggleOriginal', 'toggleSidebar'] },
    { title: sc.groupLearning, rows: ['explainLine', 'saveLine'] },
  ];
  const used = new Map<string, ShortcutAction[]>();
  for (const [a, k] of Object.entries(s.shortcuts) as [ShortcutAction, string][]) if (k) used.set(k, [...(used.get(k) ?? []), a]);
  const clash = (a: ShortcutAction) => {
    const key = s.shortcuts[a];
    return key ? used.get(key)?.find((other) => other !== a) : undefined;
  };
  const assign = (a: ShortcutAction) => (k: string) => set((st) => void (st.shortcuts[a] = k));
  return (
    <>
      <PageHead title={sc.title} lead={sc.lead}>
        <button className="cap-btn cap-btn--lg" onClick={() => set((st) => void (st.shortcuts = { ...DEFAULT_SHORTCUTS }))}>
          {sc.restoreDefaults}
        </button>
      </PageHead>

      <section className="cap-card" aria-label={sc.keysInUseAria} style={{ overflowX: 'auto' }}>
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
            {sc.keptFreeLegend}
          </span>
        </div>
      </section>

      {keyGroups.map((group) => (
        <SettingsCard key={group.title} title={group.title}>
          {group.rows.map((row) => {
            if (Array.isArray(row)) {
              const [a, b] = row;
              return (
                <SettingRow key={a} title={sc.slowerFaster}>
                  <KeyButton action={a} value={s.shortcuts[a]} clashWith={clash(a)} onChange={assign(a)} />
                  <KeyButton action={b} value={s.shortcuts[b]} clashWith={clash(b)} onChange={assign(b)} />
                </SettingRow>
              );
            }
            const other = clash(row);
            const help = other ? (
              <span style={{ color: 'var(--danger)' }}>{sc.clashHelp(keyLabel(s.shortcuts[row]), m.shortcuts[other])}</span>
            ) : row === 'togglePlay' && !s.shortcuts[row] ? (
              sc.togglePlayUnassignedHelp
            ) : undefined;
            return (
              <SettingRow key={row} title={m.shortcuts[row]} help={help}>
                <KeyButton action={row} value={s.shortcuts[row]} clashWith={other} onChange={assign(row)} />
              </SettingRow>
            );
          })}
        </SettingsCard>
      ))}

      <p className="cap-help" style={{ margin: 0 }}>
        {sc.footerHelp}
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
  const { m } = useI18n();
  const d = m.options.data;
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
      if (data.app !== 'captionary' && data.app !== 'language-react') throw new Error(d.notSettingsFileError);
      if (data.settings) await settingsItem.setValue(mergeDefaults(DEFAULT_SETTINGS, data.settings));
      if (data.ai) await aiSettingsItem.setValue(mergeDefaults(await getAISettings(), data.ai));
      setMessage({
        ok: true,
        text: d.importedSettingsMsg(file.name),
      });
    } catch (err) {
      setMessage({ ok: false, text: d.importFailedMsg((err as Error).message) });
    }
  };
  const exportVocab = async (format: 'csv' | 'anki' | 'json') => {
    const items = await listVocab();
    if (format === 'csv') download(`captionary-words-${stamp}.csv`, `\uFEFF${toCsv(items)}`, 'text/csv');
    else if (format === 'anki') download(`captionary-anki-${stamp}.txt`, toAnkiTsv(items), 'text/plain');
    else download(`captionary-words-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json');
  };
  const importWords = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const n = await importVocab(JSON.parse(file.text) as VocabItem[]);
      setMessage({ ok: true, text: d.importedWordsMsg(n, file.name) });
    } catch (err) {
      setMessage({ ok: false, text: d.importFailedMsg((err as Error).message) });
    }
  };
  const resetAll = async () => {
    // Everything the privacy policy lists: storage, the AI answer and word-frequency caches,
    // and access to AI services (no connection needs it once settings are gone).
    await Promise.all([browser.storage.local.clear(), browser.storage.session.clear(), clearCache(), clearFrequencyLists()]);
    await releaseOrigins((await browser.permissions.getAll()).origins ?? []);
    setConfirming(false);
    setMessage({ ok: true, text: d.resetDoneMsg });
  };

  return (
    <>
      <PageHead title={d.title} lead={d.lead} />
      <SettingsCard title={d.savedWordsCard} action={count !== null && <span className="cap-tag">{d.itemsCount(count)}</span>}>
        <SettingRow title={d.exportTitle} help={d.exportHelp}>
          <button className="cap-btn" onClick={() => void exportVocab('csv')}>
            CSV
          </button>
          <button className="cap-btn" onClick={() => void exportVocab('anki')}>
            Anki
          </button>
          <button className="cap-btn" onClick={() => void exportVocab('json')}>
            {d.jsonBackup}
          </button>
        </SettingRow>
        <SettingRow title={d.importTitle} help={d.importHelp}>
          <button className="cap-btn" onClick={() => void importWords()}>
            <IconUpload className="cap-ico" />
            {d.chooseFile}
          </button>
        </SettingRow>
      </SettingsCard>

      {message && <Note tone={message.ok ? 'success' : 'danger'}>{message.text}</Note>}

      <SettingsCard title={d.settingsCard}>
        <SettingRow title={d.exportImportSettings} help={d.exportImportSettingsHelp}>
          <button className="cap-btn" onClick={() => void exportSettings()}>
            {d.exportBtn}
          </button>
          <button className="cap-btn" onClick={() => void importSettings()}>
            {d.importBtn}
          </button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={d.startOverCard} style={confirming ? { borderColor: 'var(--danger)' } : undefined}>
        {confirming ? (
          <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0 }}>
              {d.confirmDeleteTextBefore}
              <strong>{d.confirmDeleteWords(count ?? 0)}</strong>
              {d.confirmDeleteTextAfter}
            </p>
            <div className="cap-row">
              <button className="cap-btn cap-btn--danger-fill" onClick={() => void resetAll()}>
                {d.deleteEverything}
              </button>
              <button className="cap-btn cap-btn--ghost" onClick={() => setConfirming(false)}>
                {m.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <SettingRow title={d.deleteEverything} help={d.deleteEverythingHelp}>
            <button className="cap-btn cap-btn--danger" onClick={() => setConfirming(true)}>
              {d.deleteEverythingEllipsis}
            </button>
          </SettingRow>
        )}
      </SettingsCard>
    </>
  );
}

export function WelcomeSection() {
  const [s] = useSet();
  const { m } = useI18n(s);
  if (!s) return null;
  const w = m.options.welcomeSection;
  const keys = s.shortcuts;
  const key = (k: string) => <span className="cap-kbd">{keyLabel(k)}</span>;
  return (
    <>
      <PageHead title={w.title} lead={w.lead}>
        <a className="cap-btn cap-btn--primary cap-btn--lg" href="/welcome.html#hello">
          {w.openGuide}
        </a>
      </PageHead>
      <section className="cap-card cap-steps" aria-labelledby="welcome-video">
        <div className="cap-step">
          <div className="cap-step__body" style={{ flexBasis: 300 }}>
            <h2 className="cap-h2" id="welcome-video">
              {w.onAVideo}
            </h2>
            <p className="cap-step__text">{w.onAVideoText}</p>
            <div className="cap-row" style={{ gap: '6px 12px', fontSize: 13.5, color: 'var(--ink-muted)' }}>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.prevLine)}
                {key(keys.repeatLine)}
                {key(keys.nextLine)} {w.prevRepeatNext}
              </span>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.toggleAutoPause)} {w.pauseAfterEachLine}
              </span>
              <span className="cap-row" style={{ gap: 4 }}>
                {key(keys.explainLine)} {w.explainTheLine}
              </span>
            </div>
            <div className="cap-row">
              <a
                className="cap-btn"
                href="https://www.youtube.com/results?search_query=easy+spanish+street+interviews"
                target="_blank"
                rel="noopener noreferrer"
              >
                {w.tryYoutube}
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
                {w.sampleTranslation}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
