import { browser } from '#imports';
import { useEffect, useId, useState } from 'react';
import {
  getChatGPTAccount,
  SIGN_IN_ORIGINS,
  signInWithChatGPT,
  signOutChatGPT,
  tokensItem,
  type ChatGPTAccount,
} from '@/lib/ai/chatgpt-auth';
import { originsToRequest, releaseOrigins, requestOrigins } from '@/lib/ai/host-access';
import { builtinOptions, getLanguageModel } from '@/lib/ai/providers/chrome';
import { newConnection, PROVIDER_ORDER, providerOrigins, PROVIDERS, validateBaseUrl } from '@/lib/ai/registry';
import { getApiKey, maskKey, removeApiKey, setApiKey } from '@/lib/ai/secrets';
import type { AIError, AISettings, ProviderConnection, ProviderKind } from '@/lib/ai/types';
import { bg } from '@/lib/messaging';
import type { TestResult } from '@/lib/ai/gateway';
import { Note, PageHead } from '@/ui/controls';
import { CommitInput, useAISettings } from '@/ui/form';
import { IconTrash } from '@/ui/icons';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

/** Names and one-line notes in the "Add a provider" grid. */
const PICKS: Record<ProviderKind, { name: string; note: string }> = {
  openai: { name: 'OpenAI', note: 'API key' },
  chatgpt: { name: 'ChatGPT', note: 'Sign in · uses your plan' },
  anthropic: { name: 'Anthropic (Claude)', note: 'API key' },
  gemini: { name: 'Google Gemini', note: 'API key' },
  openrouter: { name: 'OpenRouter', note: 'API key · many models' },
  deepseek: { name: 'DeepSeek', note: 'API key' },
  groq: { name: 'Groq', note: 'API key · very fast' },
  mistral: { name: 'Mistral', note: 'API key' },
  xai: { name: 'xAI (Grok)', note: 'API key' },
  ollama: { name: 'Ollama', note: 'On this computer · free' },
  lmstudio: { name: 'LM Studio', note: 'On this computer · free' },
  'openai-compatible': { name: 'OpenAI-compatible', note: 'Your own endpoint' },
  'chrome-builtin': { name: 'Chrome built-in AI', note: 'Gemini Nano · no account' },
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'this server';
  }
}

function useHostPermission(conn: ProviderConnection): [boolean | null, () => Promise<void>] {
  const [granted, setGranted] = useState<boolean | null>(null);
  const key = providerOrigins(conn).join(' ');
  useEffect(() => {
    const origins = key ? key.split(' ') : [];
    if (!origins.length) return setGranted(true);
    void browser.permissions.contains({ origins }).then(setGranted);
    const onChange = () => void browser.permissions.contains({ origins }).then(setGranted);
    browser.permissions.onAdded.addListener(onChange);
    browser.permissions.onRemoved.addListener(onChange);
    return () => {
      browser.permissions.onAdded.removeListener(onChange);
      browser.permissions.onRemoved.removeListener(onChange);
    };
  }, [key]);
  return [granted, async () => setGranted(await requestOrigins(originsToRequest(conn)))];
}

