import { browser } from '#imports';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
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
import { Confirm, LiveRegion, Note, PageHead, useConfirm } from '@/ui/controls';
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

function ApiKeyField({ conn, autoFocus }: { conn: ProviderConnection; autoFocus?: boolean }) {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
  const info = PROVIDERS[conn.kind];
  const id = useId();
  const helpId = useId();
  const [stored, setStored] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [show, setShow] = useState(false);
  const removing = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  // The field swaps between the saved key and an editor; this says where focus lands after the swap.
  const focusNext = useRef<'input' | 'replace' | null>(autoFocus ? 'input' : null);
  useEffect(() => {
    const target = focusNext.current === 'input' ? inputRef.current : focusNext.current === 'replace' ? replaceRef.current : null;
    if (!target) return;
    focusNext.current = null;
    target.focus();
  });
  useEffect(() => {
    void getApiKey(conn.id).then((k) => {
      setStored(k);
      setEditing(!k);
    });
  }, [conn.id]);
  if (stored === null) return null;
  const save = async () => {
    const key = draft.trim();
    await setApiKey(conn.id, draft);
    setStored(key);
    setDraft('');
    setEditing(!key);
    setShow(false);
    focusNext.current = key ? 'replace' : 'input';
  };
  const edit = (on: boolean) => {
    setEditing(on);
    focusNext.current = on ? 'input' : 'replace';
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
        <div key="edit" className="cap-row cap-inputrow">
          <input
            ref={inputRef}
            id={id}
            className="cap-input cap-input--mono"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? ap.pasteApiKey}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={helpId}
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
            <button className="cap-btn cap-btn--ghost" onClick={() => edit(false)}>
              {m.common.cancel}
            </button>
          )}
        </div>
      ) : (
        <div key="view" className="cap-row cap-inputrow">
          <input id={id} className="cap-input cap-input--mono" readOnly value={maskKey(stored)} aria-describedby={helpId} />
          <button ref={replaceRef} className="cap-btn" onClick={() => edit(true)}>
            {ap.replace}
          </button>
          <button
            ref={removing.trigger}
            className="cap-btn cap-btn--ghost cap-btn--danger"
            aria-expanded={removing.open}
            onClick={removing.ask}
          >
            {m.common.remove}
          </button>
        </div>
      )}
      {removing.open && !editing && (
        <Confirm
          action={ap.removeKey}
          onCancel={removing.close}
          onConfirm={() => {
            removing.close();
            void removeApiKey(conn.id).then(() => {
              setStored('');
              edit(true);
            });
          }}
        >
          {ap.confirmRemoveApiKey(info.name)}
        </Confirm>
      )}
      <span className="cap-help" id={helpId}>
        {ap.apiKeyHelp(info.name)}
      </span>
    </div>
  );
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ChatGPTAccountField({ conn, autoFocus }: { conn: ProviderConnection; autoFocus?: boolean }) {
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
        <div className="cap-row">
          <span className="cap-account">{ap.signedInAs(account.email, account.plan ? titleCase(account.plan) : undefined)}</span>
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
          <button className="cap-btn cap-btn--primary" autoFocus={autoFocus} onClick={() => void signIn()}>
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
  const [downloaded, setDownloaded] = useState(false);
  const LM = getLanguageModel();
  useEffect(() => {
    if (!LM) return setState('unsupported');
    void LM.availability(builtinOptions())
      .then(setState)
      .catch(() => setState('unavailable'));
  }, [LM]);
  const download = async () => {
    if (!LM || state === 'downloading') return;
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
      setDownloaded(true);
    } catch (err) {
      setState(`error: ${(err as Error).message}`);
    }
  };
  const percent = progress === null ? null : Math.round(progress * 100);
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
          <button className="cap-btn cap-btn--primary" aria-disabled={state === 'downloading'} onClick={() => void download()}>
            {state === 'downloading' ? ap.downloading : ap.downloadModel}
          </button>
          {percent !== null && (
            <>
              <div
                className="cap-progress cap-spacer"
                role="progressbar"
                aria-label={ap.onDeviceModel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              <span className="cap-help">{percent}%</span>
            </>
          )}
        </div>
      )}
      <LiveRegion>
        {state === 'downloading' && <span className="cap-sr">{ap.downloading}</span>}
        {downloaded && state === 'available' && <span className="cap-sr">{`${ap.onDeviceModel}: ${ap.readyTag}`}</span>}
        {state.startsWith('error') && <Note tone="danger">{state.replace(/^error: /, '')}</Note>}
      </LiveRegion>
      <span className="cap-help">{ap.chromeBuiltinHelp}</span>
    </div>
  );
}

