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
import { useI18n } from '@/lib/i18n';
import { bg } from '@/lib/messaging';
import type { TestResult } from '@/lib/ai/gateway';
import { Note, PageHead } from '@/ui/controls';
import { CommitInput, useAISettings } from '@/ui/form';
import { IconTrash } from '@/ui/icons';
import { ModelPicker } from '@/ui/ModelPicker';

type UpdateAI = (fn: (s: AISettings) => void) => Promise<unknown>;

function hostOf(url: string, fallback: string): string {
  try {
    return new URL(url).host;
  } catch {
    return fallback;
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
  const { m } = useI18n();
  const ap = m.options.aiProviders;
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
          {ap.apiKeyLabel}
          {info.requiresKey ? '' : ap.optionalSuffix}
        </label>
        {info.keyUrl && (
          <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            {ap.getKey}
          </a>
        )}
      </div>
      {editing ? (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input
            id={id}
            className="cap-input cap-input--mono"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? ap.pasteApiKey}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button className="cap-btn" onClick={() => setShow(!show)}>
            {show ? ap.hide : ap.show}
          </button>
          <button className="cap-btn cap-btn--primary" disabled={!draft.trim()} onClick={() => void save()}>
            {ap.saveKey}
          </button>
          {stored && (
            <button className="cap-btn cap-btn--ghost" onClick={() => setEditing(false)}>
              {m.common.cancel}
            </button>
          )}
        </div>
      ) : (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input id={id} className="cap-input cap-input--mono" readOnly value={maskKey(stored)} />
          <button className="cap-btn" onClick={() => setEditing(true)}>
            {ap.replace}
          </button>
          <button
            className="cap-btn cap-btn--ghost cap-btn--danger"
            onClick={async () => {
              await removeApiKey(conn.id);
              setStored('');
              setEditing(true);
            }}
          >
            {m.common.remove}
          </button>
        </div>
      )}
      <span className="cap-help">{ap.apiKeyHelp(info.name)}</span>
    </div>
  );
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ChatGPTAccountField({ conn }: { conn: ProviderConnection }) {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
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
      return setError(ap.chatgptPermissionError);
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
      <span className="cap-label">{ap.chatgptAccount}</span>
      {account ? (
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <span className="cap-spacer">{ap.signedInAs(account.email, account.plan ? titleCase(account.plan) : undefined)}</span>
          <button className="cap-btn cap-btn--ghost cap-btn--danger" onClick={() => void signOutChatGPT(conn.id)}>
            {ap.signOut}
          </button>
        </div>
      ) : pending ? (
        <div className="cap-row">
          <span className="cap-spacer">{ap.finishSignInTab}</span>
          <button className="cap-btn cap-btn--ghost" onClick={() => pending.abort()}>
            {m.common.cancel}
          </button>
        </div>
      ) : (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary" onClick={() => void signIn()}>
            {ap.signInWithChatGPT}
          </button>
        </div>
      )}
      {error && <Note tone="danger">{error}</Note>}
      <span className="cap-help">{ap.chatgptHelp}</span>
    </div>
  );
}

function ChromeBuiltinStatus() {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
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
        monitor(ev: EventTarget) {
          ev.addEventListener('downloadprogress', (e) => setProgress((e as unknown as { loaded: number }).loaded));
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
      <span className="cap-label">{ap.onDeviceModel}</span>
      {state === 'available' && (
        <span className="cap-tag cap-tag--known" style={{ alignSelf: 'flex-start' }}>
          {ap.readyTag}
        </span>
      )}
      {state === 'unsupported' && <Note tone="warn">{ap.chromeUnsupportedWarn}</Note>}
      {state === 'unavailable' && <Note tone="warn">{ap.chromeUnavailableWarn}</Note>}
      {(state === 'downloadable' || state === 'downloading') && (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary" disabled={state === 'downloading'} onClick={() => void download()}>
            {state === 'downloading' ? ap.downloading : ap.downloadModel}
          </button>
          {progress !== null && <span className="cap-help">{Math.round(progress * 100)}%</span>}
        </div>
      )}
      {state.startsWith('error') && <Note tone="danger">{state.replace(/^error: /, '')}</Note>}
      <span className="cap-help">{ap.chromeBuiltinHelp}</span>
    </div>
  );
}

