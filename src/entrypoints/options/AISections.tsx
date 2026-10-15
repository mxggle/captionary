import { useEffect, useState } from 'react';
import { cacheSize, clearCache } from '@/lib/ai/cache';
import { DEFAULT_PROMPTS, PROMPT_VARIABLES } from '@/lib/ai/prompts';
import { PROVIDERS } from '@/lib/ai/registry';
import { AI_TASKS, type AISettings, type AITask, type ReasoningEffort, type TaskRoute } from '@/lib/ai/types';
import { getUsage, resetUsage, usageItem, type UsageStats } from '@/lib/ai/usage';
import { TASK_LABELS } from '@/lib/settings';
import { Field, NumberInput, Toggle, useAISettings } from '@/ui/form';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

const EFFORTS: { value: ReasoningEffort; label: string }[] = [
  { value: 'default', label: 'Provider default' },
  { value: 'minimal', label: 'Minimal (fastest)' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (slowest)' },
];

function RouteCard({ task, ai, updateAI }: { task: AITask; ai: AISettings; updateAI: UpdateAI }) {
  const route = ai.routes[task];
  const defaultConn = ai.connections.find((c) => c.id === ai.defaultConnectionId) ?? ai.connections[0];
  const conn = route.connectionId ? ai.connections.find((c) => c.id === route.connectionId) : defaultConn;
  const models = conn ? (conn.models.length ? conn.models : PROVIDERS[conn.kind].suggestedModels) : [];
  const set = (fn: (r: TaskRoute) => void) => updateAI((s) => fn(s.routes[task]));
  return (
    <div className="lr-card">
      <div className="lr-card-head">
        <div className="title">
          {TASK_LABELS[task].name}
          <div className="lr-status">{TASK_LABELS[task].description}</div>
        </div>
      </div>
      <Field label="Provider">
        <select
          className="lr-select"
          value={route.connectionId ?? ''}
          onChange={(e) =>
            void set((r) => {
              r.connectionId = e.target.value || null;
              r.model = '';
            })
          }
        >
          <option value="">Default{defaultConn ? ` (${defaultConn.label})` : ''}</option>
          {ai.connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Model"
        help={conn ? `Empty = ${conn.label}'s default (${conn.defaultModel || PROVIDERS[conn.kind].defaultModel || 'none'}).` : undefined}
      >
        <ModelPicker
          label="Model"
          value={route.model}
          models={models}
          placeholder={conn?.defaultModel || 'provider default'}
          onCommit={(v) => void set((r) => void (r.model = v))}
        />
      </Field>
      <Field label="Reasoning effort" help="Lower effort answers faster and costs less. Ignored by models without reasoning controls.">
        <select
          className="lr-select"
          value={route.effort}
          onChange={(e) => void set((r) => void (r.effort = e.target.value as ReasoningEffort))}
        >
          {EFFORTS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Temperature"
        help="Leave on provider default: several current models reject custom values. If a model refuses a setting, the request is retried without it."
      >
        <Toggle
          label="Custom temperature"
          checked={route.temperature !== null}
          onChange={(v) => void set((r) => void (r.temperature = v ? 0.3 : null))}
        />
        {route.temperature !== null && (
          <>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={route.temperature}
              onChange={(e) => void set((r) => void (r.temperature = Number(e.target.value)))}
            />
            <span className="lr-kbd">{route.temperature.toFixed(2)}</span>
          </>
        )}
      </Field>
      <Field label="Max answer length" help="Output tokens. Reasoning models get extra room for thinking on top of this.">
        <NumberInput
          value={route.maxOutputTokens}
          min={64}
          max={32000}
          step={50}
          onCommit={(v) => void set((r) => void (r.maxOutputTokens = v))}
        />
      </Field>
    </div>
  );
}

export function AITasksSection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;
  return (
    <>
      <h1>Models per task</h1>
      <p className="lr-lead">
        Pick which provider and model handles each job. Quick look-ups feel best with a fast model; grammar breakdowns and follow-up chat
        benefit from a stronger one.
      </p>
      {ai.connections.length === 0 && (
        <div className="lr-note warn">
          Add a provider first under{' '}
          <a className="lr-link" href="#ai">
            AI providers
          </a>
          .
        </div>
      )}
      {AI_TASKS.map((t) => (
        <RouteCard key={t} task={t} ai={ai} updateAI={updateAI} />
      ))}
      <div className="lr-card">
        <Field
          label="Fallback provider"
          help="If the main provider is down, rate-limited or out of credit, the request is retried once on this provider with its default model."
        >
          <select
            className="lr-select"
            value={ai.fallbackConnectionId ?? ''}
            onChange={(e) => void updateAI((s) => void (s.fallbackConnectionId = e.target.value || null))}
          >
            <option value="">None</option>
            {ai.connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}

function UsagePanel() {
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
    <div className="lr-card">
      <div className="lr-card-head">
        <div className="title">Usage</div>
        <button className="lr-btn" onClick={() => void resetUsage().then(() => getUsage().then(setUsage))}>
          Reset counters
        </button>
      </div>
      <div className="lr-row" style={{ marginBottom: 12 }}>
        <div className="lr-stat">
          <b>{usage.today.requests}</b>
          <span>requests today</span>
        </div>
        <div className="lr-stat">
          <b>{usage.today.cacheHits}</b>
          <span>answered from cache today</span>
        </div>
        <div className="lr-stat">
          <b>{(usage.total.inputTokens + usage.total.outputTokens).toLocaleString()}</b>
          <span>tokens all time</span>
        </div>
      </div>
      {models.length > 0 && (
        <table className="lr-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Requests</th>
              <th>Input tokens</th>
              <th>Output tokens</th>
              <th>Cache hits</th>
            </tr>
          </thead>
          <tbody>
            {models.map(([m, c]) => (
              <tr key={m}>
                <td>{m}</td>
                <td>{c.requests}</td>
                <td>{c.inputTokens.toLocaleString()}</td>
                <td>{c.outputTokens.toLocaleString()}</td>
                <td>{c.cacheHits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="lr-row" style={{ marginTop: 12 }}>
        <span className="lr-status">{cached ?? '…'} answers in the local cache.</span>
        <button className="lr-btn" onClick={() => void clearCache().then(() => setCached(0))}>
          Clear cache
        </button>
      </div>
    </div>
  );
}

export function AIPrivacySection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;
  const set = (fn: (s: AISettings) => void) => void updateAI(fn);
  return (
    <>
      <h1>Privacy &amp; cost</h1>
      <p className="lr-lead">Control what is sent to AI providers, how often, and how much it can cost.</p>
      <div className="lr-card">
        <Field label="AI features" help="Turn off to never contact an AI provider.">
          <Toggle label="AI features" checked={ai.enabled} onChange={(v) => set((s) => void (s.enabled = v))} />
        </Field>
        <Field
          label="Explain words automatically"
          help="Off: an explanation is requested only when you click “Explain”. On: every clicked word sends a request (faster, costs more)."
        >
          <Toggle label="Explain automatically" checked={ai.autoExplain} onChange={(v) => set((s) => void (s.autoExplain = v))} />
        </Field>
        <Field label="Context sent with a look-up" help="More context gives better explanations of meaning in context.">
          <select
            className="lr-select"
            value={ai.contextScope}
            onChange={(e) => set((s) => void (s.contextScope = e.target.value as AISettings['contextScope']))}
          >
            <option value="word">Only the word</option>
            <option value="sentence">The word and its sentence</option>
            <option value="surrounding">Sentence plus the two lines before and after</option>
          </select>
        </Field>
        <Field label="Share video / page title" help="Helps with names and topic-specific meanings.">
          <Toggle label="Share title" checked={ai.shareMediaTitle} onChange={(v) => set((s) => void (s.shareMediaTitle = v))} />
        </Field>
        <Field label="Explanations written in">
          <select
            className="lr-select"
            value={ai.explanationLanguage}
            onChange={(e) => set((s) => void (s.explanationLanguage = e.target.value as AISettings['explanationLanguage']))}
          >
            <option value="native">My language</option>
            <option value="target">The language I'm learning (immersion)</option>
          </select>
        </Field>
      </div>

      <div className="lr-card">
        <Field
          label="Daily request limit"
          help="Stops AI requests for the day after this many (0 = no limit). Protects against surprise bills, e.g. when machine-translating long videos."
        >
          <NumberInput value={ai.dailyRequestLimit} min={0} max={100000} onCommit={(v) => set((s) => void (s.dailyRequestLimit = v))} />
        </Field>
        <Field label="Cache answers" help="Identical requests are answered locally instead of paying again.">
          <Toggle label="Cache answers" checked={ai.cacheEnabled} onChange={(v) => set((s) => void (s.cacheEnabled = v))} />
          <span className="lr-status">keep for</span>
          <NumberInput value={ai.cacheTtlDays} min={1} max={365} width={70} onCommit={(v) => set((s) => void (s.cacheTtlDays = v))} />
          <span className="lr-status">days</span>
        </Field>
        <Field label="Stream answers" help="Show text as it is generated.">
          <Toggle label="Stream answers" checked={ai.stream} onChange={(v) => set((s) => void (s.stream = v))} />
        </Field>
        <Field label="Timeout" help="Seconds before a request is abandoned.">
          <NumberInput value={ai.timeoutSec} min={5} max={600} width={70} onCommit={(v) => set((s) => void (s.timeoutSec = v))} />
        </Field>
        <Field label="Retries" help="Automatic retries with backoff on rate limits and server errors.">
          <NumberInput value={ai.maxRetries} min={0} max={5} width={70} onCommit={(v) => set((s) => void (s.maxRetries = v))} />
        </Field>
      </div>
      <UsagePanel />
    </>
  );
}

function PromptEditor({ task, ai, updateAI }: { task: AITask; ai: AISettings; updateAI: UpdateAI }) {
  const custom = ai.prompts[task];
  const [draft, setDraft] = useState(custom ?? DEFAULT_PROMPTS[task]);
  useEffect(() => setDraft(custom ?? DEFAULT_PROMPTS[task]), [custom, task]);
  const dirty = draft !== (custom ?? DEFAULT_PROMPTS[task]);
  return (
    <div className="lr-card">
      <div className="lr-card-head">
        <div className="title">
          {TASK_LABELS[task].name}
          {custom ? (
            <span className="lr-chip" style={{ marginLeft: 8 }}>
              customized
            </span>
          ) : null}
        </div>
        <button
          className="lr-btn"
          disabled={!dirty}
          onClick={() => void updateAI((s) => void (s.prompts[task] = draft === DEFAULT_PROMPTS[task] ? undefined : draft))}
        >
          Save
        </button>
        <button className="lr-btn" disabled={!custom && !dirty} onClick={() => void updateAI((s) => void delete s.prompts[task])}>
          Reset to default
        </button>
      </div>
      <textarea className="lr-input" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} rows={12} />
    </div>
  );
}

export function PromptsSection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;
  return (
    <>
      <h1>Prompts</h1>
      <p className="lr-lead">
        The system instructions sent with each task. Customize tone, format or depth. The look-up text and its context are added
        automatically, wrapped in <code>&lt;context&gt;</code> tags and marked as untrusted, whatever you write here.
      </p>
      <div className="lr-note">
        Variables:{' '}
        {Object.entries(PROMPT_VARIABLES).map(([k, v]) => (
          <span key={k} style={{ marginRight: 12 }}>
            <code className="lr-kbd">{`{{${k}}}`}</code> {v}
          </span>
        ))}
      </div>
      {AI_TASKS.map((t) => (
        <PromptEditor key={t} task={t} ai={ai} updateAI={updateAI} />
      ))}
    </>
  );
}
