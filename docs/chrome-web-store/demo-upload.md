# Captionary demo upload — October 18, 2026

Status: development demo uploaded and form drafts saved. Not submitted for review or published. The upload remains in the dashboard until replaced or removed; it does not expire automatically.

- Item ID: `imcclapmlgkhceckdmnhhcchmgjkcbci`
- Dashboard: https://chrome.google.com/webstore/devconsole/aa9d7618-6f72-453c-a3ee-d069f8a459e5/imcclapmlgkhceckdmnhhcchmgjkcbci/edit/listing
- Uploaded version: `0.1.0`
- Package: `.output/captionary-0.1.0-chrome.zip`
- Package size: 1,208,193 bytes
- SHA-256: `4ef0077e4660d8495e23db86605ff5213daf63a17caf8b33c2b32cd55a020572`
- Source change for upload: shortened the WXT manifest description to 124 characters. Existing development changes were included in the build and preserved.

## Saved fields

- Listing: description from `listing.md`, category Education, language English, existing 128 × 128 icon.
- Privacy: single purpose; justifications for storage, unlimitedStorage, contextMenus, sidePanel, scripting, activeTab, and hosts; remote code set to No.
- Disclosed data categories: personally identifiable information, authentication information, personal communications (AI chat), web history (retained source URLs/titles), and website content. These cover optional configured features, not a claim that all data is always collected.
- Distribution: Private for this development demo; no tester accounts added. Free-of-charge and all-region defaults retained. No publication action taken.
- Test instructions: saved a 474-character setup guide; username/password left empty because no shared review credentials were provided or required for the reader/vocabulary features.

## Intentionally incomplete

- Privacy policy URL: no public policy page has been provided or published. Local policy draft now describes the current ChatGPT OAuth flow.
- Screenshots and promotional artwork: no final product captures provided.
- Homepage/support URLs: left blank pending verified public destinations.
- The three final data-use certifications remain unchecked for publisher review alongside the final policy and release behavior.
- Interactive sign-in, streaming platform playback, and final reviewer access have not been manually verified.

## Validation

`pnpm check` passed TypeScript, all 122 tests in 13 files, and source formatting. `pnpm zip` succeeded. ZIP validation confirmed the manifest at its root, Captionary identity, a 124-character summary, production host permissions without the test-only localhost grant, and no source-map or common secret-file extensions. Source inspection found no eval, new Function, remote script tags, or WebAssembly usage in the inspected source/build. This is not a security audit or a guarantee of store approval.

For the next package upload, use a higher version than `0.1.0` if the dashboard requires it. Replace the development demo before submitting the real release.