function ConnectionCard({ conn, ai, updateAI }: { conn: ProviderConnection; ai: AISettings; updateAI: UpdateAI }) {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
  const info = PROVIDERS[conn.kind];
  const hint = ap.hints[conn.kind] ?? info.hint;
  const titleId = useId();
  const modelId = useId();
  const urlId = useId();
  const [granted, grant] = useHostPermission(conn);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const isDefault = (ai.defaultConnectionId ?? ai.connections[0]?.id) === conn.id;
  const models = conn.models.length ? conn.models : info.suggestedModels;
  const host = hostOf(conn.baseUrl, ap.thisServer);
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
      setResult({ ok: true, text: ap.foundModelsResult(list.length) });
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
              text: ap.connectedResult(
                r.latencyMs ?? 0,
                r.models?.length,
                r.reply,
                info.protocol !== 'chrome' && granted ? host : undefined,
              ),
            }
          : { ok: false, text: r.error ?? ap.testFailed },
      );
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const confirmMsg = info.signIn ? ap.confirmRemoveSignIn(conn.label) : ap.confirmRemoveKey(conn.label);
    if (!confirm(confirmMsg)) return;
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
    info.protocol === 'chrome' ? ap.whereChrome : info.local ? ap.whereLocal : `${ap.picks[conn.kind]?.name ?? info.name} · ${host}`;

  return (
    <section className="cap-card" aria-labelledby={titleId}>
      <div className="cap-card__head">
        <div className="cap-spacer" style={{ minWidth: 0 }}>
          <h2 className="cap-card__title" id={titleId} style={{ display: 'block' }}>
            <CommitInput
              className="cap-card__title-input"
              value={conn.label}
              onCommit={(v) => void patch((c) => void (c.label = v.trim() || info.name))}
              aria-label={ap.providerNameAria}
            />
          </h2>
          <div className="cap-help">{where}</div>
        </div>
        {isDefault ? (
          <span className="cap-tag cap-tag--accent">{m.common.default}</span>
        ) : (
          <button className="cap-btn cap-btn--sm" onClick={() => void updateAI((s) => void (s.defaultConnectionId = conn.id))}>
            {ap.makeDefault}
          </button>
        )}
        <button
          className="cap-iconbtn"
          aria-label={ap.removeProviderAria(conn.label)}
          title={m.common.remove}
          onClick={() => void remove()}
        >
          <IconTrash className="cap-ico" />
        </button>
      </div>
      <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {hint && conn.kind !== 'anthropic' && <Note tone="plain">{hint}</Note>}
        {info.protocol !== 'chrome' && (
          <>
            {(info.editableBaseUrl || conn.baseUrl !== info.defaultBaseUrl) && (
              <div className="cap-field">
                <label className="cap-label" htmlFor={urlId}>
                  {info.local ? ap.serverAddress : ap.baseUrl}
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
                  {urlError ?? ap.httpsRequiredHelp}
                </span>
              </div>
            )}
            {info.signIn ? <ChatGPTAccountField conn={conn} /> : <ApiKeyField conn={conn} />}
            {granted === false && (
              <Note
                tone="warn"
                action={
                  <button className="cap-btn cap-btn--sm cap-btn--primary" onClick={() => void grant()}>
                    {ap.grantAccess}
                  </button>
                }
              >
                {info.signIn ? ap.grantAccessSignInNote : ap.grantAccessHostNote(host)}
              </Note>
            )}
          </>
        )}
        {info.protocol === 'chrome' && <ChromeBuiltinStatus />}

        <div className="cap-field">
          <span className="cap-label" id={modelId}>
            {ap.defaultModel}
          </span>
          <div className="cap-row">
            <ModelPicker
              label={ap.defaultModel}
              labelledBy={modelId}
              value={conn.defaultModel}
              models={models}
              placeholder={info.defaultModel || ap.modelIdPlaceholder}
              onCommit={(v) => void patch((c) => void (c.defaultModel = v))}
            />
            {info.protocol !== 'chrome' && (
              <button className="cap-btn" disabled={busy !== null} onClick={() => void fetchModels()}>
                {busy === 'models' ? m.common.loading : conn.modelsFetchedAt ? ap.refreshList : ap.fetchModels}
              </button>
            )}
            <button className="cap-btn cap-btn--primary" disabled={busy !== null} onClick={() => void test()}>
              {busy === 'test' ? ap.testing : ap.testConnection}
            </button>
          </div>
          <span className="cap-help">
            {ap.defaultModelHelp}
            {conn.kind === 'anthropic' && hint ? ` ${hint}` : ''}
            {conn.modelsFetchedAt ? ap.modelListUpdated(new Date(conn.modelsFetchedAt).toLocaleString(), conn.models.length) : ''}
          </span>
        </div>
        {result && <Note tone={result.ok ? 'success' : 'danger'}>{result.text}</Note>}
      </div>
    </section>
  );
}

function AddProvider({ onAdd }: { onAdd: (kind: ProviderKind) => void }) {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
  return (
    <section className="cap-card" aria-label={ap.addProviderCard}>
      <div className="cap-card__head">
        <h2 className="cap-card__title">{ap.addProviderCard}</h2>
      </div>
      <div className="cap-card__body cap-pick-grid">
        {PROVIDER_ORDER.map((kind) => (
          <button key={kind} className="cap-provider-pick" onClick={() => onAdd(kind)}>
            {ap.picks[kind]?.name ?? PROVIDERS[kind].name}
            <small>{ap.picks[kind]?.note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AIProvidersSection() {
  const [ai, updateAI] = useAISettings();
  const { m } = useI18n();
  if (!ai) return null;
  const ap = m.options.aiProviders;

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
      <PageHead title={ap.title} lead={ap.lead} />
      <Note>
        {ap.privacyNoteBefore}
        <a href="#ai-privacy">{ap.privacyNoteLink}</a>
        {ap.privacyNoteAfter}
      </Note>
      {ai.connections.length === 0 && <Note tone="warn">{ap.noProviderWarn}</Note>}
      {ai.connections.map((c) => (
        <ConnectionCard key={c.id} conn={c} ai={ai} updateAI={updateAI} />
      ))}
      <AddProvider onAdd={add} />
    </>
  );
}
