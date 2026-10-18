# Captionary site

The landing page: plain HTML, CSS and a small script for the hero demo, with no build step. Deploy the
folder as it is (GitHub Pages, Cloudflare Pages, Netlify, Vercel).

Preview locally:

```bash
python3 -m http.server 4178 --directory site
```

## Before launch

- **Store link.** Every "Add to Chrome" button points to
  `https://chromewebstore.google.com/detail/captionary/imcclapmlgkhceckdmnhhcchmgjkcbci` (`data-cta`
  marks them). The item is private until it's published, so the link 404s until then.
- **Domain.** Once there is one, add `<link rel="canonical">` and `og:url`, and a 1200 × 630
  `og:image` (a capture of the hero demo works well).
- **Privacy policy.** The Chrome Web Store needs a public URL; `docs/chrome-web-store/privacy-policy.md`
  can become `privacy.html` here once it's approved, with a footer link.

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
