# Captionary site

The landing page: plain HTML, CSS and a small script for the hero demo, with no build step. Deploy the
folder as it is (GitHub Pages, Cloudflare Pages, Netlify, Vercel).

## Production

- Homepage: https://captionary.nihongo.day/
- Privacy policy: https://captionary.nihongo.day/privacy.html
- Vercel project: `mxggles-projects/captionary`
- Git source root: `site`; framework Other; no install/build command; output `.`.
- The initial production deployment includes local canonical/Open Graph URL updates. Commit those changes when ready so subsequent Git-based deployments retain them.

Preview locally:

```bash
python3 -m http.server 4178 --directory site
```

## Before launch

- **Store link.** Every "Add to Chrome" button points to
  `https://chromewebstore.google.com/detail/captionary/imcclapmlgkhceckdmnhhcchmgjkcbci` (`data-cta`
  marks them). The item is private until it's published, so the link 404s until then.
- **Domain.** Canonical, Open Graph URL, and the absolute share-image URL now use `captionary.nihongo.day`.
  The homepage and `privacy.html` URLs are saved in the Chrome Web Store submission.
- **Privacy policy.** `privacy.html` is the text of `docs/chrome-web-store/privacy-policy.md`, linked from both
  footers, with the GitHub issues page as the public contact. Edit the Markdown file and the page together and
  change the "Last updated" date when the policy changes.

## Deploying to Vercel

Import the repo, set **Root Directory** to `site`, Framework Preset **Other**, no build command. `vercel.json`
adds security headers and long caching for fonts.

## Share image

`og.png` (1200 × 630) is a capture of the hero: the headline and the demo player with the starting
look-up open, laid out side by side. It was taken in headless Chrome for Testing with the page at
1600 × 840 CSS pixels and a device scale of 0.75, so the real fonts and the real card are drawn at the
final size. Take it again when the headline or the demo changes.

## Keeping the comparison honest

Every Language Reactor claim in `#compare` was checked against its own pages on October 18, 2026, and
each one has a numbered source. Recheck them before launch and whenever Language Reactor ships an update
(its update history is at https://www.languagereactor.com/help/updates), and change the date in the
section intro when you do. Captionary claims follow the main README; update both together.

## Hero demo

`demo.js` holds the two sample lines (Spanish, Japanese) with hand-written glosses and explanations. It
mirrors the extension's native look-up card: Save / Known / Explain, the "Phrase" suggestion the tutor
makes, and saving under the dictionary form. Keep it in step with `src/content/ui/LookupCard.tsx` when
the card changes.

## Localization

`i18n.js` provides client-side localization for `index.html`, `privacy.html`, and `demo.js` in English (`en`),
Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`), and Japanese (`ja`). It supports `?lang=` URL
parameters (including aliases like `zh` and `zh-HK`), persists the user's choice in `localStorage`
(`captionary-site-lang`), and falls back to `navigator.languages` when no explicit choice is set.

A small inline script in each page's `<head>` repeats that detection before the first paint: it sets
`<html lang>` and, for a non-English page, the `i18n-pending` class that keeps the page hidden until
`i18n.js` has put the text in (2.5 s at most). Change it together with `detectLang()`. Each language's
`?lang=` URL is listed as an `hreflang` alternate, and `i18n.js` points the canonical link at it.

CJK headings use `word-break: keep-all`, so they only break at spaces, punctuation and the `<wbr>`s in
their strings. When you change a Chinese or Japanese heading, put a `<wbr>` between its phrases and check
it at 360 px.
