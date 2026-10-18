# Captionary site

The landing page: plain HTML, CSS and a small script for the hero demo, with no build step. Deploy the
folder as it is (GitHub Pages, Cloudflare Pages, Netlify, Vercel).

Preview locally:

```bash
python3 -m http.server 4178 --directory site
```

## Before launch

- **Ship ChatGPT sign-in first.** The page sells it in the hero, the AI section, the comparison, the FAQ
  and the privacy page, but the sign-in itself (the `chatgpt` provider) isn't in `main` yet. Don't
  deploy the site until that work has merged, or take the ChatGPT parts out of the page.
- **Store link.** Every "Add to Chrome" button points to
  `https://chromewebstore.google.com/detail/captionary/imcclapmlgkhceckdmnhhcchmgjkcbci` (`data-cta`
  marks them). The item is private until it's published, so the link 404s until then.
- **Domain.** Once there is one, follow the TODO comment in the `<head>` of `index.html`: add
  `<link rel="canonical">` and `og:url`, and change `og:image` from `og.png` to the absolute URL. Most
  link previews ignore a relative image. Then enter the homepage and `privacy.html` URLs in the store
  listing.
- **Privacy policy.** `privacy.html` is linked from both footers and is still a draft. Its text comes from
  the Markdown draft in `docs/chrome-web-store/privacy-policy.md`, which belongs to the Chrome Web Store
  preparation and isn't in `main` yet; until it lands, `privacy.html` is the only copy in the repository.
  Once the policy is approved: replace the `[PUBLISHER TO ADD BEFORE PUBLICATION]` placeholder with the
  support contact, remove the draft notice at the top (an HTML comment marks it), and give the page its
  publication date. Once the Markdown draft is in the repository, edit the two together.

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
