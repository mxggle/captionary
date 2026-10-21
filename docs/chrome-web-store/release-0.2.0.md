# Captionary 0.2.0 submission

Date: October 18, 2026 (Asia/Tokyo).

## Result

Chrome Web Store displayed “Your extension was submitted for review” and “Status: Pending review”. Automatic publication was explicitly unchecked. This is a submitted review, not approval or publication. Google notes that a staged approval expires after 30 days if it is not published.

- Item: `imcclapmlgkhceckdmnhhcchmgjkcbci`
- Status: https://chrome.google.com/webstore/devconsole/aa9d7618-6f72-453c-a3ee-d069f8a459e5/imcclapmlgkhceckdmnhhcchmgjkcbci/edit/status
- Version: `0.2.0`
- Source: clean `main`, commit `8fee555`; `git pull --ff-only` returned “Already up to date.”
- Package: `.output/captionary-0.2.0-chrome.zip`
- SHA-256: `225f17cc1cc6e3fb8a0e1f0387ff017471b7b812ccf6f7b382961444c718be48`

## Store form

- Replaced the 0.1.0 demonstration package with 0.2.0, including the new multilingual interface and setup guide.
- Saved English, Simplified Chinese, Traditional Chinese, and Japanese descriptions. Exact text is backed up in `listings-0.2.0.json`.
- Category Education; free of charge; Public visibility with all-region defaults; publishing remains manual after approval.
- Uploaded two genuine 1280 × 800 JPEG captures from Chrome running the extension loaded manually by the user. These show YouTube subtitle lists/Chinese track selection and a Wiktionary word lookup. No synthetic AI answers or credentials appear in them.
- Uploaded a 440 × 280 JPEG promotional tile derived from the existing vector logo.
- Saved homepage `https://captionary.nihongo.day/`, support `https://github.com/mxggle/captionary/issues`, and privacy URL `https://captionary.nihongo.day/privacy.html`.
- Updated storage and host justifications to cover setup preferences, the reader's retained document, subtitle-only page hooks, provider permission release, and temporary localhost access during ChatGPT sign-in.
- Retained disclosed categories: personally identifiable information, authentication information, personal communications, web history/source metadata, and website content. Checked the three factual data-use certifications after reviewing the source and published policy.
- Replaced the demo reviewer instructions with current setup/reader/vocabulary/YouTube steps, explaining optional AI credentials and possible provider charges. No account credentials were supplied or uploaded.

## Website deployment

- Created Vercel project `mxggles-projects/captionary` and deployed the existing static `site/` contents.
- Deployment: `dpl_A1ty1LXVbkuRViVax5rz6rrcZPLo`.
- Public Vercel alias: https://captionary-steel.vercel.app/
- Production custom domain: https://captionary.nihongo.day/
- Configured Git root `site`, framework Other, empty install/build commands, output `.`.
- Added only the requested Spaceship DNS record: `captionary CNAME 124b28d0f0347290.vercel-dns-017.com`, TTL 30 minutes. The existing 15 records were preserved; the zone now has 16.
- Vercel verified the domain and issued its HTTPS certificate. The homepage, privacy policy, stylesheet, demo script, localization script, share image, and favicon returned HTTP 200. The homepage and policy also rendered successfully in the built-in browser.
- Added canonical and absolute Open Graph URLs to the local site sources. No commit or push was performed.

## Validation and limits

- `pnpm check`: TypeScript passed, all 140 tests across 15 files passed, source formatting passed.
- `pnpm zip`: production package built successfully. ZIP root manifest, referenced entrypoints/icons, production hosts, four locale summaries, and common excluded secret/source-map file extensions were checked.
- Browser smoke test on `https://www.youtube.com/watch?v=LKrwhjOI8Nc`: subtitle loading, Chinese subtitle-track selection, timeline navigation, and dictionary lookup worked. No API key, account sign-in, paid AI request, or vocabulary mutation was used for the smoke test.
- Netflix, Apple TV+, local video, end-to-end ChatGPT sign-in, and cloud AI responses were not manually tested during this submission pass. Their presence in source/tests is not proof of live compatibility. The listing discloses subscriptions, provider limits, optional AI, and the undocumented ChatGPT integration.
- Store validation permitted submission. This does not guarantee Google's approval.

## Evidence

- `release/store-evidence/submitted-0.2.0.png`
- `release/store-evidence/status-pending-0.2.0.png`
- `release/store-evidence/privacy-live.png`
- `release/store-evidence/homepage-live.png`
- `release/store-assets/01-youtube-subtitles.jpg`
- `release/store-assets/02-word-lookup.jpg`
- `release/store-assets/promo-440x280.jpg`

These local `release/` artifacts are ignored by Git.
