# Apple TV web (tv.apple.com) — research for a site adapter

Goal: support `https://tv.apple.com/*` the same way as YouTube/Netflix (dual subtitles,
word pop-up, AI explanations, auto-pause, subtitle list). The user watches Apple TV+ in the
macOS TV app; the web player plays the same Apple TV+ catalogue in Chrome. iTunes
purchases/rentals are **not** playable on the web, only subscription content.

Researched 2026-10-15 by inspecting the live site (Severance show page + its trailers).

## What was verified

**Player stack.** Svelte app + MusicKit JS v3 (`window.MusicKit`, version string
`playback/WebTvPlayer-2640.24.0-external`) driving hls.js (`window.Hls`, version
`3.4.16`, loaded from `/includes/js-cdn/hls.js/current/hls.js/hls.js`). Video is MSE
(`blob:` src) + Widevine in Chrome.

**Where the video lives.**
- The main player is a `<dialog class="playback-view">` overlay (`dialog[open]` while
  playing) containing `div.video-player` → `div#main-video-container.video-player__video-container`
  (this is `MusicKit.getInstance().videoContainerElement`). The `<video>` is created
  inside it when playback starts. Player controls are `amp-*` custom elements
  (`amp-playback-controls-*`, `amp-captions-control`, `amp-tv-overlay`), some with shadow roots.
- Show pages also autoplay a muted hero trailer in
  `amp-background-video` → **shadow root** → `video.background-video__media`.
  **The adapter must ignore this one** and bind only to the video inside
  `#main-video-container` / `dialog.playback-view[open]`.

**Subtitles are delivered as plain HLS renditions in the master playlist.**
- Master playlist request (made by hls.js) for the trailer:
  `https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=…&a=<adamId>&…`
  Match intercepted responses by content (`#EXTM3U` + `TYPE=SUBTITLES`) rather than by
  URL, since episode URLs may differ.
- Each language appears as `#EXT-X-MEDIA:TYPE=SUBTITLES,…,URI="https://vod-ap-aoc.tv.apple.com/…_en_subtitles_V1.m3u8"`.
  The trailer listed 279 subtitle renditions = ~31 languages × 3 variants × 3 CDN pathways.
  - **CDN pathways (content steering):** every rendition is repeated for
    `GROUP-ID="subtitles_vod-{ap,fa,ak}-aoc.tv.apple.com"` / `PATHWAY-ID="ap|fa|ak"`.
    Dedupe by `STABLE-RENDITION-ID`, keep one pathway (e.g. the first).
  - **Variants per language:** regular (`FORCED=NO`, no `CHARACTERISTICS`) — use this for
    learning; forced (`FORCED=YES`, NAME ends in "(forced)") — only foreign-language
    lines, never pick as original; SDH (`CHARACTERISTICS="public.accessibility.transcribes-spoken-dialog,public.accessibility.describes-music-and-sound"`,
    NAME has a trailing space) — fallback when no regular track exists.
  - Language codes are BCP-47 with scripts/regions: `zh-Hans`, `zh-Hant`, `yue-Hant`,
    `es-419`, `es-ES`, `fr-CA`, `fr-FR`, `pt-BR`, `pt`, `nb`. `normalizeLang` must map
    `zh-Hans`→`zh-CN`, `zh-Hant`/`yue-Hant`→`zh-TW` (or keep Cantonese separate).
  - Useful session data in the master: `com.apple.hls.title` (show title),
    `com.apple.hls.feature.adam-id` (stable media id), `com.apple.hls.feature.duration`.
- The subtitle media playlist is VOD and addresses **one `.webvtt` file via
  `EXT-X-BYTERANGE`**:
  ```
  #EXTM3U
  #EXT-X-TARGETDURATION:32
  #EXT-X-PLAYLIST-TYPE:VOD
  #EXTINF:31.85800,
  #EXT-X-BYTERANGE:1054@0
  P1471448673_A1779318764_en_subtitles_V1-.webvtt
  #EXT-X-ENDLIST
  ```
  The trailer had a single range; full episodes will very likely have many ranges into
  the same file. Simplest: fetch each distinct segment URI once **without** a Range header
  (whole file), or fetch the ranges and concatenate.
- WebVTT content:
  ```
  WEBVTT
  X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

  1
  00:00:02.711 --> 00:00:04.505 align:middle line:100%,end position:50%,middle
  So what did you guys\rsee up there?
  ```
  - Line breaks inside a cue are a **lone `\r`**; treat as a space.
  - `<i>…</i>` tags occur; strip them.
  - Cue settings follow the end timestamp; ignore them.
  - `MPEGTS:900000` = 10 s, the standard HLS initial PTS offset, so cue times should already
    be relative to the start of playback (hls.js normalizes the same way). If ranges carry
    their own `WEBVTT` header, the parser must tolerate repeated headers.
- **CORS:** the subtitle CDN (`vod-*-aoc.tv.apple.com`) answers with
  `Access-Control-Allow-Origin: *` (content-type `application/octet-stream`), so the
  isolated content script can `fetch` playlists and `.webvtt` files directly. No extra
  host permission is required, although adding `https://*.tv.apple.com/*` does no harm.
- hls.js also mirrors every rendition into native `video.textTracks` (all
  `mode: "hidden"`, cues empty until a track is active and playback reaches it). Native
  cues are only loaded for the active track and progressively, so they are not enough
  for the full transcript; use them at most as a timing cross-check.