function ApiKeyField({ conn }: { conn: ProviderConnection }) {
  const info = PROVIDERS[conn.kind];
  const id = useId();
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
    <div className="cap-field">
      <div className="cap-row" style={{ justifyContent: 'space-between' }}>
        <label className="cap-label" htmlFor={id}>
          API key{info.requiresKey ? '' : ' (optional)'}
        </label>
        {info.keyUrl && (
          <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            Get a key
          </a>
        )}
      </div>
      {editing ? (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input
            id={id}
            className="cap-input cap-input--mono"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? 'Paste your API key'}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button className="cap-btn" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
          <button className="cap-btn cap-btn--primary" disabled={!draft.trim()} onClick={() => void save()}>
            Save key
          </button>
          {stored && (
            <button className="cap-btn cap-btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input id={id} className="cap-input cap-input--mono" readOnly value={maskKey(stored)} />
          <button className="cap-btn" onClick={() => setEditing(true)}>
            Replace
          </button>
          <button
            className="cap-btn cap-btn--ghost cap-btn--danger"
            onClick={async () => {
              await removeApiKey(conn.id);
              setStored('');
              setEditing(true);
            }}
          >
            Remove
          </button>
        </div>
      )}
      <span className="cap-help">Stored only on this computer, never synced or exported, and sent only to {info.name}.</span>
    </div>
  );
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ChatGPTAccountField({ conn }: { conn: ProviderConnection }) {
  const [account, setAccount] = useState<ChatGPTAccount | null | undefined>(undefined);
  const [pending, setPending] = useState<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => void getChatGPTAccount(conn.id).then(setAccount);
    load();
    // The background signs the account out when its sign-in can no longer be refreshed.
    return tokensItem(conn.id).watch(load);
  }, [conn.id]);
  if (account === undefined) return null;

  const signIn = async () => {
    setError(null);
    // Ask inside the click so Chrome shows its prompt (no prompt if already granted).
    if (!(await requestOrigins(SIGN_IN_ORIGINS))) {
      return setError('Captionary needs access to chatgpt.com and auth.openai.com, and to localhost to read the sign-in result.');
    }
    const abort = new AbortController();
    setPending(abort);
    try {
      setAccount(await signInWithChatGPT(conn.id, abort.signal));
    } catch (err) {
      if ((err as AIError).code !== 'aborted') setError((err as Error).message);
    } finally {
      setPending(null);
      await releaseOrigins(SIGN_IN_ORIGINS);
    }
  };

  return (
    <div className="cap-field">
      <span className="cap-label">ChatGPT account</span>
      {account ? (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <span className="cap-spacer">
            Signed in{account.email ? ` as ${account.email}` : ''}
            {account.plan ? ` · ${titleCase(account.plan)} plan` : ''}
          </span>
          <button className="cap-btn cap-btn--ghost cap-btn--danger" onClick={() => void signOutChatGPT(conn.id)}>
            Sign out
          </button>
        </div>
      ) : pending ? (
        <div className="cap-row">
          <span className="cap-spacer">Finish signing in on the ChatGPT tab. It closes by itself when you are done.</span>
          <button className="cap-btn cap-btn--ghost" onClick={() => pending.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary" onClick={() => void signIn()}>
            Sign in with ChatGPT
          </button>
        </div>
      )}
      {error && <Note tone="danger">{error}</Note>}
      <span className="cap-help">
        You sign in on OpenAI’s own page; Captionary never sees your password. The sign-in is stored only on this computer, never synced or
        exported, and sent only to OpenAI. Signing out deletes it here; to end the session at OpenAI too, log out of all devices in
        ChatGPT’s security settings. This uses the sign-in OpenAI made for its Codex app, which OpenAI hasn’t documented for other apps, so
        it may change or stop working.
      </span>
    </div>
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
    <div className="cap-field">
      <span className="cap-label">On-device model</span>
      {state === 'available' && (
        <span className="cap-tag cap-tag--known" style={{ alignSelf: 'flex-start' }}>
          Ready
        </span>
      )}
      {state === 'unsupported' && <Note tone="warn">Not available in this browser. It needs a recent desktop Chrome.</Note>}
      {state === 'unavailable' && <Note tone="warn">This computer does not meet Chrome’s hardware requirements for Gemini Nano.</Note>}
      {(state === 'downloadable' || state === 'downloading') && (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary" disabled={state === 'downloading'} onClick={() => void download()}>
            {state === 'downloading' ? 'Downloading…' : 'Download model'}
          </button>
          {progress !== null && <span className="cap-help">{Math.round(progress * 100)}%</span>}
        </div>
      )}
      {state.startsWith('error') && <Note tone="danger">{state.replace(/^error: /, '')}</Note>}
      <span className="cap-help">
        Gemini Nano runs inside Chrome. Answers are weaker than cloud models, but it is free and nothing leaves this computer.
      </span>
    </div>
  );
}

