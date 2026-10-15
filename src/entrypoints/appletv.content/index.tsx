import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { useEffect } from 'react';
import { FROM_MAIN, onMessageFrom } from '@/content/bridge';
import { SessionController } from '@/content/controller';
import { mountShadowUi } from '@/content/mount';
import { AppleTvAdapter, PLAYER_DIALOG } from '@/content/sites/appletv';
import { getSession, setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { Sidebar } from '@/content/ui/Sidebar';
import { updateSettings, watchSettings } from '@/lib/settings';

const SIDEBAR_STYLE_ID = 'lr-appletv-sidebar-space';

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.appletv && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

function SidebarGate({ controller }: { controller: SessionController }) {
  const active = useActive();
  const open = useSession((s) => s.settings.sidebar.open);
  const width = useSession((s) => s.settings.sidebar.width);
  const fullscreen = useSession((s) => s.fullscreen);
  const show = active && open && !fullscreen;
  // Narrow the player so the list sits beside the picture instead of over it.
  useEffect(() => {
    let style = document.getElementById(SIDEBAR_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = SIDEBAR_STYLE_ID;
      document.head.append(style);
    }
    style.textContent = show ? `${PLAYER_DIALOG} .video-player { width: calc(100% - ${width}px) !important; }` : '';
  }, [show, width]);
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width, padding: 6, background: '#0b0c10' }}>
      <Sidebar controller={controller} onClose={() => void updateSettings((s) => void (s.sidebar.open = false))} />
    </div>
  );
}

/** Where the overlay lives: the fullscreen element when the player is fullscreen, else the player. */
function overlayAnchor(): Element | null {
  const dialog = document.querySelector(PLAYER_DIALOG);
  if (!dialog) return null;
  const fs = document.fullscreenElement;
  if (fs && (dialog.contains(fs) || fs.contains(dialog)) && fs.querySelector('#main-video-container')) return fs;
  // .video-player__content is the positioned, full-size parent of the video container.
  return dialog.querySelector('.video-player__content') ?? dialog.querySelector('#main-video-container')?.parentElement ?? null;
}

export default defineContentScript({
  matches: ['https://tv.apple.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const adapter = new AppleTvAdapter();
    const controller = new SessionController(adapter);
    await controller.init();
    ctx.onInvalidated(() => controller.destroy());

    // The player is a <dialog>; when it is modal (top layer) anything outside it is
    // hidden behind it, so both UIs are mounted inside the dialog.
    const overlay = await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: overlayAnchor,
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:2147483646;',
      render: () => <OverlayGate controller={controller} />,
    });
    await mountShadowUi(ctx, {
      name: 'captionary-sidebar',
      anchor: PLAYER_DIALOG,
      append: 'last',
      hostStyle: 'position:fixed;top:0;right:0;bottom:0;z-index:2147483647;',
      render: () => <SidebarGate controller={controller} />,
    });
    ctx.addEventListener(document, 'fullscreenchange', () => {
      const anchor = overlayAnchor();
      const host = document.querySelector('captionary-overlay');
      if (anchor && host && !anchor.contains(host)) {
        overlay.remove();
        overlay.mount();
      }
    });

    let currentId: string | null = null;
    let pendingSince: number | null = null;
    let busy = false;

    const reset = () => {
      currentId = null;
      pendingSince = null;
      controller.attachVideo(null);
      setSession({ media: null, status: 'idle', cues: [], translations: [], tracks: [], activeIndex: -1, popup: null });
    };

    const sync = async () => {
      if (busy) return;
      busy = true;
      try {
        const { settings } = getSession();
        const video = adapter.getVideo();
        if (!settings.enabled || !settings.sites.appletv || !video) {
          if (currentId || getSession().media) reset();
          return;
        }
        controller.attachVideo(video);
        const { master, nowPlaying } = await adapter.current();
        if (!master) {
          pendingSince ??= Date.now();
          if (!getSession().media) {
            setSession({
              media: { id: 'pending', title: nowPlaying?.title ?? 'Apple TV+', url: location.href },
              status: 'loading',
            });
          } else if (getSession().status === 'loading' && Date.now() - pendingSince > 20_000) {
            setSession({ status: 'error', message: 'No subtitles found for this title. Reload the page and press play again.' });
          }
          return;
        }
        pendingSince = null;
        const { master: parsed, tracks, defaultId } = adapter.useMaster(master.url, master.text);
        const id = parsed.adamId ?? nowPlaying?.id ?? master.url;
        if (id === currentId) return;
        currentId = id;
        await controller.startMedia({ id, title: nowPlaying?.title || parsed.title || 'Apple TV+', url: location.href }, tracks, defaultId);
      } catch {
        // main-world script not ready yet; try again on the next tick
      } finally {
        busy = false;
      }
    };

    onMessageFrom(FROM_MAIN, (msg) => {
      if (msg.type === 'atv.master') void sync();
    });
    ctx.onInvalidated(watchSettings(() => void sync()));
    ctx.setInterval(() => void sync(), 1000);
    void sync();
  },
});