function ConnectionCard({
  conn,
  ai,
  updateAI,
  isNew,
  onRemoved,
}: {
  conn: ProviderConnection;
  ai: AISettings;
  updateAI: UpdateAI;
  /** Just added: scroll it into view and put focus on what it needs first. */
  isNew: boolean;
  onRemoved: () => void;
}) {
  const { locale, m } = useI18n();
  const ap = m.options.aiProviders;
  const info = PROVIDERS[conn.kind];
  const hint = ap.hints[conn.kind] ?? info.hint;
  const titleId = useId();
  const modelId = useId();
  const urlId = useId();
  const urlHelpId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const removing = useConfirm();
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

  useEffect(() => {
    if (!isNew) return;
    const card = cardRef.current;
    card?.scrollIntoView({ block: 'start' });
    // A key or a sign-in focuses itself once loaded; otherwise the server address, or the name.
    if (info.requiresKey || info.signIn) return;
    const first = info.editableBaseUrl ? document.getElementById(urlId) : card?.querySelector<HTMLElement>('.cap-card__title-input');
    first?.focus({ preventScroll: true });
  }, []);

  const fetchModels = async () => {
    if (busy) return;
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
    if (busy) return;
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
    onRemoved();
    await releaseOrigins(originsToRequest(conn));
  };

  const where =
    info.protocol === 'chrome' ? ap.whereChrome : info.local ? ap.whereLocal : `${ap.picks[conn.kind]?.name ?? info.name} · ${host}`;

  return (
    <section className="cap-card" aria-labelledby={titleId} ref={cardRef}>
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
          ref={removing.trigger}
          className="cap-iconbtn"
          aria-label={ap.removeProviderAria(conn.label)}
          aria-expanded={removing.open}
          title={m.common.remove}
          onClick={removing.ask}
        >
          <IconTrash className="cap-ico" />
        </button>
      </div>
      <div className="cap-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {removing.open && (
          <Confirm
            action={m.common.remove}
            onCancel={removing.close}
            onConfirm={() => {
              removing.close();
              void remove();
            }}
          >
            {info.signIn
              ? ap.confirmRemoveSignIn(conn.label)
              : info.requiresKey
                ? ap.confirmRemoveKey(conn.label)
                : ap.confirmRemovePlain(conn.label)}
          </Confirm>
        )}
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
                  aria-invalid={urlError ? true : undefined}
                  aria-describedby={urlHelpId}
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
                <span className="cap-help" id={urlHelpId} style={urlError ? { color: 'var(--danger)' } : undefined}>
                  {urlError ?? ap.httpsRequiredHelp}
                </span>
              </div>
            )}
            {info.signIn ? (
              <ChatGPTAccountField conn={conn} autoFocus={isNew} />
            ) : (
              <ApiKeyField conn={conn} autoFocus={isNew && info.requiresKey} />
            )}
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
            {/* aria-disabled while busy, so the button that was pressed keeps focus. */}
            {info.protocol !== 'chrome' && (
              <button className="cap-btn" aria-disabled={busy !== null} onClick={() => void fetchModels()}>
                {busy === 'models' ? m.common.loading : conn.modelsFetchedAt ? ap.refreshList : ap.fetchModels}
              </button>
            )}
            <button className="cap-btn cap-btn--primary" aria-disabled={busy !== null} onClick={() => void test()}>
              {busy === 'test' ? ap.testing : ap.testConnection}
            </button>
          </div>
          <span className="cap-help">
            {ap.defaultModelHelp}
            {conn.kind === 'anthropic' && hint ? ` ${hint}` : ''}
            {conn.modelsFetchedAt ? ap.modelListUpdated(new Date(conn.modelsFetchedAt).toLocaleString(locale), conn.models.length) : ''}
          </span>
        </div>
        <LiveRegion>
          {busy ? (
            <span className="cap-sr">{busy === 'test' ? ap.testing : m.common.loading}</span>
          ) : (
            result && <Note tone={result.ok ? 'success' : 'danger'}>{result.text}</Note>
          )}
        </LiveRegion>
      </div>
    </section>
  );
}

function AddProvider({ onAdd, headingRef }: { onAdd: (kind: ProviderKind) => void; headingRef: Ref<HTMLHeadingElement> }) {
  const { m } = useI18n();
  const ap = m.options.aiProviders;
  return (
    <section className="cap-card" aria-label={ap.addProviderCard}>
      <div className="cap-card__head">
        <h2 className="cap-card__title" ref={headingRef} tabIndex={-1}>
          {ap.addProviderCard}
        </h2>
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
  const [added, setAdded] = useState<string | null>(null);
  const addRef = useRef<HTMLHeadingElement>(null);
  if (!ai) return null;
  const ap = m.options.aiProviders;

  const add = (kind: ProviderKind) => {
    const conn = newConnection(kind);
    // Ask for host access inside the click so Chrome shows its prompt right away.
    // (A custom endpoint has no URL yet; its card offers "Grant access" later.)
    if (PROVIDERS[kind].protocol !== 'chrome') void requestOrigins(originsToRequest(conn));
    setAdded(conn.id);
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
        <ConnectionCard
          key={c.id}
          conn={c}
          ai={ai}
          updateAI={updateAI}
          isNew={c.id === added}
          // The removed card took focus with it; the next step is usually adding another.
          onRemoved={() => addRef.current?.focus()}
        />
      ))}
      <AddProvider onAdd={add} headingRef={addRef} />
    </>
  );
}
