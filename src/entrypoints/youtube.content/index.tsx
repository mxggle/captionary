import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { useEffect, useState } from 'react';
import { SessionController } from '@/content/controller';
import { mountShadowUi } from '@/content/mount';
import { YouTubeAdapter } from '@/content/sites/youtube';
import { getSession, setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { Sidebar } from '@/content/ui/Sidebar';
import { watchSettings } from '@/lib/settings';

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.youtube && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

/** Subtitle list in YouTube's right-hand column, as tall as the player. */
function SidebarGate({ controller }: { controller: SessionController }) {
  const active = useActive();
  const open = useSession((s) => s.settings.sidebar.open);
  const [height, setHeight] = useState(480);
  useEffect(() => {
    const player = document.querySelector('#movie_player');
    if (!player) return;
    const ro = new ResizeObserver(() => setHeight(Math.max(360, Math.min(player.clientHeight, innerHeight - 80))));
    ro.observe(player);
    return () => ro.disconnect();
  }, [active]);
  if (!active || !open) return null;
  return (
    <div style={{ height, marginBottom: 12 }}>
      <Sidebar controller={controller} />
    </div>
  );
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const adapter = new YouTubeAdapter();
    const controller = new SessionController(adapter);
    await controller.init();
    ctx.onInvalidated(() => controller.destroy());

    await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: '#movie_player',
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:60;',
      render: () => <OverlayGate controller={controller} />,
    });
    await mountShadowUi(ctx, {
      name: 'captionary-sidebar',
      anchor: 'ytd-watch-flexy #secondary',
      append: 'first',
      hostStyle: 'display:block;',
      render: () => <SidebarGate controller={controller} />,
    });

    let currentId: string | null = null;
    let loading: Promise<void> | null = null;

    const reset = () => {
      controller.attachVideo(null);
      setSession({ media: null, status: 'idle', cues: [], translations: [], tracks: [], activeIndex: -1, popup: null });
    };

    const load = async () => {
      const { settings } = getSession();
      const id = YouTubeAdapter.currentVideoId();
      if (!settings.enabled || !settings.sites.youtube || !id) {
        currentId = null;
        reset();
        return;
      }
      if (id === currentId) return;
      currentId = id;
      setSession({
        media: { id, title: document.title.replace(/ - YouTube$/, ''), url: `https://www.youtube.com/watch?v=${id}` },
        status: 'loading',
        cues: [],
        translations: [],
      });
      const data = await adapter.loadPlayerData(id);
      if (currentId !== id) return;
      controller.attachVideo(adapter.getVideo());
      if (!data) {
        setSession({ status: 'error', message: 'Could not read the YouTube player. Reload the page.' });
        return;
      }
      const { tracks, defaultId } = adapter.trackInfos(data);
      await controller.startMedia({ id, title: data.title, url: `https://www.youtube.com/watch?v=${id}` }, tracks, defaultId);
    };
    const navigate = () => {
      loading = (loading ?? Promise.resolve()).then(load).catch(() => undefined);
    };

    ctx.addEventListener(document, 'yt-navigate-finish' as keyof DocumentEventMap, navigate);
    ctx.addEventListener(window, 'wxt:locationchange', navigate);
    const stop = watchSettings((s) => {
      if (!s.enabled || !s.sites.youtube) navigate();
      else if (!currentId) navigate();
    });
    ctx.onInvalidated(stop);
    navigate();

    // The player swaps its <video> element and toggles ad mode; keep in sync.
    ctx.setInterval(() => {
      if (!currentId) return;
      controller.attachVideo(adapter.getVideo());
      const ad = !!document.querySelector('#movie_player.ad-showing');
      if (ad !== getSession().adShowing) setSession({ adShowing: ad });
    }, 1000);
  },
});
