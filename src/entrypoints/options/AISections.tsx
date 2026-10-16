import { useEffect, useId, useRef, useState } from 'react';
import { cacheSize, clearCache } from '@/lib/ai/cache';
import { DEFAULT_PROMPTS, PROMPT_VARIABLES } from '@/lib/ai/prompts';
import { PROVIDERS } from '@/lib/ai/registry';
import { AI_TASKS, type AISettings, type AITask, type ReasoningEffort, type TaskRoute } from '@/lib/ai/types';
import { getUsage, resetUsage, usageItem, type UsageStats } from '@/lib/ai/usage';
import { languageName } from '@/lib/languages';
import { TASK_LABELS } from '@/lib/settings';
import { Note, PageHead, Range, Segment, Select, SettingRow, SettingsCard, Switch } from '@/ui/controls';
import { NumberInput, useAISettings, useSettings } from '@/ui/form';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

const EFFORTS: { value: ReasoningEffort; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function RouteCard({ task, ai, updateAI }: { task: AITask; ai: AISettings; updateAI: UpdateAI }) {
  const route = ai.routes[task];
  const ids = { provider: useId(), model: useId(), effort: useId(), length: useId(), temp: useId() };
  const defaultConn = ai.connections.find((c) => c.id === ai.defaultConnectionId) ?? ai.connections[0];
  const conn = route.connectionId ? ai.connections.find((c) => c.id === route.connectionId) : defaultConn;
  const info = conn ? PROVIDERS[conn.kind] : undefined;
  const models = conn && info ? (conn.models.length ? conn.models : info.suggestedModels) : [];
  const set = (fn: (r: TaskRoute) => void) => void updateAI((s) => fn(s.routes[task]));
  const usesDefault = !route.connectionId && !route.model;
  const fallbackModel = conn?.defaultModel || info?.defaultModel || '';
  return (
    <SettingsCard
      title={TASK_LABELS[task].name}
      help={TASK_LABELS[task].description}
      action={usesDefault ? <span className="cap-tag">Uses default</span> : undefined}
    >
      <div className="cap-task">
        <div className="cap-field">
          <span className="cap-label" id={ids.provider}>
            Provider
          </span>
          <Select
            labelledBy={ids.provider}
            value={route.connectionId ?? ''}
            options={[
              { value: '', label: 'Default', meta: defaultConn?.label },
              ...ai.connections.map((c) => ({
                value: c.id,
                label: c.label,
                meta: c.id === defaultConn?.id ? 'default' : PROVIDERS[c.kind].local ? 'local' : undefined,
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
            Model
          </span>
          <ModelPicker
            label="Model"
            labelledBy={ids.model}
            value={route.model}
            models={models}
            placeholder={fallbackModel ? `Provider default · ${fallbackModel}` : 'Provider default'}
            onCommit={(v) => set((r) => void (r.model = v))}
          />
        </div>
        <div className="cap-field">
          <span className="cap-label" id={ids.effort}>
            Reasoning effort
          </span>
          <Segment labelledBy={ids.effort} value={route.effort} options={EFFORTS} onChange={(v) => set((r) => void (r.effort = v))} />
        </div>
        <div className="cap-field">
          <label className="cap-label" htmlFor={ids.length}>
            Longest answer
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
            <span className="cap-help">tokens, plus room for thinking on reasoning models</span>
          </div>
        </div>
        <div className="cap-field" style={{ gridColumn: '1 / -1' }}>
          <span className="cap-label" id={ids.temp}>
            Temperature
          </span>
          <div className="cap-row">
            <Segment
              labelledBy={ids.temp}
              value={route.temperature === null ? 'default' : 'custom'}
              options={[
                { value: 'default', label: 'Provider default' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={(v) => set((r) => void (r.temperature = v === 'custom' ? (r.temperature ?? 0.3) : null))}
            />
            {route.temperature !== null && (
              <Range
                label="Temperature"
                min={0}
                max={1.5}
                step={0.05}
                value={route.temperature}
                format={(v) => v.toFixed(2)}
                onChange={(v) => set((r) => void (r.temperature = v))}
              />
            )}
          </div>
          <span className="cap-help">Several current models refuse custom values; a refused setting is retried once without it.</span>
        </div>
      </div>
    </SettingsCard>
  );
}

export function AITasksSection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;
  return (
    <>
      <PageHead
        title="Models per task"
        lead="Quick look-ups feel best on a fast model; grammar breakdowns and follow-up questions do better on a stronger one."
      />
      {ai.connections.length === 0 && (
        <Note tone="warn">
          Add a provider first under <a href="#ai">AI providers</a>.
        </Note>
      )}
      {AI_TASKS.map((t) => (
        <RouteCard key={t} task={t} ai={ai} updateAI={updateAI} />
      ))}
      <SettingsCard>
        <SettingRow
          title="Fallback provider"
          help="When the main provider is down, rate-limited or out of credit, the request is tried once here."
        >
          {(id) => (
            <Select
              labelledBy={id}
              value={ai.fallbackConnectionId ?? ''}
              options={[{ value: '', label: 'None' }, ...ai.connections.map((c) => ({ value: c.id, label: c.label }))]}
              onChange={(v) => void updateAI((s) => void (s.fallbackConnectionId = v || null))}
            />
          )}
        </SettingRow>
      </SettingsCard>
    </>
  );
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function UsageCard() {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [cached, setCached] = useState<number | null>(null);
  useEffect(() => {
    void getUsage().then(setUsage);
    void cacheSize().then(setCached);
    return usageItem.watch(() => void getUsage().then(setUsage));
  }, []);
  if (!usage) return null;
  const models = Object.entries(usage.byModel).sort((a, b) => b[1].requests - a[1].requests);
  return (
    <SettingsCard
      title="Usage"
      action={
        <button className="cap-btn cap-btn--sm" onClick={() => void resetUsage().then(() => getUsage().then(setUsage))}>
          Reset counters
        </button>
      }
    >
      <div className="cap-card__body cap-stats">
        <div className="cap-stat">
          <span className="cap-stat__value">{usage.today.requests}</span>
          <span className="cap-stat__label">requests today</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__value">{usage.today.cacheHits}</span>
          <span className="cap-stat__label">answered from this computer today</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__value">{compact.format(usage.total.inputTokens + usage.total.outputTokens)}</span>
          <span className="cap-stat__label">tokens all time</span>
        </div>
      </div>
      {models.length > 0 && (
        <div className="cap-table-wrap">
          <table className="cap-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Requests</th>
                <th scope="col">Input tokens</th>
                <th scope="col">Output tokens</th>
                <th scope="col">From cache</th>
              </tr>
            </thead>
            <tbody>
              {models.map(([m, c]) => (
                <tr key={m}>
                  <td className="cap-mono" style={{ fontSize: 13 }}>
                    {m}
                  </td>
                  <td>{c.requests.toLocaleString()}</td>
                  <td>{c.inputTokens.toLocaleString()}</td>
                  <td>{c.outputTokens.toLocaleString()}</td>
                  <td>{c.cacheHits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cap-row" style={{ padding: '12px 18px', borderTop: models.length ? undefined : '1px solid var(--line)' }}>
        <span className="cap-help cap-spacer">{cached ?? '…'} answers kept on this computer.</span>
        <button className="cap-btn cap-btn--sm" onClick={() => void clearCache().then(() => setCached(0))}>
          Clear saved answers
        </button>
      </div>
    </SettingsCard>
  );
}

function LimitBar({ limit }: { limit: number }) {
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
        aria-label="Requests today"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <span style={{ width: `${share * 100}%`, background: close ? 'var(--warn)' : undefined }} />
      </div>
      <span
        style={{ fontSize: 13, color: close ? 'var(--warn)' : 'var(--ink-muted)', fontWeight: close ? 600 : 400, whiteSpace: 'nowrap' }}
      >
        {used} of {limit} today
      </span>
    </div>
  );
}

export function AIPrivacySection() {
  const [ai, updateAI] = useAISettings();
  const [settings] = useSettings();
  const limitId = useId();
  if (!ai || !settings) return null;
  const set = (fn: (s: AISettings) => void) => void updateAI(fn);
  const target = settings.targetLanguage === 'auto' ? 'The video’s language' : languageName(settings.targetLanguage);
  return (
    <>
      <PageHead title="Privacy & cost" lead="What is sent to the tutor, how often, and what it costs." />
      <SettingsCard
        title="What gets sent"
        action={<Switch label="Tutor on" checked={ai.enabled} onChange={(v) => set((s) => void (s.enabled = v))} />}
      >
        <SettingRow
          title="Explain words automatically"
          help="Off: the tutor answers only when you press Explain. On: every clicked word sends a request."
        >
          {(id) => <Switch labelledBy={id} checked={ai.autoExplain} onChange={(v) => set((s) => void (s.autoExplain = v))} />}
        </SettingRow>
        <SettingRow title="Context sent with a look-up" help="More context, better explanations of meaning in context.">
          {(id) => (
            <Segment
              labelledBy={id}
              value={ai.contextScope}
              options={[
                { value: 'word', label: 'The word' },
                { value: 'sentence', label: 'Its sentence' },
                { value: 'surrounding', label: '± 2 lines' },
              ]}
              onChange={(v) => set((s) => void (s.contextScope = v))}
            />
          )}
        </SettingRow>
        <SettingRow title="Share the video or page title" help="Helps with names and topic-specific meanings.">
          {(id) => <Switch labelledBy={id} checked={ai.shareMediaTitle} onChange={(v) => set((s) => void (s.shareMediaTitle = v))} />}
        </SettingRow>
        <SettingRow title="Explanations written in">
          {(id) => (
            <Segment
              labelledBy={id}
              value={ai.explanationLanguage}
              options={[
                { value: 'native', label: languageName(settings.nativeLanguage) },
                { value: 'target', label: `${target} (immersion)` },
              ]}
              onChange={(v) => set((s) => void (s.explanationLanguage = v))}
            />
          )}
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Limits and speed">
        <SettingRow
          title={<label htmlFor={limitId}>Daily request limit</label>}
          help="Stops tutor requests for the day after this many. 0 means no limit."
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
        <SettingRow title="Reuse earlier answers" help="Identical requests are answered from this computer instead of paying again.">
          {(id) => (
            <>
              <Switch labelledBy={id} checked={ai.cacheEnabled} onChange={(v) => set((s) => void (s.cacheEnabled = v))} />
              <span className="cap-help">for</span>
              <NumberInput
                label="Days to keep answers"
                value={ai.cacheTtlDays}
                min={1}
                max={365}
                width={72}
                onCommit={(v) => set((s) => void (s.cacheTtlDays = v))}
              />
              <span className="cap-help">days</span>
            </>
          )}
        </SettingRow>
        <SettingRow title="Show answers as they are written">
          {(id) => <Switch labelledBy={id} checked={ai.stream} onChange={(v) => set((s) => void (s.stream = v))} />}
        </SettingRow>
        <SettingRow title="Give up after" help="Rate limits and server errors are retried with a growing wait.">
          <NumberInput
            label="Timeout in seconds"
            value={ai.timeoutSec}
            min={5}
            max={600}
            width={72}
            onCommit={(v) => set((s) => void (s.timeoutSec = v))}
          />
          <span className="cap-help">seconds ·</span>
          <NumberInput
            label="Retries"
            value={ai.maxRetries}
            min={0}
            max={5}
            width={60}
            onCommit={(v) => set((s) => void (s.maxRetries = v))}
          />
          <span className="cap-help">retries</span>
        </SettingRow>
      </SettingsCard>
      <UsageCard />
    </>
  );
}

function PromptEditor({ task, ai, updateAI }: { task: AITask; ai: AISettings; updateAI: UpdateAI }) {
  const custom = ai.prompts[task];
  const [draft, setDraft] = useState(custom ?? DEFAULT_PROMPTS[task]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => setDraft(custom ?? DEFAULT_PROMPTS[task]), [custom, task]);
  const dirty = draft !== (custom ?? DEFAULT_PROMPTS[task]);
  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return setDraft((d) => d + token);
    const start = el.selectionStart;
    const next = draft.slice(0, start) + token + draft.slice(el.selectionEnd);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <SettingsCard
      title={TASK_LABELS[task].name}
      help={TASK_LABELS[task].description}
      action={custom ? <span className="cap-tag cap-tag--accent">Customised</span> : undefined}
    >
      <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="cap-row" style={{ gap: 6 }}>
          <span className="cap-help">Insert:</span>
          {Object.entries(PROMPT_VARIABLES).map(([k, v]) => (
            <button key={k} className="cap-var" title={v} onClick={() => insert(k)}>
              {`{{${k}}}`}
            </button>
          ))}
        </div>
        <label className="cap-sr" htmlFor={id}>
          Prompt for {TASK_LABELS[task].name.toLowerCase()}
        </label>
        <textarea
          id={id}
          ref={ref}
          className="cap-input"
          style={{ minHeight: 300 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="cap-row">
          <button
            className="cap-btn cap-btn--primary"
            disabled={!dirty}
            onClick={() => void updateAI((s) => void (s.prompts[task] = draft === DEFAULT_PROMPTS[task] ? undefined : draft))}
          >
            Save
          </button>
          <button
            className="cap-btn cap-btn--ghost"
            disabled={!custom && !dirty}
            onClick={() => void updateAI((s) => void delete s.prompts[task])}
          >
            Reset to default
          </button>
          <span className="cap-spacer" />
          {dirty && <span className="cap-help">Unsaved changes</span>}
        </div>
      </div>
    </SettingsCard>
  );
}

export function PromptsSection() {
  const [ai, updateAI] = useAISettings();
  const [task, setTask] = useState<AITask>('word');
  if (!ai) return null;
  return (
    <>
      <PageHead title="Prompts" lead="The instructions the tutor gets for each task. Change the tone, the format or the depth." />
      <Note tone="plain">
        The subtitle or page text is always added for you, wrapped in <span className="cap-mono">&lt;context&gt;</span> tags and marked as
        untrusted, whatever you write here.
      </Note>
      <div style={{ alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
        <Segment
          role="tablist"
          label="Task"
          value={task}
          options={AI_TASKS.map((t) => ({ value: t, label: TASK_LABELS[t].name }))}
          onChange={setTask}
        />
      </div>
      <PromptEditor key={task} task={task} ai={ai} updateAI={updateAI} />
    </>
  );
}
