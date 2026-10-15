import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { SessionController } from '@/content/controller';
import { listenToPopup, watchHost } from '@/content/host';
import { mountShadowUi } from '@/content/mount';
import { NetflixAdapter } from '@/content/sites/netflix';
import { getSession, setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { PlayerButton } from '@/content/ui/PlayerButton';
import { watchSettings } from '@/lib/settings';

/** Netflix's "Audio & Subtitles" button; Captionary's button goes right after it. */
const AUDIO_SUBTITLES = '.watch-video [data-uia="control-audio-subtitle"]';

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.netflix && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

const sizeFrom = () => [document.querySelector(AUDIO_SUBTITLES)];

/** The gap Netflix leaves between its control buttons (a spacer element before each wrapper). */
function controlGap(): number {
  const wrapper = document.querySelector(AUDIO_SUBTITLES)?.parentElement;
  const spacer = wrapper?.previousElementSibling;
  const w = spacer && !spacer.querySelector('button') ? spacer.getBoundingClientRect().width : 0;
  return w > 0 && w < 80 ? w : 24;
}

function ButtonGate({ controller }: { controller: SessionController }) {
  if (!useActive()) return null;
  return <PlayerButton controller={controller} sizeFrom={sizeFrom} style={{ marginLeft: controlGap() }} />;
}

export default defineContentScript({
  matches: ['https://www.netflix.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const adapter = new NetflixAdapter();
    const controller = new SessionController(adapter);
    await controller.init();
    ctx.onInvalidated(() => controller.destroy());
    watchHost(ctx, 'netflix', () => document.querySelector('.watch-video'));
    listenToPopup(ctx, controller);

    // The subtitle list is a drawer inside the overlay (Netflix is always a fullscreen-style player).
    await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: '.watch-video--player-view',
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:2;',
      render: () => <OverlayGate controller={controller} />,
    });
    // Netflix renders its control bar only while the controls show; the button comes and goes with it.
    await mountShadowUi(ctx, {
      name: 'captionary-button',
      anchor: AUDIO_SUBTITLES,
      append: (anchor, host) => (anchor.parentElement ?? anchor).after(host),
      placed: (anchor, host) => (anchor.parentElement ?? anchor).nextElementSibling === host,
      render: () => <ButtonGate controller={controller} />,
    });

    let currentId: string | null = null;
    const load = async () => {
      const { settings } = getSession();
      const id = NetflixAdapter.currentMovieId();
      if (!settings.enabled || !settings.sites.netflix || !id) {
        currentId = null;
        controller.attachVideo(null);
        setSession({
          media: null,
          status: 'idle',
          cues: [],
          translations: [],
          tracks: [],
          popup: null,
          menuOpen: false,
          drawerOpen: false,
        });
        return;
      }
      if (id === currentId) return;
      currentId = id;
      setSession({ media: { id, title: adapter.title(), url: `https://www.netflix.com/watch/${id}` }, status: 'loading' });
      const tracks = await adapter.waitForTracks(id);
      if (currentId !== id) return;
      controller.attachVideo(adapter.getVideo());
      if (!tracks) {
        setSession({ status: 'error', message: 'Subtitles not found. Reload the page to let Captionary read them.' });
        return;
      }
      await controller.startMedia(
        { id, title: adapter.title(), url: `https://www.netflix.com/watch/${id}` },
        adapter.trackInfos(tracks),
        null,
      );
    };
    let chain: Promise<void> = Promise.resolve();
    const navigate = () => {
      chain = chain.then(load).catch(() => undefined);
    };
    ctx.addEventListener(window, 'wxt:locationchange', navigate);
    ctx.onInvalidated(watchSettings(() => navigate()));
    navigate();

    ctx.setInterval(() => {
      if (!currentId) return;
      controller.attachVideo(adapter.getVideo());
      const media = getSession().media;
      const title = adapter.title();
      if (media && media.title !== title && title !== 'Netflix') setSession({ media: { ...media, title } });
    }, 1000);
  },
});
