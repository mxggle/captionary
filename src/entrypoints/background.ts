import { browser, defineBackground } from '#imports';
import { pruneCache } from '@/lib/ai/cache';
import { listModels, resolveConnection, resolveModel, runJob, testConnection, toAIError } from '@/lib/ai/gateway';
import { PROVIDERS } from '@/lib/ai/registry';
import { hasApiKey } from '@/lib/ai/secrets';
import { AIError, type AIJob, type AIStreamEvent } from '@/lib/ai/types';
import { lookupWiktionary } from '@/lib/dictionary';
import { getFrequencyList } from '@/lib/frequency';
import { baseLang } from '@/lib/languages';
import { romanizeLine } from '@/lib/text/romanize';
import { romanizeChinese } from '@/lib/text/romanize-zh';
import { AI_PORT, type AIStatus, type BgRequest, type BgResponse, type SidePanelPayload } from '@/lib/messaging';
import { readerImport, sidePanelPayload } from '@/lib/session-items';
import { aiSettingsItem, getAISettings } from '@/lib/settings';

/** Hosts the background will fetch text from on behalf of content scripts (no open proxy). */
const FETCH_ALLOWLIST = [/\.nflxvideo\.net$/, /^www\.netflix\.com$/, /^vod-[a-z0-9-]+\.tv\.apple\.com$/];

async function aiStatus(): Promise<AIStatus> {
  const ai = await getAISettings();
  const conn = resolveConnection(ai, ai.routes.word.connectionId);
  if (!conn) return { enabled: ai.enabled, configured: false, autoExplain: ai.autoExplain };
  const info = PROVIDERS[conn.kind];
  const configured = !info.requiresKey || (await hasApiKey(conn.id));
  return {
    enabled: ai.enabled,
    configured,
    autoExplain: ai.autoExplain,
    provider: conn.kind,
    providerName: conn.label || info.name,
    model: resolveModel(conn, ai.routes.word),
  };
}

async function fetchText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !FETCH_ALLOWLIST.some((re) => re.test(parsed.hostname))) {
    throw new AIError('bad_request', 'URL not allowed');
  }
  const res = await fetch(parsed, { credentials: 'omit' });
  if (!res.ok) throw new AIError('network', `Download failed (${res.status})`);
  return res.text();
}

/**
 * sidePanel.open() must be called before any await so it still runs inside the
 * user gesture (menu click, shortcut or click relayed from a content script).
 */
function openSidePanel(payload: SidePanelPayload | null, tabId?: number, windowId?: number): Promise<void> {
  const opening =
    windowId !== undefined
      ? browser.sidePanel.open({ windowId })
      : tabId !== undefined
        ? browser.sidePanel.open({ tabId })
        : Promise.resolve();
  const saving = payload ? sidePanelPayload.setValue({ ...payload }) : Promise.resolve();
  return Promise.all([opening, saving]).then(() => undefined);
}

