import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cacheSize, clearCache } from '@/lib/ai/cache';
import { DEFAULT_PROMPTS, PROMPT_VARIABLES } from '@/lib/ai/prompts';
import { PROVIDERS } from '@/lib/ai/registry';
import { AI_TASKS, type AISettings, type AITask, type ReasoningEffort, type TaskRoute } from '@/lib/ai/types';
import { getUsage, resetUsage, usageItem, type UsageStats } from '@/lib/ai/usage';
import { useI18n } from '@/lib/i18n';
import { languageName } from '@/lib/languages';
import { DEFAULT_AI_SETTINGS } from '@/lib/settings';
import {
  Confirm,
  LabelledSwitch,
  LiveRegion,
  Note,
  PageHead,
  Range,
  Segment,
  Select,
  SettingRow,
  SettingsCard,
  Switch,
  Tabs,
  useConfirm,
} from '@/ui/controls';
import { NumberInput, useAISettings, useSettings } from '@/ui/form';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

function RouteCard({ task, ai, updateAI }: { task: AITask; ai: AISettings; updateAI: UpdateAI }) {
  const { m } = useI18n();
  const t = m.options.aiTasks;
  const route = ai.routes[task];
  const ids = { provider: useId(), model: useId(), effort: useId(), length: useId(), temp: useId() };
  const defaultConn = ai.connections.find((c) => c.id === ai.defaultConnectionId) ?? ai.connections[0];
  const conn = route.connectionId ? ai.connections.find((c) => c.id === route.connectionId) : defaultConn;
  const info = conn ? PROVIDERS[conn.kind] : undefined;
  const models = conn && info ? (conn.models.length ? conn.models : info.suggestedModels) : [];
  const set = (fn: (r: TaskRoute) => void) => void updateAI((s) => fn(s.routes[task]));
  const defaults = DEFAULT_AI_SETTINGS.routes[task];
  const customised = (Object.keys(defaults) as (keyof TaskRoute)[]).some((k) => route[k] !== defaults[k]);
  const fallbackModel = conn?.defaultModel || info?.defaultModel || '';
  const efforts: { value: ReasoningEffort; label: string }[] = [
    { value: 'default', label: t.efforts.default },
    { value: 'minimal', label: t.efforts.minimal },
    { value: 'low', label: t.efforts.low },
    { value: 'medium', label: t.efforts.medium },
    { value: 'high', label: t.efforts.high },
  ];
  return (
    <SettingsCard
      title={m.tasks[task].name}
      help={m.tasks[task].description}
      action={customised ? <span className="cap-tag cap-tag--accent">{t.customisedTag}</span> : undefined}
    >
      <div className="cap-task">
        <div className="cap-field">
          <span className="cap-label" id={ids.provider}>
            {t.providerLabel}
          </span>
          <Select
            labelledBy={ids.provider}
            value={route.connectionId ?? ''}
            options={[
              { value: '', label: m.common.default, meta: defaultConn?.label },
              ...ai.connections.map((c) => ({
                value: c.id,
                label: c.label,
                meta: c.id === defaultConn?.id ? t.defaultMeta : PROVIDERS[c.kind].local ? t.localMeta : undefined,
              })),
            ]}
            onChange={(v) =>
              set((r) => {
                r.connectionId = v || null;
                r.model = '';
              })
            }
          />
        </div>
        <div className="cap-field">
          <span className="cap-label" id={ids.model}>
            {t.modelLabel}
          </span>
          <ModelPicker
            label={t.modelLabel}
            labelledBy={ids.model}
            value={route.model}
            models={models}
            placeholder={t.providerDefaultPlaceholder(fallbackModel)}
            onCommit={(v) => set((r) => void (r.model = v))}
          />
        </div>
        <div className="cap-field">
          <span className="cap-label" id={ids.effort}>
            {t.reasoningEffort}
          </span>
          <Segment labelledBy={ids.effort} value={route.effort} options={efforts} onChange={(v) => set((r) => void (r.effort = v))} />
        </div>
        <div className="cap-field">
          <label className="cap-label" htmlFor={ids.length}>
            {t.longestAnswer}
          </label>
          <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
            <NumberInput
              id={ids.length}
              value={route.maxOutputTokens}
              min={64}
              max={32000}
              step={50}
              width={110}
              onCommit={(v) => set((r) => void (r.maxOutputTokens = v))}
            />
            <span className="cap-help">{t.tokensHelp}</span>
          </div>
        </div>
        <div className="cap-field" style={{ gridColumn: '1 / -1' }}>
          <span className="cap-label" id={ids.temp}>
            {t.temperature}
          </span>
          <div className="cap-row">
            <Segment
              labelledBy={ids.temp}
              value={route.temperature === null ? 'default' : 'custom'}
              options={[
                { value: 'default', label: t.providerDefault },
                { value: 'custom', label: t.custom },
              ]}
              onChange={(v) => set((r) => void (r.temperature = v === 'custom' ? (r.temperature ?? 0.3) : null))}
            />
            {route.temperature !== null && (
              <Range
                label={t.temperature}
                min={0}
                max={1.5}
                step={0.05}
                value={route.temperature}
                format={(v) => v.toFixed(2)}
                onChange={(v) => set((r) => void (r.temperature = v))}
              />
            )}
          </div>
          <span className="cap-help">{t.temperatureHelp}</span>
        </div>
      </div>
    </SettingsCard>
  );
}

