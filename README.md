# Captionary

A Chrome (Manifest V3) extension for learning languages from YouTube, Netflix and Apple TV+ (tv.apple.com), modeled on
[Captionaryor](https://www.languagereactor.com/), with an AI tutor that explains vocabulary
using the AI provider of your choice.

## Features

**Watching (YouTube, Netflix, Apple TV+)**
- Dual subtitles on the video: the original line plus a translation (blur-until-hover option).
- Translation sources, in order of preference: a human subtitle track in your language → YouTube
  auto-translate → Chrome's on-device translator → your AI provider.
- Captionary's button sits in the player's own control bar (left of the captions button on YouTube)
  and opens a menu shaped like the site's settings menu: original track, translation source,
  pause after each line, blur, subtitle list. Captions, menus and the look-up card take each
  site's own look and font.
- Subtitle list in YouTube's side column, or as a drawer over the video in fullscreen and on
  Netflix and Apple TV+ (`W`): follows playback, click a timestamp to jump, search, copy,
  download `.srt` with both languages, choose the original track and the translation source.
- Romanization line under the original: pinyin with tone marks for Chinese (context-aware via
  `pinyin-pro`), romaji for Japanese kana, and romanized Korean, Russian, Ukrainian, Bulgarian,
  Serbian, Greek and more. Also shown in the pop-up and the reader.
- Optional word-frequency colors: words are underlined by how common they are in film and TV
  subtitles (2k–8k, 8k–20k, rarer), using OpenSubtitles frequency lists downloaded once per
  language. The pop-up shows the word's rank.
- Playback tools: auto-pause after every line, previous / repeat / next line, speed control,
  pause while hovering the subtitles.
- Keyboard shortcuts (all remappable): `A` previous, `S` repeat, `D` next, `Q` auto-pause,
  `X` translation, `Z` original, `W` list, `[`/`]` speed, `E` explain line, `G` save line, `Esc` close.

**Looking things up**
- Click any word; press and drag across words to select a phrase. Works for languages without
  spaces (Chinese, Japanese, Thai) through the browser's ICU word segmenter.
- Pop-up with pronunciation (speech synthesis), instant on-device translation, Wiktionary
  definitions, links to external dictionaries, and the AI tutor:
  - **Explain in context** — meaning in this sentence, form/grammar, usage notes, examples.
  - **Sentence breakdown** (`E` or ✨ on a line) — translation, literal gloss, chunk-by-chunk
    breakdown and grammar points.
  - **Follow-up chat** — ask anything about the word or line.
- AI tutor side panel (`Alt+L`, or right-click selected text on any page → *Explain with Captionary*).

**Vocabulary**
- Save words and phrases as *learning* or *known*; learning items are highlighted wherever they
  appear again (subtitles, list, reader). Context sentence, translation, source and timestamp are kept.
- Saved-words page: search and filter, edit translations and notes, flashcard review,
  export to CSV or Anki (tab-separated, HTML fields, sentence with the word in bold), JSON backup.

**Reader**
- Paste text, open `.txt`/`.srt`/`.vtt` files, or send any web page to the reader
  (right-click → *Open this page in the Captionary reader*). Every word is clickable;
  translate all sentences, listen, explain sentences.
- Local video mode: play a video file from your disk with `.srt`/`.vtt` subtitles and get the
  same overlay, list, shortcuts and look-ups as on YouTube.

## AI providers and settings

Supported: OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI,
Ollama and LM Studio (local), any OpenAI-compatible endpoint, and Chrome's built-in Gemini Nano.

How the AI settings are designed:

| Concern | What the extension does |
| --- | --- |
| **API keys** | Stored in `chrome.storage.local` under their own keys — never `storage.sync`, never in settings exports, masked in the UI. Only the background service worker reads them; content scripts and web pages never see a key. |
| **Network access** | No AI hosts in the manifest. When you add a provider, Chrome asks once for that single origin (`optional_host_permissions`). HTTPS is required except for `localhost`; credentials in URLs are rejected. |
| **Where requests run** | All provider calls go from the background worker (official `openai` and `@anthropic-ai/sdk` SDKs; Gemini over REST with the key in a header, not the URL). Streaming answers reach the page over a port; closing the pop-up aborts the request. |
| **Models** | Live model lists from each provider (`/models`), with sensible suggestions until fetched; free text for custom ids. **Test connection** uses the free list endpoint, not a paid completion. |
| **Per-task routing** | Word look-up, sentence breakdown, follow-up chat and subtitle translation can each use a different provider/model, reasoning effort, temperature and output limit. Optional fallback provider on outages, rate limits or exhausted credit. |
| **Parameters** | Temperature defaults to the provider's own (current reasoning models reject custom values). Reasoning effort is mapped per provider (`reasoning_effort`, Claude `output_config.effort`, Gemini thinking budget/level) and extra output room is reserved for thinking. If a model rejects an optional parameter, the request is retried once without it. |
| **Reliability** | Timeouts, retries with exponential backoff that honours `Retry-After`, clear error messages (bad key, no credit, rate limit, local server not running, Ollama origin setup), refusal handling. Claude Opus/Sonnet 5.x requests opt into server-side refusal fallback. |
| **Cost control** | Explanations are generated on demand by default, answers are cached locally (IndexedDB, configurable TTL), a daily request limit stops runaway spend, usage and token counters per model. |
| **Privacy** | Choose how much context is sent (word only / sentence / sentence ± 2 lines) and whether the video title is shared. Local options (Ollama, LM Studio, Chrome built-in) keep everything on your machine. |
| **Prompt safety** | Subtitle and page text is wrapped in `<context>` tags that it cannot close, every prompt says it is untrusted data, and rendered answers never load images or raw HTML (so injected text cannot exfiltrate data through URLs). Prompts are editable with variables and a reset button. |

### Local models
- **Ollama**: start it with `OLLAMA_ORIGINS="chrome-extension://*" ollama serve` so it accepts requests from the extension.
- **LM Studio**: enable the local server in the Developer tab.
- **Chrome built-in AI**: open *Settings → AI providers*, add it and click *Download model* (desktop Chrome with supported hardware).

## Development

```bash
pnpm install
pnpm dev          # Chrome with the extension loaded and hot reload
pnpm build        # production build in .output/chrome-mv3
pnpm zip          # store-ready zip
pnpm test         # unit tests (Vitest)
pnpm compile      # type-check
```

Load the build manually: `chrome://extensions` → *Developer mode* → *Load unpacked* → `.output/chrome-mv3`.

### Layout

```
src/
  entrypoints/
    background.ts              message router, AI gateway, dictionary, context menus, side panel
    youtube-main.content.ts    page-world hooks: caption track list + the player's caption token
    youtube.content/           overlay + subtitle list UI (shadow DOM) and navigation handling
    netflix-main.content.ts    page-world hooks: subtitle URLs from the manifest, player API seek
    netflix.content/
    appletv-main.content.ts    page-world hooks: HLS master playlist (subtitle renditions), MusicKit play/seek
    appletv.content/           overlay + list mounted inside Apple's modal player dialog
    options/ popup/ vocab/ reader/ sidepanel/
  content/                     session store, playback controller, site adapters, shared UI
  lib/ai/                      provider registry, adapters, gateway, prompts, cache, usage, secrets
  lib/subtitles/ lib/text/     parsers (json3, WebVTT, SRT, TTML), alignment, tokenizer, detection
  ui/                          design tokens (tokens.css), components.css, page shell, look-up logic and cards,
                               controls, fonts.css (extension pages only; video sites never load fonts)
```

### Notes on the sites
- **YouTube** now requires a proof-of-origin token on caption downloads. The page-world script
  watches the player's own caption request and the extension reuses its token; if the player has
  not requested captions yet, it is asked to load them once (native captions stay hidden).
- **Netflix** subtitle URLs come from the player's manifest; the extension asks for WebVTT and all
  subtitle languages. Seeking goes through Netflix's player API because setting `currentTime`
  directly crashes their player.
- **Apple TV+** (web player at tv.apple.com; iTunes purchases/rentals do not play on the web):
  every subtitle language is a rendition in the HLS master playlist, which the page-world script
  captures. Apple ships human subtitles in ~40 languages, so translations are usually a real
  track. Playback goes through MusicKit; the UI is mounted inside the player's modal dialog.
  Leave Apple's own subtitles off. Details: `docs/research/apple-tv-web.md`.
