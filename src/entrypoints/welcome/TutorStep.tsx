import { useEffect, useId, useRef, useState } from 'react';
import { SIGN_IN_ORIGINS, signInWithChatGPT, signOutChatGPT, tokensItem } from '@/lib/ai/chatgpt-auth';
import { originsToRequest, releaseOrigins, requestOrigins } from '@/lib/ai/host-access';
import { builtinOptions, getLanguageModel } from '@/lib/ai/providers/chrome';
import { newConnection, PROVIDERS } from '@/lib/ai/registry';
import { getApiKey, removeApiKey, setApiKey } from '@/lib/ai/secrets';
import type { AIError, AIErrorCode, AISettings, ProviderConnection, ProviderKind } from '@/lib/ai/types';
import { useI18n, type Messages } from '@/lib/i18n';
import { bg } from '@/lib/messaging';
import { getAISettings, updateAISettings, type Settings } from '@/lib/settings';
import { Note } from '@/ui/controls';
import { useAISettings } from '@/ui/form';
import { IconExternal } from '@/ui/icons';
import { Choice, Foot, Step, useTutorStatus, type StepProps } from './parts';

type Path = 'chatgpt' | 'builtin' | 'key';
type BuiltinState = 'checking' | 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

/** Providers offered for a pasted key, most common first. Groq (easily mistaken for Grok), local servers and custom endpoints stay in Settings. */
const KEY_PROVIDERS: { kind: ProviderKind; name: string }[] = [
  { kind: 'openai', name: 'OpenAI' },
  { kind: 'anthropic', name: 'Claude' },
  { kind: 'gemini', name: 'Google Gemini' },
  { kind: 'deepseek', name: 'DeepSeek' },
  { kind: 'xai', name: 'Grok (xAI)' },
  { kind: 'mistral', name: 'Mistral' },
  { kind: 'openrouter', name: 'OpenRouter' },
];

/** What went wrong, and what to do about it, in words for someone who has never seen an API. */
function plainError(code: AIErrorCode | undefined, message: string | undefined, provider: string, m: Messages): string {
  switch (code) {
    case 'auth':
    case 'missing_key':
      return provider === 'ChatGPT' ? m.welcome.tutor.errors.authChatgpt : m.welcome.tutor.errors.authKey(provider);
    case 'quota':
      // ChatGPT's own message names the plan limit, or says the plan lacks Codex.
      if (provider === 'ChatGPT' && message) return message;
      return m.welcome.tutor.errors.quota(provider);
    case 'rate_limit':
      return m.welcome.tutor.errors.rateLimit(provider);
    case 'network':
    case 'timeout':
    case 'unavailable':
      return m.welcome.tutor.errors.network(provider);
    case 'permission':
      return m.welcome.tutor.errors.permission(provider);
    default:
      return message || m.welcome.tutor.errors.default;
  }
}

/** The learner's connection of this kind, or a new unsaved one. */
async function connectionFor(kind: ProviderKind): Promise<{ conn: ProviderConnection; isNew: boolean }> {
  const existing = (await getAISettings()).connections.find((c) => c.kind === kind);
  return existing ? { conn: existing, isNew: false } : { conn: newConnection(kind), isNew: true };
}

/** Save the connection and make it the tutor. */
export async function setAsTutor(conn: ProviderConnection) {
  await updateAISettings((s) => {
    if (!s.connections.some((c) => c.id === conn.id)) s.connections.push(conn);
    s.defaultConnectionId = conn.id;
    s.enabled = true;
  });
}

/** Undo `setAsTutor` for a connection the guide added (a key or sign-in that did not work). */
async function forget(conn: ProviderConnection, before: AISettings) {
  await (PROVIDERS[conn.kind].signIn ? signOutChatGPT(conn.id) : removeApiKey(conn.id));
  await updateAISettings((s) => {
    s.connections = s.connections.filter((c) => c.id !== conn.id);
    const previousDefault = before.defaultConnectionId;
    s.defaultConnectionId =
      previousDefault && s.connections.some((c) => c.id === previousDefault) ? previousDefault : (s.connections[0]?.id ?? null);
    s.enabled = before.enabled;
  });
}

/**
 * Leave things as they were after a connection that does not work: it should not become the
 * tutor. A connection the guide added goes; an existing one gets its credential back.
 */