export function AITasksSection() {
  const [ai, updateAI] = useAISettings();
  const { m } = useI18n();
  if (!ai) return null;
  const t = m.options.aiTasks;
  return (
    <>
      <PageHead title={t.title} lead={t.lead} />
      {ai.connections.length === 0 && (
        <Note tone="warn">
          {t.noProviderWarnBefore}
          <a href="#ai">{t.noProviderWarnLink}</a>
          {t.noProviderWarnAfter}
        </Note>
      )}
      {/* Without a provider nothing here takes effect yet: the cards stay readable but out of the way. */}
      <fieldset className="cap-fieldset" disabled={ai.connections.length === 0}>
        {AI_TASKS.map((task) => (
          <RouteCard key={task} task={task} ai={ai} updateAI={updateAI} />
        ))}
        <SettingsCard>
          <SettingRow title={t.fallbackProvider} help={t.fallbackProviderHelp}>
            {(id) => (
              <Select
                labelledBy={id}
                value={ai.fallbackConnectionId ?? ''}
                options={[{ value: '', label: m.common.none }, ...ai.connections.map((c) => ({ value: c.id, label: c.label }))]}
                onChange={(v) => void updateAI((s) => void (s.fallbackConnectionId = v || null))}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </fieldset>
    </>
  );
}

function UsageCard() {
  const { locale, m } = useI18n();
  const p = m.options.aiPrivacy;
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [cached, setCached] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reset = useConfirm();
  const num = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const compact = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale]);
  useEffect(() => {
    void getUsage().then(setUsage);
    void cacheSize().then(setCached);
    return usageItem.watch(() => void getUsage().then(setUsage));
  }, []);
  if (!usage) return null;
  const models = Object.entries(usage.byModel).sort((a, b) => b[1].requests - a[1].requests);
  return (
    <SettingsCard
      title={p.usageCard}
      action={
        <button className="cap-btn cap-btn--sm" ref={reset.trigger} aria-expanded={reset.open} onClick={reset.ask}>
          {p.resetCounters}
        </button>
      }
    >
      {reset.open && (
        <div className="cap-card__body">
          <Confirm
            action={p.resetCounters}
            onCancel={reset.close}
            onConfirm={() => {
              reset.close();
              void resetUsage()
                .then(() => getUsage().then(setUsage))
                .then(() => setDone(p.countersResetMsg));
            }}
          >
            {p.confirmResetCounters}
          </Confirm>
        </div>
      )}
      <div className="cap-card__body cap-stats">
        <div className="cap-stat">
          <span className="cap-stat__value">{num.format(usage.today.requests)}</span>
          <span className="cap-stat__label">{p.requestsTodayStat}</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__value">{num.format(usage.today.cacheHits)}</span>
          <span className="cap-stat__label">{p.cacheHitsTodayStat}</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__value">{compact.format(usage.total.inputTokens + usage.total.outputTokens)}</span>
          <span className="cap-stat__label">{p.tokensAllTimeStat}</span>
        </div>
      </div>
      {models.length > 0 && (
        <div className="cap-table-wrap">
          <table className="cap-table">
            <thead>
              <tr>
                <th scope="col">{p.colModel}</th>
                <th scope="col">{p.colRequests}</th>
                <th scope="col">{p.colInputTokens}</th>
                <th scope="col">{p.colOutputTokens}</th>
                <th scope="col">{p.colFromCache}</th>
              </tr>
            </thead>
            <tbody>
              {models.map(([model, c]) => (
                <tr key={model}>
                  <td className="cap-mono" style={{ fontSize: 13 }}>
                    {model}
                  </td>
                  <td>{num.format(c.requests)}</td>
                  <td>{num.format(c.inputTokens)}</td>
                  <td>{num.format(c.outputTokens)}</td>
                  <td>{num.format(c.cacheHits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cap-row" style={{ padding: '12px 18px', borderTop: models.length ? undefined : '1px solid var(--line)' }}>
        <span className="cap-help cap-spacer">{p.answersKept(cached ?? '…')}</span>
        <button
          className="cap-btn cap-btn--sm"
          onClick={() =>
            void clearCache().then(() => {
              setCached(0);
              setDone(p.answersClearedMsg);
            })
          }
        >
          {p.clearSavedAnswers}
        </button>
      </div>
      <LiveRegion className="cap-card__msg">{done && <Note tone="success">{done}</Note>}</LiveRegion>
    </SettingsCard>
  );
}

function LimitBar({ limit }: { limit: number }) {
  const { m } = useI18n();
  const p = m.options.aiPrivacy;
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    void getUsage().then((u) => setUsed(u.today.requests));
    return usageItem.watch(() => void getUsage().then((u) => setUsed(u.today.requests)));
  }, []);
  if (!limit || used === null) return null;
  const share = Math.min(1, used / limit);
  const close = share >= 0.8;
  return (
    <div className="cap-row" style={{ marginTop: 10, flexWrap: 'nowrap', maxWidth: 360 }}>
      <div
        className="cap-progress cap-spacer"
        role="progressbar"
        aria-label={p.requestsTodayAria}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <span style={{ width: `${share * 100}%`, background: close ? 'var(--warn)' : undefined }} />
      </div>
      <span
        style={{ fontSize: 13, color: close ? 'var(--warn)' : 'var(--ink-muted)', fontWeight: close ? 600 : 400, whiteSpace: 'nowrap' }}
      >
        {p.usedOfLimitToday(used, limit)}
      </span>
    </div>
  );
}

export function AIPrivacySection() {
  const [ai, updateAI] = useAISettings();
  const [settings] = useSettings();
  const { locale, m } = useI18n(settings);
  const limitId = useId();
  if (!ai || !settings) return null;
  const p = m.options.aiPrivacy;
  const set = (fn: (s: AISettings) => void) => void updateAI(fn);
  const target = settings.targetLanguage === 'auto' ? p.theVideosLanguage : languageName(settings.targetLanguage, locale);
  // With the tutor off nothing is sent, so these rows have no effect until it is on again.
  const off = !ai.enabled;
  return (
    <>
      <PageHead title={p.title} lead={p.lead} />
      <SettingsCard
        title={p.whatGetsSentCard}
        action={<LabelledSwitch label={p.tutorOn} checked={ai.enabled} onChange={(v) => set((s) => void (s.enabled = v))} />}
      >
        <SettingRow title={p.autoExplain} help={p.autoExplainHelp} disabled={off}>
          {(id) => (
            <Switch labelledBy={id} disabled={off} checked={ai.autoExplain} onChange={(v) => set((s) => void (s.autoExplain = v))} />
          )}
        </SettingRow>
        <SettingRow title={p.contextScope} help={p.contextScopeHelp} disabled={off}>
          {(id) => (
            <Segment
              labelledBy={id}
              disabled={off}
              value={ai.contextScope}
              options={[
                { value: 'word', label: p.scopeWord },
                { value: 'sentence', label: p.scopeSentence },
                { value: 'surrounding', label: p.scopeSurrounding },
              ]}
              onChange={(v) => set((s) => void (s.contextScope = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={p.shareMediaTitle} help={p.shareMediaTitleHelp} disabled={off}>
          {(id) => (
            <Switch
              labelledBy={id}
              disabled={off}
              checked={ai.shareMediaTitle}
              onChange={(v) => set((s) => void (s.shareMediaTitle = v))}
            />
          )}
        </SettingRow>
        <SettingRow title={p.explanationsIn} disabled={off}>
          {(id) => (
            <Segment
              labelledBy={id}
              disabled={off}
              value={ai.explanationLanguage}
              options={[
                { value: 'native', label: languageName(settings.nativeLanguage, locale) },
                { value: 'target', label: p.immersionConsistent(target) },
              ]}
              onChange={(v) => set((s) => void (s.explanationLanguage = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={p.limitsSpeedCard}>
        <SettingRow
          title={<label htmlFor={limitId}>{p.dailyLimit}</label>}
          help={p.dailyLimitHelp}
          below={<LimitBar limit={ai.dailyRequestLimit} />}
        >
          <NumberInput
            id={limitId}
            value={ai.dailyRequestLimit}
            min={0}
            max={100000}
            onCommit={(v) => set((s) => void (s.dailyRequestLimit = v))}
          />
        </SettingRow>
        <SettingRow title={p.reuseAnswers} help={p.reuseAnswersHelp}>
          {(id) => (
            <>
              <Switch labelledBy={id} checked={ai.cacheEnabled} onChange={(v) => set((s) => void (s.cacheEnabled = v))} />
              <span className="cap-help">{p.forDaysBefore}</span>
              <NumberInput
                label={p.daysToKeepAria}
                value={ai.cacheTtlDays}
                min={1}
                max={365}
                width={72}
                onCommit={(v) => set((s) => void (s.cacheTtlDays = v))}
              />
              <span className="cap-help">{p.forDaysAfter}</span>
            </>
          )}
        </SettingRow>
        <SettingRow title={p.streamAnswers}>
          {(id) => <Switch labelledBy={id} checked={ai.stream} onChange={(v) => set((s) => void (s.stream = v))} />}
        </SettingRow>
        <SettingRow title={p.giveUpAfter} help={p.giveUpAfterHelp}>
          <NumberInput
            label={p.timeoutAria}
            value={ai.timeoutSec}
            min={5}
            max={600}
            width={72}
            onCommit={(v) => set((s) => void (s.timeoutSec = v))}
          />
          <span className="cap-help">{p.secondsDot}</span>
          <NumberInput
            label={p.retriesAria}
            value={ai.maxRetries}
            min={0}
            max={5}
            width={60}
            onCommit={(v) => set((s) => void (s.maxRetries = v))}
          />
          <span className="cap-help">{p.retriesLabel}</span>
        </SettingRow>
      </SettingsCard>
      <UsageCard />
    </>
  );
}

/** Unsaved prompt edits, kept for the life of the page so switching tasks or sections never drops them. */
const promptDrafts: Partial<Record<AITask, string>> = {};
const warnBeforeLeaving = (e: BeforeUnloadEvent) => e.preventDefault();

function storeDraft(task: AITask, text: string | undefined) {
  if (text === undefined) delete promptDrafts[task];
  else promptDrafts[task] = text;
  // The browser asks before the page closes while an edit is unsaved.
  if (Object.keys(promptDrafts).length) window.addEventListener('beforeunload', warnBeforeLeaving);
  else window.removeEventListener('beforeunload', warnBeforeLeaving);
}

function PromptEditor({
  task,
  ai,
  updateAI,
  draft,
  onDraft,
}: {
  task: AITask;
  ai: AISettings;
  updateAI: UpdateAI;
  draft: string | undefined;
  onDraft: (text: string | undefined) => void;
}) {
  const { m } = useI18n();
  const pr = m.options.prompts;
  const custom = ai.prompts[task];
  const saved = custom ?? DEFAULT_PROMPTS[task];
  const text = draft ?? saved;
  const dirty = text !== saved;
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return onDraft(text + token);
    const start = el.selectionStart;
    onDraft(text.slice(0, start) + token + text.slice(el.selectionEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <SettingsCard
      title={m.tasks[task].name}
      help={m.tasks[task].description}
      action={custom ? <span className="cap-tag cap-tag--accent">{pr.customisedTag}</span> : undefined}
    >
      <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="cap-row" style={{ gap: 6 }}>
          <span className="cap-help">{pr.insertLabel}</span>
          {(Object.keys(PROMPT_VARIABLES) as (keyof typeof PROMPT_VARIABLES)[]).map((k) => (
            <button key={k} className="cap-var" title={pr.vars[k] ?? PROMPT_VARIABLES[k]} onClick={() => insert(k)}>
              {`{{${k}}}`}
            </button>
          ))}
        </div>
        <label className="cap-sr" htmlFor={id}>
          {pr.promptForAria(m.tasks[task].name.toLowerCase())}
        </label>
        <textarea
          id={id}
          ref={ref}
          className="cap-input"
          style={{ minHeight: 300 }}
          value={text}
          onChange={(e) => onDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="cap-row">
          {/* aria-disabled, not disabled: pressing either one disables it, and a disabled button drops focus. */}
          <button
            className="cap-btn cap-btn--primary"
            aria-disabled={!dirty}
            onClick={() => {
              if (!dirty) return;
              void updateAI((s) => void (s.prompts[task] = text === DEFAULT_PROMPTS[task] ? undefined : text)).then(() =>
                onDraft(undefined),
              );
            }}
          >
            {m.common.save}
          </button>
          <button
            className="cap-btn cap-btn--ghost"
            aria-disabled={!custom && !dirty}
            // The draft goes too: a prompt that was never customised has nothing saved to delete.
            onClick={() => {
              if (!custom && !dirty) return;
              void updateAI((s) => void delete s.prompts[task]).then(() => onDraft(undefined));
            }}
          >
            {pr.resetToDefault}
          </button>
          <span className="cap-spacer" />
          {dirty && <span className="cap-help">{pr.unsavedChanges}</span>}
        </div>
      </div>
    </SettingsCard>
  );
}

export function PromptsSection() {
  const [ai, updateAI] = useAISettings();
  const { m } = useI18n();
  const [task, setTask] = useState<AITask>('word');
  const [drafts, setDrafts] = useState(() => ({ ...promptDrafts }));
  if (!ai) return null;
  const pr = m.options.prompts;
  const saved = (t: AITask) => ai.prompts[t] ?? DEFAULT_PROMPTS[t];
  const setDraft = (t: AITask) => (text: string | undefined) => {
    storeDraft(t, text === saved(t) ? undefined : text);
    setDrafts({ ...promptDrafts });
  };
  const dirty = (t: AITask) => drafts[t] !== undefined && drafts[t] !== saved(t);
  return (
    <>
      <PageHead title={pr.title} lead={pr.lead} />
      <Note tone="plain">
        {pr.contextNoteBefore}
        <span className="cap-mono">&lt;context&gt;</span>
        {pr.contextNoteAfter}
      </Note>
      <Tabs
        label={pr.taskLabel}
        value={task}
        options={AI_TASKS.map((t) => ({
          value: t,
          label: (
            <>
              {m.tasks[t].name}
              {dirty(t) && (
                <>
                  <span className="cap-tabs__dot" aria-hidden="true" />
                  <span className="cap-sr"> ({pr.unsavedChanges})</span>
                </>
              )}
            </>
          ),
        }))}
        onChange={setTask}
      >
        <PromptEditor key={task} task={task} ai={ai} updateAI={updateAI} draft={drafts[task]} onDraft={setDraft(task)} />
      </Tabs>
    </>
  );
}
