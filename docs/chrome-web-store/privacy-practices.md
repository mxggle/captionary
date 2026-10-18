# Privacy practices — dashboard field drafts

Prepared October 18, 2026 from the current source. These are proposed answers, not submitted certifications. Reconcile them with the final package and the published privacy policy before submitting.

The build includes optional ChatGPT account sign-in. Authentication information includes its access and refresh tokens. Personally identifiable information includes returned email and account identifiers. The flow requests optional auth.openai.com, chatgpt.com, and localhost host access; localhost is given back as soon as the sign-in ends (unless a local model server uses it), and removing the provider gives back the other two. Sign-out deletes stored tokens without server-side revocation. Source inspected October 18, 2026; interactive sign-in remains unverified.

## Single purpose

Help users learn languages from subtitles and reading material through dual subtitles, contextual word lookup, vocabulary review, and optional AI explanations.

## Permission justifications

### storage

Stores language preferences, subtitle and playback settings, saved vocabulary, AI provider configuration, and usage counters locally in the browser. API keys are stored separately in local extension storage and excluded from settings exports.

### unlimitedStorage

Allows the user's locally saved vocabulary, downloaded word-frequency data, and cached AI answers to grow beyond the default extension storage quota without losing study material. The extension does not use this permission to upload stored material.

### contextMenus

Adds user-invoked menu actions to explain selected text in the language tutor and open a page's readable text in Captionary's reader.

### sidePanel

Displays the language tutor alongside the current page for explanations and follow-up questions about selected words or sentences.

### scripting

Extracts selected or readable page text into the reader when the user invokes the reader action. It runs the extraction on the selected tab under the temporary activeTab permission.

### activeTab

Provides temporary access to the tab the user chooses through the toolbar or context-menu action, so Captionary can import its title, URL, and readable text into the reader without permanent access to every website.

### Required host access and content-script sites

YouTube and Netflix: read subtitle tracks and playback state and display language-learning controls on the supported video pages. Netflix's nflxvideo.net subtitle hosts: download subtitle data for the video being studied. Wiktionary: request dictionary definitions for words the user looks up. Content scripts also run at tv.apple.com to read subtitle metadata and display the learning interface; current Apple subtitle downloads use the page's CORS-enabled CDN.

To find the subtitle tracks, a small script in each video page's own context watches only the player's subtitle requests: YouTube's /api/timedtext caption requests and Apple TV+'s .m3u8 playlists. On Netflix it reads the subtitle-track list from the player's manifest and asks that manifest to include WebVTT subtitles and all subtitle tracks. These scripts do not record browsing, other network requests, or user activity, and send nothing off the device themselves.

### Optional host access

The extension supports user-selected cloud AI services and custom OpenAI-compatible endpoints, so it declares an optional HTTPS host pattern. It requests permission for a specific provider origin when the user configures that provider, and removes it when the user removes the provider (unless another configured provider uses the same origin). Optional localhost and 127.0.0.1 HTTP access supports user-configured local Ollama or LM Studio servers. These optional declarations do not grant permanent access to all websites on installation.

Optional ChatGPT sign-in requests three origins when the user clicks "Sign in with ChatGPT": https://auth.openai.com/* for OpenAI's sign-in and token endpoint, https://chatgpt.com/* for the ChatGPT backend that answers the user's requests, and http://localhost/*. The sign-in uses the public client OpenAI publishes for its Codex CLI, which redirects to http://localhost:1455/auth/callback. Captionary runs no local server; localhost access lets it read the authorization code from that redirect in the sign-in tab and close the tab. Captionary gives localhost access back as soon as the sign-in ends, unless a local model server the user configured needs it.

## Remote code

Proposed answer: No, I am not using remote code.

The production package bundles its application code and fonts. Dictionary definitions, subtitle tracks, frequency lists, and AI responses are data. AI output is displayed as text/Markdown rather than executed as JavaScript. Recheck the final build for externally loaded scripts, executable responses, eval, and remote WebAssembly before making this declaration.

## Data-use categories

Use the exact category wording presented by Google at upload time. Do not claim that the extension handles no user data merely because the developer has no backend.

| Category | Proposed treatment | Reason |
| --- | --- | --- |
| Website content | Disclose | Reads subtitles, page text selected/imported by the user, and related media/page titles; relevant text can be sent to dictionary services and configured AI providers. |
| Authentication information | Disclose | Stores provider API keys and optional ChatGPT OAuth tokens locally; sends the relevant credential to the configured provider or token endpoint. This does not mean it reads website passwords or session cookies. |
| Personally identifiable information | Disclose | Optional ChatGPT sign-in stores returned email, account/workspace ID, and plan/account metadata locally and uses the account ID to authenticate provider requests. |
| Web history | Disclose | Saved vocabulary and reader imports can contain source URLs and titles. The extension does not request the history permission or read Chrome's browsing-history database. Do not equate those two facts. |
| Personal communications | Disclose | The tutor accepts follow-up chat messages and sends recent conversation turns to the configured provider. This does not mean it automatically reads email or private messaging accounts. |
| Health, financial, location, user activity | No dedicated collection feature identified; review final use | No location, payment, analytics, or general interaction-tracking feature was identified in the inspected source. User-selected/imported text and chat can nevertheless contain personal or sensitive information; the policy explains that it may be sent when used with cloud AI. |

The final dashboard certification needs the publisher's review: data is used for the stated language-learning features, not sold, used for unrelated purposes, or used to determine creditworthiness. Do not tick certifications for practices that have not been confirmed.

## Privacy policy URL

Pending: a real publicly accessible HTTPS URL for the reviewed `privacy-policy.md`. No URL has been invented or published.

## Reference

https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