**MusicKit API (MAIN world), useful for control and metadata.** `MusicKit.getInstance()`
exposes `play()`, `pause()`, `seekToTime(seconds)`, `seekForward()`, `seekBackward()`,
`playbackRate`, `currentPlaybackTime`, `currentPlaybackDuration`, `playbackState`,
`isPlaying`, `nowPlayingItem` (`{ id, type: "Vod", title }`, id like
`tvs.sbd.4000:A0005902TRL1:f0133578`), `queue`, `textTracks`, `currentTextTrack`,
`videoContainerElement`, `requestFullscreen()`, `addEventListener(...)` (MusicKit
events such as `playbackTimeDidChange`, `playbackStateDidChange`,
`nowPlayingItemDidChange`). Don't use `developerToken` or other auth fields.

## Not verified here (needs a real Chrome with Widevine)

The research browser has no video DRM (`browserSupportsVideoDrm: false`; MusicKit
throws `[mk-140] CONTENT_UNSUPPORTED; No DRM KeySytem available`), so the main player never
started. Check these during implementation in Chrome:
1. That the episode master playlist is intercepted the same way and lists the same
   subtitle renditions (expected: yes, same HLS packaging).
2. The cue times match `video.currentTime` (compare with hls.js native cues for the
   active track). If they are offset by 10 s, subtract the X-TIMESTAMP-MAP offset.
3. Whether setting `video.currentTime` directly is safe, or whether seeks must go through
   `MusicKit.getInstance().seekToTime()` via the MAIN-world bridge (do the latter by
   default, as with Netflix).
4. How Apple renders its own subtitles (native `::cue` vs. custom DOM) so the
   "hide native subtitles" option can target it. Until then, the user can simply turn
   Apple's subtitles off; our adapter does not depend on the player's subtitle selection
   because it reads the master playlist.
5. Which element goes fullscreen (probably `div.video-player` or the dialog), so the
   overlay host is mounted inside it. Mount inside `#main-video-container`'s parent
   (`div.video-player__content`) and verify it stays visible in fullscreen and above the
   `amp-*` controls.
6. Whether `dialog.playback-view` is a top-layer `<dialog>` (`showModal()`): if so, page-level
   fixed elements (sidebar, pop-ups) render **under** it. The overlay, pop-up and ideally
   the sidebar must be mounted **inside** the dialog.

## Suggested adapter design

- `appletv-main.content.ts` (world MAIN, `document_start`, matches `https://tv.apple.com/*`):
  hook `XMLHttpRequest` and `fetch`. When a response body starts with `#EXTM3U` and
  contains `TYPE=SUBTITLES`, post `{ url, text }` to the isolated world. Also answer
  bridge commands: `seek(seconds)` → `MusicKit.getInstance().seekToTime(s)`,
  `play`/`pause`, and `getNowPlaying` → `{ id, title }`.
- `appletv.content` (isolated): parse the master into `TrackInfo[]` (dedupe pathways;
  mark forced as `forced`, SDH as auto-like fallback), keyed by adam-id. Watch for
  `dialog.playback-view[open]` + `#main-video-container video` with a MutationObserver to
  attach the controller and mount the overlay; tear down when the dialog closes.
  `loadTrack(id)` fetches the rendition playlist, then the `.webvtt` file(s), and parses
  them with the existing `parseVttOrSrt` (after normalizing lone `\r`).
- Translation source: Apple ships many human subtitle languages, so the default
  `platform` engine will nearly always find a `track` in the native language; no machine
  translation needed.
- Apple TV+ has no ads; MLS / F1 live streams (`EXT-X-PLAYLIST-TYPE` not `VOD`) are out of scope.

## Prior art

An existing Chrome extension "Apple TV+ Dual Subtitles" works only on tv.apple.com and
notes that users may need to switch subtitles once manually. That suggests it captures the
player's per-rendition requests. Reading the master playlist avoids that step.

## Verified during implementation (2026-10-15, Chromium + Widevine, Severance teaser trailer)

1. Master playlist is intercepted (hls.js uses XHR and fetch); the trailer lists 41 subtitle
   languages. Language codes are **`cmn-Hans` / `cmn-Hant`** (not `zh-Hans`), plus `yue-Hant`
   and `no`; `normalizeLang` maps `cmn-*` to Chinese and `no` to `nb`.
2. Cue times match `video.currentTime` directly (no 10 s X-TIMESTAMP-MAP offset): our cue
   "Okay, go ahead and have a seat." was active while the player's native cue was 4.83–7.14 s.
3. The media playlist can point at several `.webvtt` files (`…-0.webvtt`, `…-1.webvtt`); all are fetched.
4. Seeking with `MusicKit.getInstance().seekToTime()` works mid-playback without player errors.
5. `dialog.playback-view` is modal (`:modal`, top layer), so all UI is mounted inside it.
   `.video-player__content` is the positioned full-size container (grid); `div.video-player`
   is the fullscreen element (keyboard `f`), and it contains our overlay.
6. Apple's own subtitles do not use `showing` native text tracks (all tracks stay `hidden`);
   their renderer was not located. They are off by default; leave them off.
7. Note for testing: Playwright's Chromium gets Widevine if `--disable-component-update` is
   removed from the default args (the CDM downloads on first run). Branded Chrome 155 ignores
   `--load-extension`.
