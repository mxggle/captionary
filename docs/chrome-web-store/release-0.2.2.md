# Captionary 0.2.2 submission

Submitted October 25, 2026 (Asia/Tokyo).

## Result

Uploaded 0.2.2 to Captionary item `imcclapmlgkhceckdmnhhcchmgjkcbci`. Dashboard confirmed submission and Pending review. Automatic publication was explicitly unchecked. This is not approval or public publication. Prior 0.2.1 was approved but unpublished; Cancel Publish returned it to Draft before replacement. LingoContext was not changed.

## Source and package

- Current user branch: `in-the-show-tab`, HEAD `a9b3fef996c040963a4b23b26ff73e945c52a319`. Working tree was clean before release preparation; no checkout, pull, commit or push performed.
- Includes current UI/keyboard improvements, platform menu styling and controls, optional In the show explanations, and preservation of answers when settings change.
- Changed package version from 0.2.1 to 0.2.2.
- ZIP: `.output/captionary-0.2.2-chrome.zip`, 1,616,876 bytes.
- SHA256: `0594b78bbec6fbad482066b0ee891d1236810c5db469bee5161238b918fb6c2f`.
- `pnpm check` passed TypeScript, 184 tests across 20 files, and formatting. `pnpm zip` passed.
- Built manifests differ only in version. No added permissions; four localized descriptions within 132 characters. No source maps or common secret-file extensions in ZIP.
- Live video playback, optional account sign-in, and final UI screenshots were not manually re-tested this turn. Existing store screenshots were retained.

## Disclosures and website

- Verified saved privacy categories/certifications, no remote code, privacy URL, and free/Public/all-regions distribution.
- Added off-by-default In the show subtitle-excerpt sharing to the host-permission justification and saved successfully.
- Deployed current `site` to the existing Vercel project to publish the already-written new privacy disclosure. Updated policy dates to October 25 in source policy and four website locales.
- Final deployment: `dpl_GoMdkHgCtUmhH8TnWd6oJcQEeC5w`, READY, aliased to `https://captionary.nihongo.day`.
- Live browser and unauthenticated HTTP checks confirmed the privacy page serves the new disclosure. Browser confirmed updated date.
- Initial deployment from site directory failed because project rootDir is site; subsequent deployment from repository root succeeded. No project settings were changed.

## Evidence

- `release/store-evidence/submitted-0.2.2.png`
- `release/store-evidence/status-pending-0.2.2.png`
- `release/store-evidence/privacy-0.2.2.png`
