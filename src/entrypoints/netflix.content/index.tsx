import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { useEffect } from 'react';
import { SessionController } from '@/content/controller';
import { mountShadowUi } from '@/content/mount';
import { NetflixAdapter } from '@/content/sites/netflix';
import { getSession, setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { Sidebar } from '@/content/ui/Sidebar';
import { updateSettings, watchSettings } from '@/lib/settings';

const SIDEBAR_STYLE_ID = 'lr-netflix-sidebar-space';

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.netflix && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

function SidebarGate({ controller }: { controller: SessionController }) {
  const active = useActive();
  const open = useSession((s) => s.settings.sidebar.open);
  const width = useSession((s) => s.settings.sidebar.width);
  const show = active && open;
  // Make room for the panel by narrowing the player.
  useEffect(() => {
    let style = document.getElementById(SIDEBAR_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = SIDEBAR_STYLE_ID;
      document.head.append(style);
    }
    style.textContent = show ? `.watch-video--player-view { width: calc(100% - ${width}px) !important; }` : '';
  }, [show, width]);
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width, padding: 6, background: '#0b0c10' }}>
      <Sidebar controller={controller} onClose={() => void updateSettings((s) => void (s.sidebar.open = false))} />
    </div>
  );
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

    await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: '.watch-video--player-view',
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:2;',
      render: () => <OverlayGate controller={controller} />,
    });
    await mountShadowUi(ctx, {
      name: 'captionary-sidebar',
      anchor: '.watch-video',
      append: 'last',
      hostStyle: 'position:absolute;inset:0 0 0 auto;z-index:3;',
      render: () => <SidebarGate controller={controller} />,
    });

    let currentId: string | null = null;
    const load = async () => {
      const { settings } = getSession();
      const id = NetflixAdapter.currentMovieId();
      if (!settings.enabled || !settings.sites.netflix || !id) {
        currentId = null;
        controller.attachVideo(null);
        setSession({ media: null, status: 'idle', cues: [], translations: [], tracks: [], popup: null });
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
