# Captionary 0.2.1 submission

Prepared October 20, 2026 (Asia/Tokyo).

## Current state

The 0.2.1 production package was uploaded and submitted for review on October 20, 2026. The dashboard confirmed “Your extension was submitted for review” and the Status page shows “Pending review”. Automatic publication was unchecked; approval will require manual publication.

After the user completed Google verification, the dashboard showed 0.2.0 had been accepted and was ready to publish, but was not published. Used “Cancel Publish” to return it to Draft, then uploaded 0.2.1 to the same Captionary item (`imcclapmlgkhceckdmnhhcchmgjkcbci`). LingoContext was not modified.

## Source and scope

- Branch: `main`, HEAD `e3649a7`; fetching origin found no newer main commits.
- Includes the committed Netflix manifest-v4 subtitle fix and player-control clearance changes merged after the submitted 0.2.0 source (`8fee555`).
- Also includes the user's current uncommitted changes in `src/content/controller.ts`, `src/content/sites/netflix.ts`, `src/content/ui/Overlay.tsx`, and `src/content/ui/SubtitleDrawer.tsx`, which reserve player space for the subtitle drawer and update its layout.
- Changed only `package.json` from version 0.2.0 to 0.2.1 during this preparation. Existing source and website edits were preserved. No commit or push was performed.

## Artifact and validation

- ZIP: `.output/captionary-0.2.1-chrome.zip`
- Size: 1,555,229 bytes
- SHA-256: `7588740f52dfce2ecfab27a6977bc25e9994278bccffb1a87a6177ab47fdeed4`
- `pnpm check`: TypeScript, all 142 tests across 15 files, and formatting passed.
- `pnpm zip`: production build succeeded.
- Compared ZIP manifests with the submitted 0.2.0 artifact: only the version differs. Permissions and locale configuration are unchanged.
- Verified no required test-only localhost host grant, source-map/common secret-file extensions, or overlong localized manifest summaries.
- Live Netflix/Apple TV+ playback and the current uncommitted drawer layout have not been manually verified during this preparation.

## Store verification and evidence

- Package page confirmed version 0.2.1, the same four languages and permissions.
- Existing listing description, two global screenshots, promo tile, homepage and support URLs were retained.
- Privacy permission justifications, remote-code answer, data disclosures, certifications and privacy-policy URL were retained and checked.
- Distribution remains free of charge, Public, all regions.
- Existing reviewer instructions remain saved and valid for the core tools without a Captionary account.
- Submission dialog's automatic-publishing checkbox was explicitly unchecked before submission.
- Evidence: `release/store-evidence/submitted-0.2.1.png` and `release/store-evidence/status-pending-0.2.1.png`.
- Next step: wait for Google's review, then manually publish when ready. Submission is not approval or public availability.
