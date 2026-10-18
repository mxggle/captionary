# Captionary Privacy Policy

Last updated October 18, 2026.

Captionary helps you learn languages from video subtitles and reading material. This policy describes how the extension handles that material, your study data, and optional AI requests.

## Data stored in your browser

Captionary stores settings, language preferences, saved words and phrases, notes, context sentences, source titles and URLs, video timestamps, configured AI services, and local usage counters in your browser's extension storage. It may cache AI answers and downloaded word-frequency lists locally. Imported reading material and side-panel context are passed between extension pages using browser session storage. The reader also keeps the last document you opened (its title, address, language, and text) in local extension storage so you can return to it; opening another document replaces it.

Provider API keys are stored separately in local extension storage. They are excluded from settings exports and sent to the configured provider when needed to authenticate requests. Web pages cannot read extension storage, but local storage is not an encrypted credential vault. Protect your browser profile and device.

Captionary does not use Chrome Sync for this data. The current extension does not include a developer-operated account service, analytics SDK, or advertising integration.

## Video and reading content

On supported video sites, Captionary reads subtitle tracks and playback information to display subtitles, look up words, and provide study controls. When you explicitly open a page in the reader, it reads the selected or readable page text, title, URL, and language. It does not read Chrome's browsing-history database. Source information may be retained with your saved vocabulary or imported reading material.

Local video and text files are opened for the reader or local video feature. Captionary does not upload the video file as part of playback. If you use cloud AI on text or subtitles from a local file, that text can be sent to the configured AI service.

## Requests to other services

- Video platforms and their subtitle hosts receive the requests required to obtain the subtitles you study.
- Wiktionary lookup is on by default. While it is enabled, the word or phrase you look up is sent to Wiktionary for definitions.
- When word-frequency coloring is enabled, Captionary downloads a frequency list for the relevant language from a GitHub-hosted dataset.
- External dictionary and search links open the selected service with the lookup term in the URL when you choose them.
- Pronunciation uses the browser's speech-synthesis voices. Some voices may use an online service; processing depends on the voice and browser.

These services can receive ordinary network information, such as your IP address, and apply their own privacy policies.

## Optional AI features

No cloud AI provider is configured by default. If you add one and use an AI feature, Captionary sends the relevant word, phrase, sentence, subtitle text, prompt, or chat to that provider. Requests can also contain your selected languages and learning level. Depending on the task and your privacy settings, requests may include nearby subtitle lines, an existing translation, or the media title. Title sharing is on by default; in the reader, the title is the web page's title. Follow-up chat includes recent conversation turns; subtitle translation sends batches of subtitle lines.

If you choose a fallback provider, a request the main provider cannot answer (for example during an outage, a rate limit, or a usage limit) is sent to the fallback provider instead, with the same content.

Captionary asks Chrome for access to each AI service's site when you add the service, and removes that access when you remove the service, unless another configured service uses the same site.

After configuration, optional automatic explanations or AI subtitle translation can make requests as you use those features. Review your settings before studying private material. Avoid sending sensitive personal information to a provider unless you intend to do so.

You can change the explanation context scope and title-sharing setting, choose another provider, disable automatic explanations, or use a local AI service instead. Supported Chrome on-device AI and translation process supported tasks on your device, although setup may require model or language-pack downloads. A localhost provider runs through the service you configure; that service's own configuration determines whether it makes further network requests.

Each cloud provider controls its own retention, training, account, and billing practices. Captionary cannot delete data that a provider has already received. Consult that provider's policy and account controls.

## Optional ChatGPT account sign-in

If you choose ChatGPT sign-in, Captionary opens OpenAI's authentication page at auth.openai.com using an OAuth authorization flow with PKCE. It uses the public sign-in client that OpenAI publishes for its Codex command-line tool; OpenAI has not documented this sign-in for other apps, so it may change or stop working. Captionary is not affiliated with or endorsed by OpenAI. Captionary never sees your OpenAI password.

The sign-in requests the openid, profile, email, and offline_access scopes. The authorization code returns through a localhost callback URL observed in the sign-in tab, then is exchanged at OpenAI's token endpoint. No local server is started by Captionary for that callback. Reading that callback address needs temporary access to http://localhost; Captionary gives it back as soon as the sign-in ends, unless a local AI service you configured uses localhost.

Captionary stores the resulting access token, refresh token, expiration time, account/workspace identifier, and any returned email, plan, or account-type metadata in local extension storage under a key separate from exported settings. Tokens are not synced or included in settings exports. The email and plan can be displayed in the provider settings. The current implementation refreshes expiring access tokens through auth.openai.com.

AI requests and model-list requests for this provider go only to chatgpt.com/backend-api/codex, with the access token and account identifier in request headers. They also identify Captionary to OpenAI with an "originator: captionary" header, and for accounts OpenAI marks as FedRAMP accounts, a header saying so. These requests omit browser cookies. When you connect ChatGPT or test the connection, Captionary sends one short test request ("Reply with the single word OK"), which counts toward your plan's usage like any other request. The response request sets store to false; this request parameter is not a guarantee about OpenAI's overall retention practices. OpenAI's account terms, availability, usage limits, and privacy practices apply.

Signing out deletes the locally stored tokens and account metadata and keeps the provider, with its access to chatgpt.com and auth.openai.com, so you can sign in again. Removing the provider also deletes the tokens and gives back that site access. Neither action calls a server-side token revocation endpoint or erases OpenAI-side records; to end the session at OpenAI as well, log out of all devices in ChatGPT's security settings. You can also manage the extension's site permissions in Chrome.

## Purpose and sharing

Captionary uses the data described here to provide its language-learning features. The current extension has no data-sale, advertising, or credit-scoring feature. It does not send your study data to a developer-operated backend. Data can leave your device through the service requests described above and through exports or links you choose to use.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Retention and your controls

Saved vocabulary and settings remain in local storage until you remove them, reset extension data, or remove the browser profile or extension. Cached AI answers have a configurable retention period and can be cleared in settings. Downloaded word-frequency data may remain cached locally. Local usage counters can be reset.

"Delete everything" under Settings → Data & backup removes settings, saved vocabulary, AI provider connections, API keys, ChatGPT sign-in tokens, the reader's last document, cached AI answers, and downloaded word-frequency lists, and gives back the site access granted for AI services.

You can delete saved vocabulary entries, remove AI provider connections and their stored keys, clear cached AI answers, and use the extension's data-reset controls. Export any study data you want to keep before resetting or uninstalling. Exported files are under your control and are not automatically deleted by the extension. Removing local data does not remove data already received by third-party services.

## Changes and contact

Update this policy when Captionary's data practices change, and revise the date when publishing a new version.

Public support contact: https://github.com/mxggle/captionary/issues