async function handle(msg: BgRequest, sender: { tab?: { id?: number; windowId?: number } }): Promise<unknown> {
  switch (msg.type) {
    case 'ai.run':
      return runJob(msg.job);
    case 'ai.status':
      return aiStatus();
    case 'ai.listModels': {
      const ai = await getAISettings();
      const conn = ai.connections.find((c) => c.id === msg.connectionId);
      if (!conn) throw new AIError('not_configured', 'Unknown provider');
      const models = await listModels(conn);
      // Cache the list on the connection so settings pages can show it offline.
      await aiSettingsItem.setValue({
        ...ai,
        connections: ai.connections.map((c) => (c.id === conn.id ? { ...c, models, modelsFetchedAt: Date.now() } : c)),
      });
      return models;
    }
    case 'ai.test': {
      const ai = await getAISettings();
      const conn = ai.connections.find((c) => c.id === msg.connectionId);
      if (!conn) throw new AIError('not_configured', 'Unknown provider');
      return testConnection(conn, msg.model);
    }
    case 'dict.lookup':
      return lookupWiktionary(msg.word, msg.lang);
    case 'freq.list':
      return getFrequencyList(msg.lang);
    case 'text.romanize':
      return msg.lines.slice(0, 5000).map((l) => (baseLang(msg.lang) === 'zh' ? romanizeChinese(l) : romanizeLine(l, msg.lang)));
    case 'fetch.text':
      return fetchText(msg.url);
    case 'open.page': {
      const path = ({ options: '/options.html', vocab: '/vocab.html', reader: '/reader.html' } as const)[msg.page];
      await browser.tabs.create({ url: browser.runtime.getURL(path) + (msg.hash ? `#${msg.hash}` : '') });
      return;
    }
    case 'sidepanel.open':
      return openSidePanel(msg.payload, sender.tab?.id, sender.tab?.windowId);
    case 'reader.import':
      return openInReader({ ...msg.doc, text: msg.doc.text.slice(0, 200_000) });
    case 'reader.openTab':
      // Only from the toolbar pop-up (an extension page), which holds the activeTab grant for that tab.
      if (sender.tab) throw new AIError('bad_request', 'Not allowed from a web page');
      return openPageInReader(msg.tabId);
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as BgRequest;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    handle(msg, sender)
      .then((data) => sendResponse({ ok: true, data } satisfies BgResponse<unknown>))
      .catch((err) => sendResponse({ ok: false, error: toAIError(err).toInfo() } satisfies BgResponse<unknown>));
    return true; // keep the channel open for the async response
  });

  // Streaming AI over a long-lived port; disconnecting aborts the provider request.
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_PORT) return;
    const abort = new AbortController();
    port.onDisconnect.addListener(() => abort.abort());
    const post = (event: AIStreamEvent) => {
      try {
        port.postMessage(event);
      } catch {
        abort.abort();
      }
    };
    port.onMessage.addListener(async (raw: unknown) => {
      const msg = raw as { type: 'run'; job: AIJob };
      if (msg?.type !== 'run') return;
      const { stream } = await getAISettings();
      runJob(msg.job, {
        signal: abort.signal,
        onMeta: (m) => post({ type: 'meta', ...m, cached: false }),
        // With streaming off the answer is delivered in one piece with 'done'.
        onDelta: stream ? (text) => post({ type: 'delta', text }) : undefined,
      })
        .then((result) => post({ type: 'done', result }))
        .catch((err) => post({ type: 'error', error: toAIError(err).toInfo() }));
    });
  });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: 'lr-explain-selection',
        title: 'Explain “%s” with Captionary',
        contexts: ['selection'],
      });
      browser.contextMenus.create({
        id: 'lr-open-reader',
        title: 'Open this page in the Captionary reader',
        contexts: ['page'],
      });
    });
    if (reason === 'install') {
      await browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#welcome` });
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lr-explain-selection' && info.selectionText) {
      const text = info.selectionText.trim().slice(0, 2000);
      // Must run synchronously inside the click handler to keep the user gesture.
      void openSidePanel(
        { kind: /\s/.test(text) && text.split(/\s+/).length > 3 ? 'sentence' : 'word', text, url: tab?.url, title: tab?.title },
        tab?.id,
        tab?.windowId,
      );
    } else if (info.menuItemId === 'lr-open-reader' && tab?.id !== undefined) {
      void openPageInReader(tab.id);
    }
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'open-side-panel' && tab?.windowId !== undefined) void openSidePanel(null, tab.id, tab.windowId);
  });

  void getAISettings()
    .then((ai) => pruneCache(ai.cacheTtlDays))
    .catch(() => undefined);
});

/** Extract the readable text of a page (activeTab grant from the menu click) into the reader. */
async function openPageInReader(tabId: number) {
  const [res] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const pick = document.querySelector('article') ?? document.querySelector('main') ?? document.body;
      const selection = window.getSelection()?.toString().trim();
      return {
        title: document.title,
        url: location.href,
        text: selection || (pick as HTMLElement).innerText,
        lang: document.documentElement.lang,
      };
    },
  });
  const page = res?.result as { title: string; url: string; text: string; lang: string } | undefined;
  if (!page?.text) return;
  await openInReader({ ...page, text: page.text.slice(0, 200_000) });
}

async function openInReader(doc: { title: string; url: string; text: string; lang: string }) {
  await readerImport.setValue(doc);
  await browser.tabs.create({ url: `${browser.runtime.getURL('/reader.html')}#import` });
}
