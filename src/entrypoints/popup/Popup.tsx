import { browser } from '#imports';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TabStatus } from '@/content/controller';
import { useI18n } from '@/lib/i18n';
import { bg, type AIStatus } from '@/lib/messaging';
import { setupProgress, type SetupProgress } from '@/lib/onboarding';
import type { Settings } from '@/lib/settings';
import { Switch, keyLabel } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { BrandMark, IconBookmark, IconCards, IconDocument, IconSettings, IconSpark } from '@/ui/icons';
import { useVocabMap } from '@/ui/useVocab';

const SITE_NAMES: Record<string, string> = { youtube: 'YouTube', netflix: 'Netflix', appletv: 'Apple TV+' };
const VIDEO_HOSTS = /(^|\.)(youtube\.com|netflix\.com|tv\.apple\.com)$/;

function open(page: 'options' | 'vocab' | 'reader' | 'welcome', hash?: string) {
  void bg({ type: 'open.page', page, hash }).then(() => window.close());
}

interface ActiveTab {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
}

/** What Captionary is doing in a tab: its content script answers; other pages don't (null). */
async function askTab(tabId: number): Promise<TabStatus | null> {
  try {
    return ((await browser.tabs.sendMessage(tabId, { type: 'captionary.tabStatus' })) as TabStatus | undefined) ?? null;
  } catch {
    return null;
  }
}

/** The tab is still changing: subtitles loading, a video starting, or a switch the tab has not caught up with. */
function settling(status: TabStatus | null | undefined, s: Settings): boolean {
  if (!status) return false;
  const on = s.enabled && (status.site === 'local' || s.sites[status.site]);
  if (status.enabled !== on) return true;
  return status.enabled && !!status.title && !status.off && (status.status === 'loading' || status.status === 'idle');
}

/** The active tab and what Captionary is doing there, asked again each second until it settles. */
function useThisTab(s: Settings): { tab: ActiveTab | null; status: TabStatus | null | undefined; setStatus: (s: TabStatus) => void } {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [status, setStatus] = useState<TabStatus | null | undefined>(undefined);
  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
      setTab(t ?? {});
      setStatus(t?.id === undefined ? null : await askTab(t.id));
    });
  }, []);
  const tabId = tab?.id;
  const changing = settling(status, s);
  useEffect(() => {
    if (!changing || tabId === undefined) return;
    const t = setInterval(() => void askTab(tabId).then(setStatus), 1000);
    return () => clearInterval(t);
  }, [changing, tabId]);
  return { tab, status, setStatus };
}

