import { defineContentScript } from '#imports';
import { FROM_ISOLATED, onMessageFrom, postToIsolated } from '@/content/bridge';
import { extractNetflixTracks, mayHoldNetflixTracks, patchManifestRequest, type NetflixTrack } from '@/lib/subtitles/netflix';

function playerApi(): any {
  const videoPlayer = (window as any).netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
  if (!videoPlayer) return null;
  const ids: string[] = videoPlayer.getAllPlayerSessionIds?.() ?? [];
  const id = ids.find((i) => i.startsWith('watch')) ?? ids[0];
  return id ? videoPlayer.getVideoPlayerBySessionId(id) : null;
}

/**
 * Runs in Netflix's page world:
 *  - asks the player to include WebVTT subtitles and all subtitle languages in its
 *    manifest request, and reads the subtitle URLs from the manifest response;
 *  - seeks/plays through Netflix's own player API (setting video.currentTime directly
 *    makes the Netflix player error out).
 */
export default defineContentScript({
  matches: ['https://www.netflix.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const manifests = new Map<string, NetflixTrack[]>();

    const origStringify = JSON.stringify;
    JSON.stringify = function (this: unknown, value: any, ...rest: any[]) {
      try {
        patchManifestRequest(value);
      } catch {
        // never break the page
      }
      return (origStringify as any).call(this, value, ...rest);
    } as typeof JSON.stringify;

    const origParse = JSON.parse;
    JSON.parse = function (this: unknown, text: string, ...rest: any[]) {
      const value = (origParse as any).call(this, text, ...rest);
      try {
        if (typeof text === 'string' && mayHoldNetflixTracks(text)) {
          const found = extractNetflixTracks(value);
          if (found) {
            manifests.set(found.movieId, found.tracks);
            postToIsolated({ type: 'nf.tracks', movieId: found.movieId, tracks: found.tracks });
          }
        }
      } catch {
        // never break the page
      }
      return value;
    } as typeof JSON.parse;

    onMessageFrom(FROM_ISOLATED, (msg) => {
      try {
        switch (msg.type) {
          case 'nf.getTracks':
            postToIsolated({ type: 'nf.reply', reqId: msg.reqId, data: manifests.get(String(msg.movieId)) ?? null });
            break;
          case 'nf.seek':
            playerApi()?.seek(Math.round(Number(msg.time) * 1000));
            break;
          case 'nf.play':
            playerApi()?.play();
            break;
          case 'nf.pause':
            playerApi()?.pause();
            break;
        }
      } catch {
        // Player API changes must never break the page.
      }
    });
  },
});
