import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { FROM_MAIN, onMessageFrom } from '@/content/bridge';
import { SessionController } from '@/content/controller';
import { listenToPopup, watchHost } from '@/content/host';
import { mountShadowUi } from '@/content/mount';
import { AppleTvAdapter, PLAYER_DIALOG } from '@/content/sites/appletv';
import { getSession, setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { PlayerButton } from '@/content/ui/PlayerButton';
import { getMessages, resolveUILocale } from '@/lib/i18n';
import { watchSettings } from '@/lib/settings';

/**
 * Apple's captions control in the player's control bar; Captionary's button goes right after it.
 * The controls are `amp-*` custom elements; if this one moves into a shadow root, the fallback
 * button in the overlay takes over.
 */
const CAPTIONS_CONTROL = `${PLAYER_DIALOG} amp-captions-control`;

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.appletv && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

const sizeFrom = () => [document.querySelector(CAPTIONS_CONTROL)];

function ButtonGate({ controller }: { controller: SessionController }) {
  return useActive() ? <PlayerButton controller={controller} sizeFrom={sizeFrom} /> : null;
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
    watchHost(ctx, 'appletv', () => document.querySelector(`${PLAYER_DIALOG} .video-player`) ?? document.querySelector(PLAYER_DIALOG));
    listenToPopup(ctx, controller);

    // The player is a <dialog>; when it is modal (top layer) anything outside it is hidden behind it,
    // so the overlay (captions, look-up, menu and the subtitle drawer) is mounted inside the dialog.
    await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: overlayAnchor,
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:2147483646;',
      render: () => <OverlayGate controller={controller} />,
    });
    await mountShadowUi(ctx, {
      name: 'captionary-button',
      anchor: CAPTIONS_CONTROL,
      append: 'after',
      render: () => <ButtonGate controller={controller} />,
    });

    let currentId: string | null = null;
    let masterUrl: string | null = null;
    let pendingSince: number | null = null;
    let busy = false;

    const reset = () => {
      currentId = null;
      masterUrl = null;
      pendingSince = null;
      controller.attachVideo(null);
      setSession({
        media: null,
        status: 'idle',
        cues: [],
        translations: [],
        tracks: [],
        activeIndex: -1,
        popup: null,
        menuOpen: false,
        drawerOpen: false,
      });
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
        const { master, nowPlaying } = await adapter.current(masterUrl);
        if (!master) {
          pendingSince ??= Date.now();
          if (!getSession().media) {
            setSession({
              media: { id: 'pending', title: nowPlaying?.title ?? 'Apple TV+', url: location.href },
              status: 'loading',
            });
          } else if (getSession().status === 'loading' && Date.now() - pendingSince > 20_000) {
            const m = getMessages(resolveUILocale(settings));
            setSession({ status: 'error', message: m.content.errors.appletvNoSubtitlesFound });
          }
          return;
        }
        pendingSince = null;
        if (master.url === masterUrl || !master.text) return;
        masterUrl = master.url;
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