function ConnectionCard({ conn, ai, updateAI }: { conn: ProviderConnection; ai: AISettings; updateAI: UpdateAI }) {
  const info = PROVIDERS[conn.kind];
  const titleId = useId();
  const modelId = useId();
  const urlId = useId();
  const [granted, grant] = useHostPermission(conn);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const isDefault = (ai.defaultConnectionId ?? ai.connections[0]?.id) === conn.id;
  const models = conn.models.length ? conn.models : info.suggestedModels;
  const host = hostOf(conn.baseUrl);
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
              text: `Connected in ${r.latencyMs} ms${r.models ? ` · ${r.models.length} models available` : r.reply ? ` · replied “${r.reply}”` : ''}.${
                info.protocol !== 'chrome' && granted ? ` Network access to ${host} is granted.` : ''
              }`,
            }
          : { ok: false, text: r.error ?? 'The test failed.' },
      );
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const credential = info.signIn
      ? 'You will be signed out of ChatGPT on this computer.'
      : 'Its API key will be deleted from this computer.';
    if (!confirm(`Remove ${conn.label}? ${credential}`)) return;
    await (info.signIn ? signOutChatGPT(conn.id) : removeApiKey(conn.id));
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
    await releaseOrigins(originsToRequest(conn));
  };

  const where =
    info.protocol === 'chrome'
      ? 'Runs inside Chrome · free · private'
      : info.local
        ? 'Runs on this computer · free · private'
        : `${info.name} · ${host}`;

  return (
    <section className="cap-card" aria-labelledby={titleId}>
      <div className="cap-card__head">
        <div className="cap-spacer" style={{ minWidth: 0 }}>
          <h2 className="cap-card__title" id={titleId} style={{ display: 'block' }}>
            <CommitInput
              className="cap-card__title-input"
              value={conn.label}
              onCommit={(v) => void patch((c) => void (c.label = v.trim() || info.name))}
              aria-label="Provider name"
            />
          </h2>
          <div className="cap-help">{where}</div>
        </div>
        {isDefault ? (
          <span className="cap-tag cap-tag--accent">Default</span>
        ) : (
          <button className="cap-btn cap-btn--sm" onClick={() => void updateAI((s) => void (s.defaultConnectionId = conn.id))}>
            Make default
          </button>
        )}
        <button className="cap-iconbtn" aria-label={`Remove ${conn.label}`} title="Remove" onClick={() => void remove()}>
          <IconTrash className="cap-ico" />
        </button>
      </div>
      <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {info.hint && conn.kind !== 'anthropic' && <Note tone="plain">{info.hint}</Note>}
        {info.protocol !== 'chrome' && (
          <>
            {(info.editableBaseUrl || conn.baseUrl !== info.defaultBaseUrl) && (
              <div className="cap-field">
                <label className="cap-label" htmlFor={urlId}>
                  {info.local ? 'Server address' : 'Base URL'}
                </label>
                <CommitInput
                  id={urlId}
                  className={`cap-input cap-input--mono${urlError ? ' is-invalid' : ''}`}
                  style={{ maxWidth: 360 }}
                  value={conn.baseUrl}
                  spellCheck={false}
                  onCommit={(v) => {
                    const error = validateBaseUrl(v.trim());
                    setUrlError(error);
                    if (error) return;
                    void patch((c) => {
                      c.baseUrl = v.trim().replace(/\/+$/, '');
                      c.models = [];
                    });
                  }}
                />
                <span className="cap-help" style={urlError ? { color: 'var(--danger)' } : undefined}>
                  {urlError ?? 'HTTPS is required except for servers on this computer.'}
                </span>
              </div>
            )}
            {info.signIn ? <ChatGPTAccountField conn={conn} /> : <ApiKeyField conn={conn} />}
            {granted === false && (
              <Note
                tone="warn"
                action={
                  <button className="cap-btn cap-btn--sm cap-btn--primary" onClick={() => void grant()}>
                    Grant access
                  </button>
                }
              >
                {info.signIn
                  ? 'Chrome asks you once to let Captionary contact chatgpt.com and auth.openai.com, and localhost only while you sign in. No other site is accessible.'
                  : `Chrome asks you once to let Captionary contact ${host}. No other site is accessible.`}
              </Note>
            )}
          </>
        )}
        {info.protocol === 'chrome' && <ChromeBuiltinStatus />}

        <div className="cap-field">
          <span className="cap-label" id={modelId}>
            Default model
          </span>
          <div className="cap-row">
            <ModelPicker
              label="Default model"
              labelledBy={modelId}
              value={conn.defaultModel}
              models={models}
              placeholder={info.defaultModel || 'model id'}
              onCommit={(v) => void patch((c) => void (c.defaultModel = v))}
            />
            {info.protocol !== 'chrome' && (
              <button className="cap-btn" disabled={busy !== null} onClick={() => void fetchModels()}>
                {busy === 'models' ? 'Loading…' : conn.modelsFetchedAt ? 'Refresh list' : 'Fetch models'}
              </button>
            )}
            <button className="cap-btn cap-btn--primary" disabled={busy !== null} onClick={() => void test()}>
              {busy === 'test' ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          <span className="cap-help">
            Used for every task unless a task picks its own.
            {conn.kind === 'anthropic' && info.hint ? ` ${info.hint}` : ''}
            {conn.modelsFetchedAt
              ? ` Model list updated ${new Date(conn.modelsFetchedAt).toLocaleString()} (${conn.models.length} models).`
              : ''}
          </span>
        </div>
        {result && <Note tone={result.ok ? 'success' : 'danger'}>{result.text}</Note>}
      </div>
    </section>
  );
}

