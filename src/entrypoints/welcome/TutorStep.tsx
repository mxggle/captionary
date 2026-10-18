import { useEffect, useId, useRef, useState } from 'react';
import { SIGN_IN_ORIGINS, signInWithChatGPT, signOutChatGPT, tokensItem } from '@/lib/ai/chatgpt-auth';
import { originsToRequest, releaseOrigins, requestOrigins } from '@/lib/ai/host-access';
import { builtinOptions, getLanguageModel } from '@/lib/ai/providers/chrome';
import { newConnection, PROVIDERS } from '@/lib/ai/registry';
import { getApiKey, removeApiKey, setApiKey } from '@/lib/ai/secrets';
import type { AIError, AIErrorCode, AISettings, ProviderConnection, ProviderKind } from '@/lib/ai/types';
import { bg } from '@/lib/messaging';
import { getAISettings, updateAISettings } from '@/lib/settings';
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
function plainError(code: AIErrorCode | undefined, message: string | undefined, provider: string): string {
  switch (code) {
    case 'auth':
    case 'missing_key':
      return provider === 'ChatGPT'
        ? 'ChatGPT didn’t accept the sign-in. Check that your plan is Plus, Pro or Business, then sign in again.'
        : `${provider} didn’t accept that key. Copy it again, all of it, and paste it here.`;
    case 'quota':
      // ChatGPT's own message names the plan limit, or says the plan lacks Codex.
      if (provider === 'ChatGPT' && message) return message;
      return `Your ${provider} account has no credit yet. Add a payment method or credit on ${provider}’s website, then try again.`;
    case 'rate_limit':
      return `${provider} is busy right now. Wait a minute, then try again.`;
    case 'network':
    case 'timeout':
    case 'unavailable':
      return `Captionary couldn’t reach ${provider}. Check your internet connection, then try again.`;
    case 'permission':
      return `Chrome blocked the connection to ${provider}. Try again and choose Allow when Chrome asks.`;
    default:
      return message || 'Something went wrong. Try again.';
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

export function TutorStep({ go }: StepProps) {
  const [status, refresh] = useTutorStatus();
  const [path, setPath] = useState<Path | null>(null);
  const [changing, setChanging] = useState(false);
  // While a panel connects, the tutor may look ready for a moment (a key saved before it is tested).
  const [busy, setBusy] = useState(false);
  const [builtin, setBuiltin] = useBuiltin();
  if (!status) return null;
  const ready = status.configured && status.enabled && !busy;
  const showChoices = !ready || changing;
  const panel = { setBusy, refresh, onConnected: () => setChanging(false) };

  return (
    <Step
      title="Add an AI tutor"
      meta="optional"
      lead="Translations and the dictionary already work without one. A tutor goes further: it explains what a word means in that exact sentence, breaks down the grammar, and answers your questions."
      foot={
        <Foot
          onBack={() => go('pin')}
          onNext={() => go('try')}
          nextLabel={ready ? 'Continue' : 'Skip for now'}
          quiet={!ready}
          note={ready ? undefined : 'You can add a tutor later in Settings.'}
        />
      }
    >
      {ready && !changing && (
        <Note
          tone="success"
          action={
            <button className="cap-btn cap-btn--sm" onClick={() => setChanging(true)}>
              Use a different one
            </button>
          }
        >
          Your tutor is ready: <strong>{status.providerName}</strong>
          {status.model ? <span className="cap-subtle"> · {status.model}</span> : null}
        </Note>
      )}
      {showChoices && (
        <>
          <fieldset className="cap-wizard__choices">
            <legend className="cap-wizard__legend">How would you like to add one?</legend>
            <Choice
              name="tutor"
              checked={path === 'chatgpt'}
              onSelect={() => setPath('chatgpt')}
              title="Sign in with ChatGPT"
              sub="If you pay for ChatGPT Plus, Pro or Business. Uses your plan, nothing extra to pay."
            />
            {builtin !== 'unsupported' && builtin !== 'unavailable' && (
              <Choice
                name="tutor"
                checked={path === 'builtin'}
                onSelect={() => setPath('builtin')}
                title="Use Chrome’s free built-in AI"
                sub="No account needed, and nothing leaves this computer. Its answers are simpler."
              />
            )}
            <Choice
              name="tutor"
              checked={path === 'key'}
              onSelect={() => setPath('key')}
              title="Paste an API key"
              sub="For OpenAI, Claude, Gemini and others. The provider charges you a little for what you use."
            />
          </fieldset>
          {path === 'chatgpt' && <ChatGPTPanel {...panel} />}
          {path === 'builtin' && <BuiltinPanel state={builtin} setState={setBuiltin} {...panel} />}
          {path === 'key' && <KeyPanel {...panel} />}
          <p className="cap-help">
            Running Ollama, LM Studio or your own server?{' '}
            <a href="/options.html#ai" target="_blank" rel="noopener">
              Add it in Settings
            </a>
            .
          </p>
        </>
      )}
    </Step>
  );
}

interface PanelProps {
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
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const signIn = async () => {
    setError(null);
    // Asked inside the click so Chrome shows its prompt (no prompt if already granted).
    if (!(await requestOrigins(SIGN_IN_ORIGINS))) {
      return setError('Captionary needs your permission to open the ChatGPT sign-in. Click the button again and choose Allow.');
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
      if (!r.ok) setError(plainError(r.code, r.error, 'ChatGPT'));
    } catch (err) {
      if ((err as AIError).code !== 'aborted') setError(plainError((err as AIError).code, (err as Error).message, 'ChatGPT'));
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
    <section className="cap-wizard__panel" aria-label="Sign in with ChatGPT">
      {waiting ? (
        <div className="cap-row">
          <span className="cap-spinner" />
          <span className="cap-spacer">A ChatGPT tab has opened. Sign in there; it closes by itself and brings you back here.</span>
          <button className="cap-btn cap-btn--ghost" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void signIn()}>
            Sign in with ChatGPT
          </button>
        </div>
      )}
      <p className="cap-help">You sign in on OpenAI’s own page. Captionary never sees your password.</p>
      {error && <Note tone="danger">{error}</Note>}
    </section>
  );
}

function BuiltinPanel({ state, setState, ...p }: PanelProps & { state: BuiltinState; setState: (s: BuiltinState) => void }) {
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
          monitor(m: EventTarget) {
            m.addEventListener('downloadprogress', (e) => setProgress((e as unknown as { loaded: number }).loaded));
          },
        });
        session.destroy();
        setState('available');
      }
      await setAsTutor((await connectionFor('chrome-builtin')).conn);
      ok = true;
    } catch (err) {
      setState('downloadable');
      setError(`Chrome couldn’t get its AI ready: ${(err as Error).message}`);
    } finally {
      await settle(p, ok);
    }
  };

  return (
    <section className="cap-wizard__panel" aria-label="Chrome’s built-in AI">
      {state === 'checking' && <span className="cap-spinner" />}
      {state === 'available' && (
        <div className="cap-row">
          <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void start()}>
            Use Chrome’s AI
          </button>
        </div>
      )}
      {state === 'downloadable' && (
        <>
          <p className="cap-wizard__text">
            Chrome downloads its AI model once. It’s large, so this can take a few minutes on a slow connection.
          </p>
          <div className="cap-row">
            <button className="cap-btn cap-btn--primary cap-btn--lg" onClick={() => void start()}>
              Download and use it
            </button>
          </div>
        </>
      )}
      {state === 'downloading' && (
        <div className="cap-wizard__download" aria-live="polite">
          <span>Downloading Chrome’s AI… {progress !== null && `${Math.round(progress * 100)}%`}</span>
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
      return setError(`Captionary needs your permission to talk to ${name}. Click Connect again and choose Allow.`);
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
        setError(plainError(r.code, r.error, name));
      }
    } catch (err) {
      setError(plainError((err as AIError).code, (err as Error).message, name));
    } finally {
      setWorking(false);
      await settle(p, ok);
    }
  };

  return (
    <section className="cap-wizard__panel" aria-label="Paste an API key">
      <fieldset className="cap-wizard__choices cap-wizard__choices--chips">
        <legend className="cap-wizard__legend">Which company is your key from?</legend>
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
                Open {name}’s key page
                <IconExternal className="cap-ico" />
              </a>
            ) : (
              `Open ${name}’s website`
            )}{' '}
            and sign in, or make an account.
          </span>
        </li>
        <li>
          <span className="cap-wizard__n">2</span>
          <span>Create a new key and copy it. It’s a long code{prefix ? ` that starts with ${prefix}` : ''}.</span>
        </li>
        <li>
          <span className="cap-wizard__n">3</span>
          <span>Paste it here and click Connect.</span>
        </li>
      </ol>
      <div className="cap-field">
        <label className="cap-label" htmlFor={inputId}>
          Your {name} key
        </label>
        <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
          <input
            id={inputId}
            className="cap-input cap-input--mono"
            type={show ? 'text' : 'password'}
            placeholder={info.keyPlaceholder ?? 'Paste your key'}
            value={key}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void connect()}
          />
          <button className="cap-btn cap-btn--lg" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
          <button className="cap-btn cap-btn--primary cap-btn--lg" disabled={!key.trim() || working} onClick={() => void connect()}>
            {working ? (
              <>
                <span className="cap-spinner" />
                Checking…
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
        <span className="cap-help">
          Your key stays on this computer and is sent only to {name}.
          {limit > 0 && ` Captionary stops after ${limit} requests a day, so costs can’t run away from you.`}
        </span>
      </div>
      {error && <Note tone="danger">{error}</Note>}
    </section>
  );
}
