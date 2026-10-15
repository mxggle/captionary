import { browser } from '#imports';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TabStatus } from '@/content/controller';
import { bg, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { Switch, keyLabel } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { BrandMark, IconBookmark, IconCards, IconDocument, IconSettings, IconSpark } from '@/ui/icons';
import { useVocabMap } from '@/ui/useVocab';

const SITE_NAMES: Record<string, string> = { youtube: 'YouTube', netflix: 'Netflix', appletv: 'Apple TV+' };
const VIDEO_HOSTS = /(^|\.)(youtube\.com|netflix\.com|tv\.apple\.com)$/;

function open(page: 'options' | 'vocab' | 'reader', hash?: string) {
  void bg({ type: 'open.page', page, hash }).then(() => window.close());
}

interface ActiveTab {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
}

/** The active tab and what Captionary is doing there (the content script answers; other pages don't). */
function useThisTab(): { tab: ActiveTab | null; status: TabStatus | null | undefined; setStatus: (s: TabStatus) => void } {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [status, setStatus] = useState<TabStatus | null | undefined>(undefined);
  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
      setTab(t ?? {});
      if (t?.id === undefined) return setStatus(null);
      try {
        setStatus(((await browser.tabs.sendMessage(t.id, { type: 'captionary.tabStatus' })) as TabStatus | undefined) ?? null);
      } catch {
        setStatus(null);
      }
    });
  }, []);
  return { tab, status, setStatus };
}

function Tag({ tone, children }: { tone: 'known' | 'warn' | 'danger' | 'off' | 'loading'; children: ReactNode }) {
  const cls =
    tone === 'known'
      ? 'cap-tag cap-tag--known'
      : tone === 'warn'
        ? 'cap-tag cap-tag--warn'
        : tone === 'danger'
          ? 'cap-tag cap-tag--danger'
          : 'cap-tag';
  return (
    <span className={cls} style={{ flex: 'none' }}>
      {tone === 'loading' ? (
        <span className="cap-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
      ) : (
        <span
          className={`cap-dot${tone === 'warn' ? ' cap-dot--warn' : tone === 'danger' ? ' cap-dot--danger' : tone === 'off' ? ' cap-dot--off' : ''}`}
        />
      )}
      {children}
    </span>
  );
}

