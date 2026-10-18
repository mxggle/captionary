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
  const { m } = useI18n(s);
  const { tab, status, setStatus } = useThisTab();
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
  const text = (t: ReactNode) => <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)' }}>{t}</p>;

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
    return (
      <section className="cap-tile" aria-label={m.popup.thisTabAria}>
        {head(title, <Tag tone="off">{m.common.off}</Tag>)}
        {text(s.enabled ? m.popup.offOnSiteHint(site) : m.popup.offGlobalHint)}
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
          {m.popup.subtitleList} <span className="cap-chip__n">{keyLabel(s.shortcuts.toggleSidebar)}</span>
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
  const settings = (
    <button
      className="cap-iconbtn cap-iconbtn--sm"
      aria-label={m.common.settings}
      title={m.common.settings}
      onClick={() => open('options', 'general')}
    >
      <IconSettings className="cap-ico" />
    </button>
  );
  if (!ai.enabled) {
    return (
      <div className="cap-row cap-popup__foot">
        <span className="cap-dot cap-dot--off" />
        <span className="cap-spacer">{m.lookup.tutorOff}</span>
        {settings}
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
      {settings}
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
    <section className="cap-tile" aria-label={m.popup.finishSetupAria}>
      <div className="cap-tile__title">{m.popup.finishSetupTitle}</div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)' }}>{m.popup.finishSetupHint}</p>
      <div>
        <button className="cap-btn cap-btn--primary cap-btn--sm" onClick={() => open('welcome')}>
          {m.popup.continueSetup}
        </button>
      </div>
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
        {m.popup.imLearning}{' '}
        <LanguageSelect
          variant="sentence"
          label={m.popup.imLearning}
          allowAuto
          value={s.targetLanguage}
          onChange={(v) => void update((st) => void (st.targetLanguage = v))}
        />{' '}
        {m.popup.andISpeak}{' '}
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
          <span className="cap-kbd">Alt L</span>
        </button>
      </nav>

      <TutorStatus ai={ai} s={s} />
    </div>
  );
}