export async function undoTutor(conn: ProviderConnection, isNew: boolean, before: AISettings, restoreCredential: () => Promise<void>) {
  if (isNew) return forget(conn, before);
  await restoreCredential();
  await updateAISettings((s) => {
    s.defaultConnectionId = before.defaultConnectionId;
    s.enabled = before.enabled;
  });
}

function useBuiltin(): [BuiltinState, (s: BuiltinState) => void] {
  const LM = getLanguageModel();
  const [state, setState] = useState<BuiltinState>(LM ? 'checking' : 'unsupported');
  useEffect(() => {
    if (!LM) return;
    void LM.availability(builtinOptions())
      .then(setState)
      .catch(() => setState('unavailable'));
  }, [LM]);
  return [state, setState];
}

export function TutorStep({ s, go }: StepProps) {
  const { m } = useI18n(s);
  const [status, refresh] = useTutorStatus();
  const [path, setPath] = useState<Path | null>(null);
  const [changing, setChanging] = useState(false);
  // While a panel connects, the tutor may look ready for a moment (a key saved before it is tested).
  const [busy, setBusy] = useState(false);
  // Set when a panel has just connected a tutor: it is announced, and Continue takes focus.
  const [connected, setConnected] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [builtin, setBuiltin] = useBuiltin();
  const ready = !!status && status.configured && status.enabled && !busy;
  const showChoices = !!status && (!ready || changing);
  useEffect(() => {
    if (connected && ready) nextRef.current?.focus();
  }, [connected, ready]);
  const panel = {
    s,
    setBusy,
    refresh,
    onConnected: () => {
      setChanging(false);
      setConnected(true);
    },
  };

  return (
    <Step
      title={m.welcome.tutor.title}
      meta={m.welcome.tutor.optionalMeta}
      lead={m.welcome.tutor.lead}
      foot={
        <Foot
          onBack={() => go('pin')}
          onNext={() => go('try')}
          nextLabel={ready ? m.common.continue : m.welcome.tutor.skipForNow}
          quiet={!ready}
          note={ready ? undefined : m.welcome.tutor.addLaterNote}
          nextRef={nextRef}
        />
      }
    >
      <div className="cap-sr" role="status">
        {connected && ready && (
          <>
            {m.welcome.tutor.tutorReady}
            {status?.providerName}
          </>
        )}
      </div>
      {!status && (
        <p className="cap-wizard__waiting">
          <span className="cap-spinner" />
          {m.common.loading}
        </p>
      )}
      {status && ready && !changing && (
        <Note
          tone="success"
          action={
            <button
              className="cap-btn cap-btn--sm"
              onClick={() => {
                setChanging(true);
                setConnected(false);
              }}
            >
              {m.welcome.tutor.useDifferentOne}
            </button>
          }
        >
          {m.welcome.tutor.tutorReady}
          <strong>{status.providerName}</strong>
          {status.model ? <span className="cap-subtle"> · {status.model}</span> : null}
        </Note>
      )}
      {showChoices && (
        <>
          <fieldset className="cap-wizard__choices">
            <legend className="cap-wizard__legend">{m.welcome.tutor.howToAddLegend}</legend>
            <Choice
              name="tutor"
              checked={path === 'chatgpt'}
              onSelect={() => setPath('chatgpt')}
              title={m.welcome.tutor.chatgptTitle}
              sub={m.welcome.tutor.chatgptSub}
            />
            {builtin !== 'unsupported' && builtin !== 'unavailable' && (
              <Choice
                name="tutor"
                checked={path === 'builtin'}
                onSelect={() => setPath('builtin')}
                title={m.welcome.tutor.builtinTitle}
                sub={m.welcome.tutor.builtinSub}
              />
            )}
            <Choice
              name="tutor"
              checked={path === 'key'}
              onSelect={() => setPath('key')}
              title={m.welcome.tutor.keyTitle}
              sub={m.welcome.tutor.keySub}
            />
          </fieldset>
          {path === 'chatgpt' && <ChatGPTPanel {...panel} />}
          {path === 'builtin' && <BuiltinPanel state={builtin} setState={setBuiltin} {...panel} />}
          {path === 'key' && <KeyPanel {...panel} />}
          <p className="cap-help">
            {m.welcome.tutor.localServerHelpBefore}
            <a href="/options.html#ai" target="_blank" rel="noopener">
              {m.welcome.tutor.localServerHelpLink}
            </a>
            {m.welcome.tutor.localServerHelpAfter}
          </p>
        </>
      )}
    </Step>
  );
}