function hostOf(url: string | undefined): string | null {
  try {
    const u = new URL(url ?? '');
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

function ThisTab({ s, update }: { s: Settings; update: (fn: (s: Settings) => void) => Promise<unknown> }) {
  const { tab, status, setStatus } = useThisTab();
  if (!tab || status === undefined) {
    return (
      <section className="cap-tile" aria-label="This tab" aria-busy="true">
        <div className="cap-tile__sub">On this tab</div>
        <span className="cap-spinner" />
      </section>
    );
  }
  const host = hostOf(tab.url);
  const head = (title: string, tag: ReactNode) => (
    <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
      <div className="cap-spacer" style={{ minWidth: 0 }}>
        <div className="cap-tile__sub">On this tab</div>
        <div className="cap-tile__title cap-ellipsis">{title}</div>
      </div>
      {tag}
    </div>
  );
  const text = (t: ReactNode) => <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)' }}>{t}</p>;

  if (!status) {
    if (host && VIDEO_HOSTS.test(host)) {
      return (
        <section className="cap-tile" aria-label="This tab">
          {head(tab.title ?? host, <Tag tone="warn">Reload</Tag>)}
          {text('Reload this tab to start Captionary here.')}
        </section>
      );
    }
    return (
      <section className="cap-tile" aria-label="This tab">
        {head(host ? `${host} · ${tab.title ?? ''}` : 'This page', <Tag tone="off">No video</Tag>)}
        {host ? (
          <>
            {text('Read it with clickable words, or select any text and right-click → Explain with Captionary.')}
            <div>
              <button
                className="cap-btn cap-btn--primary cap-btn--sm"
                disabled={tab.id === undefined}
                onClick={() => void bg({ type: 'reader.openTab', tabId: tab.id! }).then(() => window.close())}
              >
                <IconDocument className="cap-ico" />
                Open this page in the reader
              </button>
            </div>
          </>
        ) : (
          text('Captionary works on YouTube, Netflix and Apple TV+, and in the reader.')
        )}
      </section>
    );
  }

  const site = SITE_NAMES[status.site] ?? 'this site';
  const title = status.title ? `${status.title} · ${site}` : site;
  if (!status.enabled) {
    return (
      <section className="cap-tile" aria-label="This tab">
        {head(title, <Tag tone="off">Off</Tag>)}
        {text(
          s.enabled
            ? `Captionary is off on ${site}. Turn it on in Settings → General.`
            : 'Captionary is off. Turn it on with the switch above.',
        )}
      </section>
    );
  }
  if (!status.title) {
    return (
      <section className="cap-tile" aria-label="This tab">
        {head(site, <Tag tone="off">No video</Tag>)}
        {text('Open a video and Captionary starts on its own.')}
      </section>
    );
  }
  const tag = status.off ? (
    <Tag tone="off">Off for this video</Tag>
  ) : status.status === 'ready' ? (
    <Tag tone="known">Working</Tag>
  ) : status.status === 'loading' ? (
    <Tag tone="loading">Loading</Tag>
  ) : status.status === 'none' ? (
    <Tag tone="warn">No subtitles</Tag>
  ) : status.status === 'error' ? (
    <Tag tone="danger">Error</Tag>
  ) : (
    <Tag tone="off">Waiting</Tag>
  );
  return (
    <section className="cap-tile" aria-label="This tab">
      {head(title, tag)}
      {(status.status === 'none' || status.status === 'error') && status.message && text(status.message)}
      <div className="cap-row" role="group" aria-label="This video">
        <button
          className="cap-chip cap-chip--sm"
          aria-pressed={status.listOpen}
          onClick={() =>
            void browser.tabs
              .sendMessage(tab.id!, { type: 'captionary.toggleList' })
              .then((next) => next && setStatus(next as TabStatus))
              .catch(() => undefined)
          }
        >
          Subtitle list <span className="cap-chip__n">{keyLabel(s.shortcuts.toggleSidebar)}</span>
        </button>
        <button
          className="cap-chip cap-chip--sm"
          aria-pressed={s.playback.autoPause}
          onClick={() => void update((st) => void (st.playback.autoPause = !st.playback.autoPause))}
        >
          Pause after each line <span className="cap-chip__n">{keyLabel(s.shortcuts.toggleAutoPause)}</span>
        </button>
      </div>
    </section>
  );
}

function TutorStatus({ ai }: { ai: AIStatus | null }) {
  if (!ai) return <div className="cap-row cap-popup__foot" />;
  const settings = (
    <button className="cap-iconbtn cap-iconbtn--sm" aria-label="Settings" title="Settings" onClick={() => open('options', 'general')}>
      <IconSettings className="cap-ico" />
    </button>
  );
  if (!ai.enabled) {
    return (
      <div className="cap-row cap-popup__foot">
        <span className="cap-dot cap-dot--off" />
        <span className="cap-spacer">The tutor is off.</span>
        {settings}
      </div>
    );
  }
  if (!ai.configured) {
    return (
      <div className="cap-row cap-popup__foot">
        <span className="cap-dot cap-dot--warn" />
        <span className="cap-spacer">The tutor isn’t set up.</span>
        <a
          href="/options.html#ai"
          onClick={(e) => {
            e.preventDefault();
            open('options', 'ai');
          }}
        >
          Connect a provider
        </a>
      </div>
    );
  }
  return (
    <div className="cap-row cap-popup__foot">
      <span className="cap-dot" />
      <span className="cap-spacer cap-ellipsis">
        Tutor: {ai.providerName} · <span className="cap-mono">{ai.model}</span>
      </span>
      {settings}
    </div>
  );
}

/** The toolbar pop-up: this tab, your languages, the tools, the tutor. */
export function Popup() {
  const [s, update] = useSettings();
  const vocab = useVocabMap();
  const [ai, setAi] = useState<AIStatus | null>(null);
  const [windowId, setWindowId] = useState<number | undefined>();
  useEffect(() => {
    void bg({ type: 'ai.status' })
      .then(setAi)
      .catch(() => undefined);
    void browser.windows.getCurrent().then((w) => setWindowId(w.id));
  }, []);
  const counts = useMemo(() => {
    const items = Object.values(vocab);
    return { learning: items.filter((i) => i.status === 'learning').length, known: items.filter((i) => i.status === 'known').length };
  }, [vocab]);
  if (!s) return null;
  return (
    <div className="cap-popup">
      <div className="cap-row" style={{ flexWrap: 'nowrap', gap: 10 }}>
        <BrandMark />
        <span className="cap-spacer cap-popup__brand">Captionary</span>
        <Switch label="Captionary on" checked={s.enabled} onChange={(v) => void update((st) => void (st.enabled = v))} />
      </div>

      <ThisTab s={s} update={update} />

      <div className="cap-popup__sentence">
        I’m learning{' '}
        <LanguageSelect
          variant="sentence"
          label="I’m learning"
          allowAuto
          value={s.targetLanguage}
          onChange={(v) => void update((st) => void (st.targetLanguage = v))}
        />{' '}
        and I speak{' '}
        <LanguageSelect
          variant="sentence"
          label="I speak"
          value={s.nativeLanguage}
          onChange={(v) => void update((st) => void (st.nativeLanguage = v))}
        />
      </div>

      <nav className="cap-popup__tiles" aria-label="Captionary pages">
        <button className="cap-tile" onClick={() => open('vocab')}>
          <span className="cap-row" style={{ justifyContent: 'space-between' }}>
            <span className="cap-tile__icon cap-tile__icon--learn">
              <IconBookmark className="cap-ico" strokeWidth={2.2} />
            </span>
            <span className="cap-tile__count">{counts.learning}</span>
          </span>
          <span>
            <span className="cap-tile__title" style={{ display: 'block' }}>
              Saved words
            </span>
            <span className="cap-tile__sub">
              {counts.learning} learning · {counts.known} known
            </span>
          </span>
        </button>
        <button className="cap-tile" onClick={() => open('vocab', 'review')}>
          <span className="cap-tile__icon">
            <IconCards className="cap-ico" />
          </span>
          <span>
            <span className="cap-tile__title" style={{ display: 'block' }}>
              Review
            </span>
            <span className="cap-tile__sub">Flashcards from your words</span>
          </span>
        </button>
        <button className="cap-tile" onClick={() => open('reader')}>
          <span className="cap-tile__icon">
            <IconDocument className="cap-ico" />
          </span>
          <span>
            <span className="cap-tile__title" style={{ display: 'block' }}>
              Reader
            </span>
            <span className="cap-tile__sub">Text, files, local video</span>
          </span>
        </button>
        <button
          className="cap-tile"
          disabled={windowId === undefined}
          // Called synchronously so the click still counts as a user gesture.
          onClick={() => void browser.sidePanel.open({ windowId: windowId! }).then(() => window.close())}
        >
          <span className="cap-row" style={{ justifyContent: 'space-between' }}>
            <span className="cap-tile__icon" style={{ color: 'var(--accent)' }}>
              <IconSpark className="cap-ico" />
            </span>
            <span className="cap-kbd">Alt L</span>
          </span>
          <span>
            <span className="cap-tile__title" style={{ display: 'block' }}>
              AI tutor
            </span>
            <span className="cap-tile__sub">Explain any selection</span>
          </span>
        </button>
      </nav>

      <TutorStatus ai={ai} />
    </div>
  );
}
