import { browser } from '#imports';
import { useEffect, useState } from 'react';
import { builtinOptions, getLanguageModel } from '@/lib/ai/providers/chrome';
import { newConnection, originPattern, PROVIDER_ORDER, PROVIDERS, validateBaseUrl } from '@/lib/ai/registry';
import { getApiKey, maskKey, removeApiKey, setApiKey } from '@/lib/ai/secrets';
import type { AISettings, ProviderConnection, ProviderKind } from '@/lib/ai/types';
import { bg } from '@/lib/messaging';
import type { TestResult } from '@/lib/ai/gateway';
import { CommitInput, Field, useAISettings } from '@/ui/form';
import { IconExternal, IconTrash } from '@/ui/icons';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

async function requestOrigin(conn: Pick<ProviderConnection, 'kind' | 'baseUrl'>): Promise<boolean> {
  const origin = originPattern(conn);
  if (!origin) return true;
  try {
    return await browser.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

function useHostPermission(conn: ProviderConnection): [boolean | null, () => Promise<void>] {
  const [granted, setGranted] = useState<boolean | null>(null);
  const origin = originPattern(conn);
  useEffect(() => {
    if (!origin) return setGranted(true);
    void browser.permissions.contains({ origins: [origin] }).then(setGranted);
    const onChange = () => void browser.permissions.contains({ origins: [origin] }).then(setGranted);
    browser.permissions.onAdded.addListener(onChange);
    browser.permissions.onRemoved.addListener(onChange);
    return () => {
      browser.permissions.onAdded.removeListener(onChange);
      browser.permissions.onRemoved.removeListener(onChange);
    };
  }, [origin]);
  return [granted, async () => setGranted(await requestOrigin(conn))];
}

function ApiKeyField({ conn }: { conn: ProviderConnection }) {
  const info = PROVIDERS[conn.kind];
  const [stored, setStored] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    void getApiKey(conn.id).then((k) => {
      setStored(k);
      setEditing(!k);
    });
  }, [conn.id]);
  if (stored === null) return null;
  const save = async () => {
    await setApiKey(conn.id, draft);
    setStored(draft.trim());
    setDraft('');
    setEditing(!draft.trim());
    setShow(false);
  };
  return (
    <Field
      label={`API key${info.requiresKey ? '' : ' (optional)'}`}
      help={
        <>
          Stored only on this device, never synced or exported, and sent only to {info.name}.
          {info.keyUrl && (
            <>
              {' '}
              <a className="lr-link" href={info.keyUrl} target="_blank" rel="noopener noreferrer">
                Get a key <IconExternal style={{ width: 11, height: 11 }} />
              </a>
            </>
          )}
        </>
      }
    >
      {editing ? (
        <>
          <input
            className="lr-input wide"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? 'Paste your API key'}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button className="lr-btn" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
          <button className="lr-btn primary" disabled={!draft.trim()} onClick={() => void save()}>
            Save key
          </button>
          {stored && (
            <button className="lr-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </>
      ) : (
        <>
          <code className="lr-kbd">{maskKey(stored)}</code>
          <button className="lr-btn" onClick={() => setEditing(true)}>
            Replace
          </button>
          <button
            className="lr-btn"
            onClick={async () => {
              await removeApiKey(conn.id);
              setStored('');
              setEditing(true);
            }}
          >
            Remove
          </button>
        </>
      )}
    </Field>
  );
}

function ChromeBuiltinStatus() {
  const [state, setState] = useState<string>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const LM = getLanguageModel();
  useEffect(() => {
    if (!LM) return setState('unsupported');
    void LM.availability(builtinOptions())
      .then(setState)
      .catch(() => setState('unavailable'));
  }, [LM]);
  const download = async () => {
    if (!LM) return;
    setState('downloading');
    try {
      const session = await LM.create({
        ...builtinOptions(),
        monitor(m: EventTarget) {
          m.addEventListener('downloadprogress', (e) => setProgress((e as unknown as { loaded: number }).loaded));
        },
      });
      session.destroy();
      setState('available');
    } catch (err) {
      setState(`error: ${(err as Error).message}`);
    }
  };
  return (
    <Field
      label="On-device model"
      help="Gemini Nano runs locally in Chrome. Quality is lower than cloud models but it is free and private."
    >
      {state === 'available' && <span className="lr-ok">Ready</span>}
      {state === 'unsupported' && <span className="lr-status">Not available in this browser (requires a recent desktop Chrome).</span>}
      {state === 'unavailable' && <span className="lr-status">This device does not meet the hardware requirements.</span>}
      {(state === 'downloadable' || state === 'downloading') && (
        <>
          <button className="lr-btn primary" disabled={state === 'downloading'} onClick={() => void download()}>
            {state === 'downloading' ? 'Downloading…' : 'Download model'}
          </button>
          {progress !== null && <span className="lr-status">{Math.round(progress * 100)}%</span>}
        </>
      )}
      {state.startsWith('error') && <span className="lr-error">{state}</span>}
    </Field>
  );
}

function ConnectionCard({ conn, ai, updateAI }: { conn: ProviderConnection; ai: AISettings; updateAI: UpdateAI }) {
  const info = PROVIDERS[conn.kind];
  const [granted, grant] = useHostPermission(conn);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const isDefault = (ai.defaultConnectionId ?? ai.connections[0]?.id) === conn.id;
  const models = conn.models.length ? conn.models : info.suggestedModels;
  const patch = (fn: (c: ProviderConnection) => void) =>
    updateAI((s) => {
      const c = s.connections.find((x) => x.id === conn.id);
      if (c) fn(c);
    });

  const fetchModels = async () => {
    setBusy('models');
    setResult(null);
    try {
      const list = await bg({ type: 'ai.listModels', connectionId: conn.id });
      setResult({ ok: true, text: `Found ${list.length} models.` });
      if (!conn.defaultModel && list[0]) await patch((c) => void (c.defaultModel = list[0]));
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setResult(null);
    try {
      const r: TestResult = await bg({ type: 'ai.test', connectionId: conn.id });
      setResult(
        r.ok
          ? {
              ok: true,
              text: `Connected in ${r.latencyMs} ms${r.models ? ` · ${r.models.length} models available` : r.reply ? ` · replied “${r.reply}”` : ''}.`,
            }
          : { ok: false, text: r.error ?? 'Failed' },
      );
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${conn.label}? Its API key will be deleted from this device.`)) return;
    await removeApiKey(conn.id);
    await updateAI((s) => {
      s.connections = s.connections.filter((c) => c.id !== conn.id);
      if (s.defaultConnectionId === conn.id) s.defaultConnectionId = s.connections[0]?.id ?? null;
      if (s.fallbackConnectionId === conn.id) s.fallbackConnectionId = null;
      for (const r of Object.values(s.routes)) {
        if (r.connectionId === conn.id) {
          r.connectionId = null;
          r.model = '';
        }
      }
    });
  };

  return (
    <div className="lr-card">
      <div className="lr-card-head">
        <div className="title">
          <CommitInput
            value={conn.label}
            onCommit={(v) => void patch((c) => void (c.label = v.trim() || info.name))}
            style={{ fontWeight: 600, fontSize: 15, background: 'transparent', border: 'none', padding: 0, width: '100%' }}
            aria-label="Provider name"
          />
          <div className="lr-status">
            {info.name}
            {info.local ? ' · runs locally' : ''}
          </div>
        </div>
        {isDefault ? (
          <span className="lr-chip known">Default</span>
        ) : (
          <button className="lr-btn" onClick={() => void updateAI((s) => void (s.defaultConnectionId = conn.id))}>
            Make default
          </button>
        )}
        <button className="lr-icon-btn" title="Remove provider" onClick={() => void remove()}>
          <IconTrash />
        </button>
      </div>

      {info.hint && <div className="lr-note">{info.hint}</div>}

      {info.protocol !== 'chrome' && (
        <>
          {(info.editableBaseUrl || conn.baseUrl !== info.defaultBaseUrl) && (
            <Field label="Base URL" help="HTTPS is required except for servers on this computer.">
              <CommitInput
                className="lr-input wide"
                value={conn.baseUrl}
                spellCheck={false}
                onCommit={(v) => {
                  const error = validateBaseUrl(v.trim());
                  if (error) return alert(error);
                  void patch((c) => {
                    c.baseUrl = v.trim().replace(/\/+$/, '');
                    c.models = [];
                  });
                }}
              />
            </Field>
          )}
          <ApiKeyField conn={conn} />
          <Field
            label="Network access"
            help={`Chrome asks you once to let Captionary contact ${(() => {
              try {
                return new URL(conn.baseUrl).host;
              } catch {
                return 'this server';
              }
            })()}. No other site is accessible.`}
          >
            {granted === null ? null : granted ? (
              <span className="lr-ok">Granted</span>
            ) : (
              <button className="lr-btn primary" onClick={() => void grant()}>
                Grant access
              </button>
            )}
          </Field>
        </>
      )}
      {info.protocol === 'chrome' && <ChromeBuiltinStatus />}

      <Field label="Default model" help="Used for every task unless a task picks its own model.">
        <ModelPicker
          label="Default model"
          value={conn.defaultModel}
          models={models}
          placeholder={info.defaultModel || 'model id'}
          onCommit={(v) => void patch((c) => void (c.defaultModel = v))}
        />
        <button className="lr-btn" disabled={busy !== null} onClick={() => void fetchModels()}>
          {busy === 'models' ? 'Loading…' : 'Fetch models'}
        </button>
        <button className="lr-btn" disabled={busy !== null} onClick={() => void test()}>
          {busy === 'test' ? 'Testing…' : 'Test connection'}
        </button>
      </Field>
      {conn.modelsFetchedAt && (
        <div className="lr-status" style={{ marginLeft: 216 }}>
          Model list updated {new Date(conn.modelsFetchedAt).toLocaleString()} ({conn.models.length} models)
        </div>
      )}
      {result && (
        <div className={result.ok ? 'lr-note' : 'lr-note warn'}>
          <span className={result.ok ? 'lr-ok' : 'lr-error'}>{result.ok ? '✓ ' : '✗ '}</span>
          {result.text}
        </div>
      )}
    </div>
  );
}

function AddProvider({ onAdd }: { onAdd: (kind: ProviderKind) => void }) {
  return (
    <div className="lr-card">
      <div className="lr-card-head">
        <div className="title">Add a provider</div>
      </div>
      <div className="lr-grid-2">
        {PROVIDER_ORDER.map((kind) => {
          const info = PROVIDERS[kind];
          return (
            <button key={kind} className="lr-provider-pick" onClick={() => onAdd(kind)}>
              {info.name}
              <small>{info.local ? 'Local · free · private' : info.requiresKey ? 'API key required' : 'Custom endpoint'}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AIProvidersSection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;

  const add = (kind: ProviderKind) => {
    const conn = newConnection(kind);
    // Ask for host access inside the click so Chrome shows its prompt right away.
    // (A custom endpoint has no URL yet; its card offers "Grant access" later.)
    if (PROVIDERS[kind].protocol !== 'chrome') void requestOrigin(conn);
    void updateAI((s) => {
      s.connections.push(conn);
      s.defaultConnectionId ??= conn.id;
    });
  };

  return (
    <>
      <h1>AI providers</h1>
      <p className="lr-lead">
        Connect the AI service that explains vocabulary for you. You can add several and route each task to a different model (for example a
        fast, cheap model for word look-ups and a stronger one for grammar).
      </p>
      <div className="lr-note">
        <b>How your data and keys are handled.</b> Requests go directly from your browser to the provider you choose — there is no Language
        React server. Keys are kept in this browser's local extension storage, are only read by the extension's background worker, and are
        never synced, logged or included in exports. Only the text you look up (and the context you allow under{' '}
        <a className="lr-link" href="#ai-privacy">
          Privacy &amp; cost
        </a>
        ) is sent.
      </div>
      {ai.connections.length === 0 && (
        <div className="lr-note warn">No provider yet. Pick one below — Chrome built-in AI and Ollama need no account.</div>
      )}
      {ai.connections.map((c) => (
        <ConnectionCard key={c.id} conn={c} ai={ai} updateAI={updateAI} />
      ))}
      <AddProvider onAdd={add} />
    </>
  );
}
