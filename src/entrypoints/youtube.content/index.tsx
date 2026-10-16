import '@/ui/styles.css';
import { defineContentScript } from '#imports';
import { useEffect, useState } from 'react';
import { SessionController } from '@/content/controller';
import { listenToPopup, watchHost } from '@/content/host';
import { mountShadowUi } from '@/content/mount';
import { YouTubeAdapter } from '@/content/sites/youtube';
import { getSession, setSession, useSession } from '@/content/store';
import { HostRoot } from '@/content/ui/HostRoot';
import { Overlay } from '@/content/ui/Overlay';
import { PlayerButton } from '@/content/ui/PlayerButton';
import { SubtitlePanel } from '@/content/ui/SubtitlePanel';
import { updateSettings, watchSettings } from '@/lib/settings';

function useActive() {
  return useSession((s) => s.settings.enabled && s.settings.sites.youtube && !!s.media);
}

function OverlayGate({ controller }: { controller: SessionController }) {
  return useActive() ? <Overlay controller={controller} /> : null;
}

const sizeFrom = () => [
  document.querySelector('#movie_player .ytp-subtitles-button'),
  document.querySelector('#movie_player .ytp-settings-button'),
  document.querySelector('#movie_player .ytp-fullscreen-button'),
];

function ButtonGate({ controller }: { controller: SessionController }) {
  return useActive() ? <PlayerButton controller={controller} sizeFrom={sizeFrom} /> : null;
}

/** Subtitle list at the top of YouTube's right-hand column, as tall as the player. */
function PanelGate({ controller }: { controller: SessionController }) {
  const active = useActive();
  const open = useSession((s) => s.settings.sidebar.open && !s.off);
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
    <HostRoot style={{ height, marginBottom: 16 }}>
      <SubtitlePanel controller={controller} onClose={() => void updateSettings((s) => void (s.sidebar.open = false))} />
    </HostRoot>
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
    watchHost(ctx, 'youtube', () => document.querySelector('#movie_player'));
    listenToPopup(ctx, controller);

    await mountShadowUi(ctx, {
      name: 'captionary-overlay',
      anchor: '#movie_player',
      append: 'last',
      hostStyle: 'position:absolute;inset:0;pointer-events:none;z-index:60;',
      render: () => <OverlayGate controller={controller} />,
    });
    await mountShadowUi(ctx, {
      name: 'captionary-panel',
      anchor: 'ytd-watch-flexy #secondary',
      append: 'first',
      hostStyle: 'display:block;',
      render: () => <PanelGate controller={controller} />,
    });
    // The Captionary button sits in the player's own control bar, left of its captions button.
    await mountShadowUi(ctx, {
      name: 'captionary-button',
      anchor: '#movie_player .ytp-right-controls .ytp-subtitles-button',
      append: 'before',
      render: () => <ButtonGate controller={controller} />,
    });

    let currentId: string | null = null;
    let loading: Promise<void> | null = null;

    // A token that turns up after a failed load (the learner pressed CC, or the player fetched
    // captions late) is all the load was missing: try again without a reload.
    adapter.onToken = (videoId) => {
      const { status, originalTrackId } = getSession();
      if (videoId === currentId && status === 'error' && originalTrackId) void controller.selectOriginalTrack(originalTrackId);
    };

    const reset = () => {
      controller.attachVideo(null);
      setSession({ media: null, status: 'idle', cues: [], translations: [], tracks: [], activeIndex: -1, popup: null, menuOpen: false });
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
      const ad = adapter.adShowing();
      if (ad !== getSession().adShowing) setSession({ adShowing: ad, menuOpen: ad ? false : getSession().menuOpen });
    }, 1000);
  },
});