function AddProvider({ onAdd }: { onAdd: (kind: ProviderKind) => void }) {
  return (
    <section className="cap-card" aria-label="Add a provider">
      <div className="cap-card__head">
        <h2 className="cap-card__title">Add a provider</h2>
      </div>
      <div className="cap-card__body cap-pick-grid">
        {PROVIDER_ORDER.map((kind) => (
          <button key={kind} className="cap-provider-pick" onClick={() => onAdd(kind)}>
            {PICKS[kind]?.name ?? PROVIDERS[kind].name}
            <small>{PICKS[kind]?.note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AIProvidersSection() {
  const [ai, updateAI] = useAISettings();
  if (!ai) return null;

  const add = (kind: ProviderKind) => {
    const conn = newConnection(kind);
    // Ask for host access inside the click so Chrome shows its prompt right away.
    // (A custom endpoint has no URL yet; its card offers "Grant access" later.)
    if (PROVIDERS[kind].protocol !== 'chrome') void requestOrigins(originsToRequest(conn));
    void updateAI((s) => {
      s.connections.push(conn);
      s.defaultConnectionId ??= conn.id;
    });
  };

  return (
    <>
      <PageHead
        title="AI providers"
        lead="Connect the service that powers the tutor. Add several and give each task its own model under Models per task."
      />
      <Note>
        Requests go straight from your browser to the provider you pick; there is no Captionary server. Keys and sign-ins stay on this
        computer in Captionary’s own storage, which web pages can’t read, and they are never synced or exported. Only the text you look up,
        and the context you allow under <a href="#ai-privacy">Privacy &amp; cost</a>, is sent.
      </Note>
      {ai.connections.length === 0 && (
        <Note tone="warn">No provider yet. Pick one below: Chrome’s built-in AI and Ollama need no account.</Note>
      )}
      {ai.connections.map((c) => (
        <ConnectionCard key={c.id} conn={c} ai={ai} updateAI={updateAI} />
      ))}
      <AddProvider onAdd={add} />
    </>
  );
}
