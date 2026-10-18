# Reviewer instructions and release preparation

Prepared October 18, 2026. At the user's later request, a current-code demo package was uploaded as a new Captionary draft. The existing LingoContext item is a separate extension and was left untouched. See `demo-upload.md` for the saved state.

## Suggested test instructions

Captionary's core reader and vocabulary features do not require a Captionary account. Cloud AI features require the reviewer's own supported provider credentials, or a compatible local/on-device setup. No developer API key is included in the package or these instructions.

1. Install the final production build in desktop Chrome. Open Captionary settings and choose the learning and translation languages.
2. Open the reader from the toolbar. Paste a short sample such as: “I gave up waiting and went home.” Click a word or select a phrase. Check dictionary lookup and available pronunciation.
3. Save a word, open Saved words, edit a note, and check vocabulary export or review. Use disposable test study data.
4. Open a YouTube video with available captions. Confirm original subtitles, a second language where available, clickable words, subtitle list, repeat/seek, and pause-after-line controls. Translation availability depends on the video's tracks and the selected translation engine.
5. Netflix and Apple TV+ checks require the reviewer's own valid access and a title with subtitles. Captionary does not supply subscriptions or bypass access controls. Apple TV+ support targets tv.apple.com in the browser.
6. Optional AI: configure an available provider in Settings → AI providers. Grant its specific origin only if prompted and desired. Test a word explanation, sentence breakdown, and follow-up question. Cloud API usage may incur charges from the selected provider. Built-in Chrome AI requires supported hardware/browser/model availability; localhost models require a running local service.
7. Optional ChatGPT sign-in: needs the reviewer's own ChatGPT Plus, Pro or Business account. In Settings → AI providers, add ChatGPT and click "Sign in with ChatGPT". Chrome asks for chatgpt.com, auth.openai.com and localhost. The sign-in uses the public client OpenAI publishes for its Codex CLI, which redirects to http://localhost:1455/auth/callback; nothing listens there, so Captionary reads the code from that tab, closes it, and gives localhost access back. Sign out deletes the tokens; removing the provider also gives back chatgpt.com and auth.openai.com.
8. Optional local-video check: open a local video and a matching SRT or VTT file in the reader.

Before submission, record a reproducible public YouTube test URL and its available caption languages, plus the Chrome version used. These have not yet been verified for the final release. Do not claim all platform features were manually tested in this preparation pass.

## Distribution choices for later

- For development testing, consider Private with explicitly approved testers, or Unlisted for people who have the link. Choose the intended scope before submission; unlisted is not private.
- For a public release, choose Public only when ready.
- Select supported regions deliberately; no country availability has been changed.
- Use staged/manual publishing after approval if offered and you want to control the release time.
- Review the current pricing/payment declaration against the actual release. Independently billed cloud AI services and video subscriptions must remain clear in the listing.

Private visibility has been saved for the development demo. No legal certification has been selected; payment and region defaults were retained.

## Publisher setup observed live

- Publisher display name is set to Harry Sui.
- Contact email is verified. The dashboard says it is publicly displayed with items.
- Non-trader is currently selected. The publisher must determine whether this accurately describes their activity; it was not changed.
- No postal address was shown; the dashboard offers “Enter address.” Confirm whether one is required for the intended distribution before submission. Do not enter a private address without deciding what will be published.
- Publisher-level item support visibility is off. It affects all items, so it was not changed for this one extension.

## Remaining work

- Complete development and perform manual smoke tests of the final production build.
- Create genuine final-product screenshots and the small promotional image; check icon padding against Google's image guidelines.
- Review and publish `privacy-policy.md`, replace its contact placeholder, and verify the final HTTPS URL.
- Verify a public support destination and homepage, if supplied.
- Review data-use categories and certifications in `privacy-practices.md` against the final build.
- ChatGPT token handling, account identifiers, host access and sign-out were rechecked against the source on October 18, 2026, and the policy, practices and listing drafts now describe them. An interactive sign-in with a real account is still untested.
- Bump the manifest version above 0.1.0 (the demo upload) before uploading the release package.
- Replace the uploaded demo ZIP with the final package when authorized.
- Review the saved fields and final data-use certifications, then submit for review only when explicitly authorized.

## Validation already run

For the uploaded demo snapshot, `pnpm check` passed TypeScript, all 122 tests across 13 files, and source formatting; `pnpm zip` succeeded. This does not establish manual playback compatibility, interactive sign-in, or approval by Google. The manifest summary was shortened to satisfy the store limit, and existing user development changes were preserved. Reconcile all drafts with the final release before submission.

## Official references

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- https://developer.chrome.com/docs/webstore/images