/** The shortcut the learner gave a command in chrome://extensions/shortcuts; empty when it has none. */
function useCommandShortcut(name: string): string {
  const [shortcut, setShortcut] = useState('');
  useEffect(() => {
    void browser.commands
      .getAll()
      .then((all) => setShortcut(all.find((c) => c.name === name)?.shortcut ?? ''))
      .catch(() => undefined);
  }, [name]);
  return shortcut;
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
  const { m } = useI18n(s);
  const { tab, status, setStatus } = useThisTab(s);
  if (!tab || status === undefined) {
    return (
      <section className="cap-tile" aria-label={m.popup.thisTabAria} aria-busy="true">
        <div className="cap-tile__sub">{m.popup.onThisTab}</div>
        <span className="cap-spinner" />
      </section>
    );
  }
  const host = hostOf(tab.url);
  const head = (title: string, tag: ReactNode) => (
    <div className="cap-row" style={{ flexWrap: 'nowrap' }}>
      <div className="cap-spacer" style={{ minWidth: 0 }}>
        <div className="cap-tile__sub">{m.popup.onThisTab}</div>
        <div className="cap-tile__title cap-ellipsis">{title}</div>
      </div>
      {tag}
    </div>
  );
  const text = (t: ReactNode) => <p className="cap-tile__text">{t}</p>;

  if (!status) {
    if (host && VIDEO_HOSTS.test(host)) {
      return (
        <section className="cap-tile" aria-label={m.popup.thisTabAria}>
          {head(tab.title ?? host, <Tag tone="warn">{m.popup.reloadTag}</Tag>)}
          {text(m.popup.reloadHint)}
        </section>
      );
    }
    return (
      <section className="cap-tile" aria-label={m.popup.thisTabAria}>
        {head(host ? `${host} · ${tab.title ?? ''}` : m.popup.thisPage, <Tag tone="off">{m.popup.noVideoTag}</Tag>)}
        {host ? (
          <>
            {text(m.popup.readerHint)}
            <div>
              <button
                className="cap-btn cap-btn--primary cap-btn--sm"
                disabled={tab.id === undefined}
                onClick={() => void bg({ type: 'reader.openTab', tabId: tab.id! }).then(() => window.close())}
              >
                <IconDocument className="cap-ico" />
                {m.popup.openInReader}
              </button>
            </div>
          </>
        ) : (
          text(m.popup.worksOnHint)
        )}
      </section>
    );
  }

  const site = SITE_NAMES[status.site] ?? m.popup.thisSite;
  const title = status.title ? `${status.title} · ${site}` : site;
  if (!status.enabled) {
    const key = status.site;
    return (
      <section className="cap-tile" aria-label={m.popup.thisTabAria}>
        {head(title, <Tag tone="off">{m.common.off}</Tag>)}
        {text(s.enabled ? m.popup.offOnSiteHint(site) : m.popup.offGlobalHint)}
        {s.enabled && key !== 'local' && !s.sites[key] && (
          <div>
            <button className="cap-btn cap-btn--sm" onClick={() => void update((st) => void (st.sites[key] = true))}>
              {m.popup.turnOnForSite(site)}
            </button>
          </div>
        )}
      </section>
    );
  }
  if (!status.title) {
    return (
      <section className="cap-tile" aria-label={m.popup.thisTabAria}>
        {head(site, <Tag tone="off">{m.popup.noVideoTag}</Tag>)}
        {text(m.popup.openVideoHint)}
      </section>
    );
  }
  const tag = status.off ? (
    <Tag tone="off">{m.popup.offForVideoTag}</Tag>
  ) : status.status === 'ready' ? (
    <Tag tone="known">{m.popup.workingTag}</Tag>
  ) : status.status === 'loading' ? (
    <Tag tone="loading">{m.popup.loadingTag}</Tag>
  ) : status.status === 'none' ? (
    <Tag tone="warn">{m.popup.noSubtitlesTag}</Tag>
  ) : status.status === 'error' ? (
    <Tag tone="danger">{m.popup.errorTag}</Tag>
  ) : (
    <Tag tone="off">{m.popup.waitingTag}</Tag>
  );
  return (
    <section className="cap-tile" aria-label={m.popup.thisTabAria}>
      {head(title, tag)}
      {(status.status === 'none' || status.status === 'error') && status.message && text(status.message)}
      <div className="cap-row" role="group" aria-label={m.popup.thisVideoGroup}>
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
          {m.popup.subtitleList} <span className="cap-chip__n">{keyLabel(s.shortcuts.toggleSidebar, m.common.space)}</span>
        </button>
        <button
          className="cap-chip cap-chip--sm"
          aria-pressed={s.playback.autoPause}
          onClick={() => void update((st) => void (st.playback.autoPause = !st.playback.autoPause))}
        >
          {m.popup.pauseAfterEachLine} <span className="cap-chip__n">{keyLabel(s.shortcuts.toggleAutoPause, m.common.space)}</span>
        </button>
      </div>
    </section>
  );
}

function TutorStatus({ ai, s }: { ai: AIStatus | null; s: Settings }) {
  const { m } = useI18n(s);
  if (!ai) return <div className="cap-row cap-popup__foot" />;
  const settings = (label: string, hash: string) => (
    <button className="cap-iconbtn cap-iconbtn--sm" aria-label={label} title={label} onClick={() => open('options', hash)}>
      <IconSettings className="cap-ico" />
    </button>
  );
  if (!ai.enabled) {
    return (
      <div className="cap-row cap-popup__foot">
        <span className="cap-dot cap-dot--off" />
        <span className="cap-spacer">{m.lookup.tutorOff}</span>
        {settings(m.lookup.openAISettings, 'ai')}
      </div>
    );
  }
  if (!ai.configured) {
    return (
      <div className="cap-row cap-popup__foot">
        <span className="cap-dot cap-dot--warn" />
        <span className="cap-spacer">{m.popup.tutorNotSetUp}</span>
        <a
          href="/welcome.html#tutor"
          onClick={(e) => {
            e.preventDefault();
            open('welcome', 'tutor');
          }}
        >
          {m.popup.setItUp}
        </a>
      </div>
    );
  }
  return (
    <div className="cap-row cap-popup__foot">
      <span className="cap-dot" />
      <span className="cap-spacer cap-ellipsis">
        {m.popup.tutorFooter(ai.providerName ?? '')}
        <span className="cap-mono">{ai.model}</span>
      </span>
      {settings(m.common.settings, 'general')}
    </div>
  );
}