interface PanelProps {
  s: Settings;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
  onConnected: () => void;
}

/** Finish a connection attempt: read the tutor's state first, so it never shows ready and then not. */
async function settle(p: PanelProps, ok: boolean) {
  await p.refresh();
  p.setBusy(false);
  if (ok) p.onConnected();
}

function ChatGPTPanel(p: PanelProps) {
  const { m } = useI18n(p.s);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const signIn = async () => {
    setError(null);
    // Asked inside the click so Chrome shows its prompt (no prompt if already granted).
    if (!(await requestOrigins(SIGN_IN_ORIGINS))) {
      return setError(m.welcome.tutor.chatgptPermissionErr);
    }
    const { conn, isNew } = await connectionFor('chatgpt');
    const before = await getAISettings();
    const previousTokens = isNew ? null : await tokensItem(conn.id).getValue();
    abort.current = new AbortController();
    setWaiting(true);
    p.setBusy(true);
    let signedIn = false;
    let ok = false;
    try {
      await signInWithChatGPT(conn.id, abort.current.signal);
      signedIn = true;
      await setAsTutor(conn);
      const r = await bg({ type: 'ai.test', connectionId: conn.id });
      ok = r.ok;
      if (!r.ok) setError(plainError(r.code, r.error, 'ChatGPT', m));
    } catch (err) {
      if ((err as AIError).code !== 'aborted') setError(plainError((err as AIError).code, (err as Error).message, 'ChatGPT', m));
    } finally {
      if (signedIn && !ok) {
        await undoTutor(conn, isNew, before, () =>
          previousTokens ? tokensItem(conn.id).setValue(previousTokens) : signOutChatGPT(conn.id),
        );
      }
      await releaseOrigins(SIGN_IN_ORIGINS);
      setWaiting(false);
      await settle(p, ok);
    }
  };

  return (
    <section className="cap-wizard__panel" aria-label={m.welcome.tutor.chatgptPanelAria}>
      {waiting ? (
        <div className="cap-row">
          <span className="cap-spinner" />
          <span className="cap-spacer">{m.welcome.tutor.chatgptWaiting}</span>
          <button className="cap-btn cap-btn--ghost" onClick={() => abort.current?.abort()}>
            {m.common.cancel}
          </button>
        </div>
      ) : (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void signIn()}>
            {m.welcome.tutor.chatgptSignInBtn}
          </button>
        </div>
      )}
      <p className="cap-help">{m.welcome.tutor.chatgptPasswordHelp}</p>
      {error && <Note tone="danger">{error}</Note>}
    </section>
  );
}

function BuiltinPanel({ state, setState, ...p }: PanelProps & { state: BuiltinState; setState: (s: BuiltinState) => void }) {
  const { m } = useI18n(p.s);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const LM = getLanguageModel();
    if (!LM) return;
    setError(null);
    p.setBusy(true);
    let ok = false;
    try {
      if (state !== 'available') {
        // The first download has to start from a click.
        setState('downloading');
        const session = await LM.create({
          ...builtinOptions(),
          monitor(ev: EventTarget) {
            ev.addEventListener('downloadprogress', (e) => setProgress((e as unknown as { loaded: number }).loaded));
          },
        });
        session.destroy();
        setState('available');
      }
      await setAsTutor((await connectionFor('chrome-builtin')).conn);
      ok = true;
    } catch (err) {
      setState('downloadable');
      setError(m.welcome.tutor.chromeAiReadyErr((err as Error).message));
    } finally {
      await settle(p, ok);
    }
  };

  return (
    <section className="cap-wizard__panel" aria-label={m.welcome.tutor.builtinPanelAria}>
      {state === 'checking' && <span className="cap-spinner" />}
      {state === 'available' && (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void start()}>
            {m.welcome.tutor.useChromeAiBtn}
          </button>
        </div>
      )}
      {state === 'downloadable' && (
        <>
          <p className="cap-wizard__text">{m.welcome.tutor.builtinDownloadText}</p>
          <div className="cap-row">
            <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void start()}>
              {m.welcome.tutor.downloadAndUseBtn}
            </button>
          </div>
        </>
      )}
      {state === 'downloading' && (
        <div className="cap-wizard__download" aria-live="polite">
          <span>{m.welcome.tutor.downloadingChromeAi(progress !== null ? `${Math.round(progress * 100)}%` : '')}</span>
          <div className="cap-progress">
            <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <Note tone="danger">{error}</Note>}
    </section>
  );
}