/** Shown until the setup guide is finished, so closing its tab early does not lose it. */
function FinishSetup({ s }: { s: Settings }) {
  const { m } = useI18n(s);
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  useEffect(() => {
    void setupProgress.getValue().then(setProgress);
  }, []);
  if (!progress || progress.done) return null;
  return (
    <section className="cap-tile cap-tile--row" aria-label={m.popup.finishSetupAria}>
      <span className="cap-tile__title cap-spacer">{m.popup.finishSetupTitle}</span>
      <button className="cap-btn cap-btn--primary cap-btn--sm" onClick={() => open('welcome')}>
        {m.popup.continueSetup}
      </button>
    </section>
  );
}

/** The toolbar pop-up: this tab, your languages, the tools, the tutor. */
export function Popup() {
  const [s, update] = useSettings();
  const { m } = useI18n(s);
  const vocab = useVocabMap();
  const [ai, setAi] = useState<AIStatus | null>(null);
  const [windowId, setWindowId] = useState<number | undefined>();
  const panelShortcut = useCommandShortcut('open-side-panel');
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
        <Switch label={m.popup.captionaryOn} checked={s.enabled} onChange={(v) => void update((st) => void (st.enabled = v))} />
      </div>

      <FinishSetup s={s} />

      <ThisTab s={s} update={update} />

      <div className="cap-popup__sentence">
        <span className="cap-popup__phrase">{m.popup.imLearning}</span>{' '}
        <LanguageSelect
          variant="sentence"
          label={m.popup.imLearning}
          allowAuto
          value={s.targetLanguage}
          onChange={(v) => void update((st) => void (st.targetLanguage = v))}
        />{' '}
        <span className="cap-popup__phrase">{m.popup.andISpeak}</span>{' '}
        <LanguageSelect
          variant="sentence"
          label={m.popup.iSpeakLabel}
          value={s.nativeLanguage}
          onChange={(v) => void update((st) => void (st.nativeLanguage = v))}
        />
      </div>

      <nav className="cap-golist" aria-label={m.popup.pagesNavAria}>
        <button className="cap-go" onClick={() => open('vocab')}>
          <IconBookmark className="cap-ico" />
          <span className="cap-go__text">
            <span className="cap-go__title">{m.nav.savedWords}</span>
            <span className="cap-go__sub">{m.popup.savedWordsSub(counts.learning, counts.known)}</span>
          </span>
        </button>
        <button className="cap-go" onClick={() => open('vocab', 'review')}>
          <IconCards className="cap-ico" />
          <span className="cap-go__text">
            <span className="cap-go__title">{m.nav.review}</span>
            <span className="cap-go__sub">{m.popup.reviewSub}</span>
          </span>
        </button>
        <button className="cap-go" onClick={() => open('reader')}>
          <IconDocument className="cap-ico" />
          <span className="cap-go__text">
            <span className="cap-go__title">{m.nav.reader}</span>
            <span className="cap-go__sub">{m.popup.readerSub}</span>
          </span>
        </button>
        <button
          className="cap-go"
          disabled={windowId === undefined}
          // Called synchronously so the click still counts as a user gesture.
          onClick={() => void browser.sidePanel.open({ windowId: windowId! }).then(() => window.close())}
        >
          <IconSpark className="cap-ico" />
          <span className="cap-go__text">
            <span className="cap-go__title">{m.nav.aiTutor}</span>
            <span className="cap-go__sub">{m.popup.aiTutorSub}</span>
          </span>
          {panelShortcut && <span className="cap-kbd">{panelShortcut}</span>}
        </button>
      </nav>

      <TutorStatus ai={ai} s={s} />
    </div>
  );
}