function KeyPanel(p: PanelProps) {
  const { m } = useI18n(p.s);
  const [kind, setKind] = useState<ProviderKind>('openai');
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const info = PROVIDERS[kind];
  const name = KEY_PROVIDERS.find((k) => k.kind === kind)?.name ?? info.name;
  const prefix = info.keyPlaceholder?.replace('…', '');
  const [ai] = useAISettings();
  const limit = ai?.dailyRequestLimit ?? 0;

  const connect = async () => {
    const value = key.trim();
    if (!value) return;
    setError(null);
    // Asked inside the click so Chrome shows its prompt.
    if (!(await requestOrigins(originsToRequest({ kind, baseUrl: info.defaultBaseUrl })))) {
      return setError(m.welcome.tutor.talkPermissionErr(name));
    }
    setWorking(true);
    p.setBusy(true);
    let ok = false;
    try {
      const { conn, isNew } = await connectionFor(kind);
      const before = await getAISettings();
      const previousKey = isNew ? '' : await getApiKey(conn.id);
      await setApiKey(conn.id, value);
      await setAsTutor(conn);
      const r = await bg({ type: 'ai.test', connectionId: conn.id });
      ok = r.ok;
      if (ok) {
        setKey('');
      } else {
        await undoTutor(conn, isNew, before, () => setApiKey(conn.id, previousKey));
        setError(plainError(r.code, r.error, name, m));
      }
    } catch (err) {
      setError(plainError((err as AIError).code, (err as Error).message, name, m));
    } finally {
      setWorking(false);
      await settle(p, ok);
    }
  };

  return (
    <section className="cap-wizard__panel" aria-label={m.welcome.tutor.keyPanelAria}>
      <fieldset className="cap-wizard__choices cap-wizard__choices--chips">
        <legend className="cap-wizard__legend">{m.welcome.tutor.whichCompanyLegend}</legend>
        {KEY_PROVIDERS.map((k) => (
          <label key={k.kind} className="cap-chip cap-wizard__chip">
            <input
              type="radio"
              className="cap-sr"
              name="key-provider"
              checked={kind === k.kind}
              onChange={() => {
                setKind(k.kind);
                setError(null);
              }}
            />
            {k.name}
          </label>
        ))}
      </fieldset>
      <ol className="cap-wizard__howto cap-wizard__howto--sm">
        <li>
          <span className="cap-wizard__n">1</span>
          <span>
            {info.keyUrl ? (
              <a href={info.keyUrl} target="_blank" rel="noopener noreferrer">
                {m.welcome.tutor.openKeyPage(name)}
                <IconExternal className="cap-ico" />
              </a>
            ) : (
              m.welcome.tutor.openWebsite(name)
            )}
            {m.welcome.tutor.andSignIn}
          </span>
        </li>
        <li>
          <span className="cap-wizard__n">2</span>
          <span>{m.welcome.tutor.createNewKey(prefix)}</span>
        </li>
        <li>
          <span className="cap-wizard__n">3</span>
          <span>{m.welcome.tutor.pasteAndConnect}</span>
        </li>
      </ol>
      <div className="cap-field">
        <label className="cap-label" htmlFor={inputId}>
          {m.welcome.tutor.yourKeyLabel(name)}
        </label>
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input
            id={inputId}
            className="cap-input cap-input--mono"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? m.welcome.tutor.pasteYourKeyPlaceholder}
            value={key}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
            // Enter while an input method is composing picks a candidate, not Connect.
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && void connect()}
          />
          <button className="cap-btn cap-btn--lg" onClick={() => setShow(!show)}>
            {show ? m.options.aiProviders.hide : m.options.aiProviders.show}
          </button>
          <button className="cap-btn cap-btn--primary cap-btn--lg" disabled={!key.trim() || working} onClick={() => void connect()}>
            {working ? (
              <>
                <span className="cap-spinner" />
                {m.welcome.tutor.checking}
              </>
            ) : (
              m.welcome.tutor.connectBtn
            )}
          </button>
        </div>
        <span className="cap-help">{m.welcome.tutor.keyStaysHelp(name, limit)}</span>
      </div>
      {error && <Note tone="danger">{error}</Note>}
    </section>
  );
}
