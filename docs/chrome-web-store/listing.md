# Captionary — Chrome Web Store listing draft

Prepared October 18, 2026. The description, Education category, English language, and existing icon have now been saved to the Captionary demo draft in the dashboard. Nothing has been submitted for review or published. Recheck the final build before release.

## Basic information

- Name: Captionary
- Language: English
- Suggested category: Education (choose the closest available category in the dashboard)
- Suggested summary for the final manifest (124 characters):

Learn languages on YouTube, Netflix and Apple TV+ with dual subtitles, a pop-up dictionary, saved words and AI explanations.

The source manifest summary was shortened from 133 to 124 characters for the demo upload to satisfy Google's 132-character limit.

## Detailed description

Turn videos and reading into language practice with Captionary.

Watch YouTube, Netflix and Apple TV+ with the original subtitles and a translation together. Click a word or select a phrase to look it up, save it, and return to the video.

LEARN WHILE WATCHING
• Show two subtitle languages together, with optional romanization for supported scripts.
• Browse and search the subtitle list, jump to a line, or repeat it.
• Pause after each line, adjust playback speed, and use customizable keyboard shortcuts.
• Hide translations until you hover when you want to test your understanding.

UNDERSTAND WORDS IN CONTEXT
• Look up words and phrases with Wiktionary and links to external dictionaries.
• Listen to pronunciation using your browser's available voices.
• Configure an AI provider for vocabulary explanations, sentence breakdowns, and follow-up questions.

BUILD YOUR VOCABULARY
• Save words and phrases with their context and source timestamp.
• Mark vocabulary as learning or known and recognize saved words when they appear again.
• Review flashcards and export vocabulary to CSV, an Anki-compatible text file, or a JSON backup.

READ AND PRACTICE
• Paste text or open TXT, SRT, and VTT files in the reader.
• Send a page to the reader from the extension's toolbar or right-click menu.
• Practice with a local video file and a separate subtitle file.

CHOOSE YOUR AI SETUP
AI features are optional. Sign in with ChatGPT to use your ChatGPT Plus, Pro or Business plan, connect your own supported cloud provider, or use a local Ollama or LM Studio server or Chrome's built-in AI where available. Cloud providers may require an API key and charge for usage. You can choose how much context to share and whether to include a video title in supported explanation requests.

ChatGPT sign-in happens on OpenAI's own page; Captionary never sees your password. It uses the sign-in OpenAI provides for its Codex app, so requests count toward your plan's Codex usage limits. OpenAI hasn't documented this sign-in for other apps, so it may change or stop working; API keys and local models are unaffected. Chrome asks you to allow chatgpt.com, auth.openai.com and, only while you sign in, localhost.

Your settings and saved vocabulary are stored in your browser. Online dictionary requests and configured cloud AI features send the relevant text to those services. See the privacy policy for details.

Captionary works with the web players at youtube.com, netflix.com, and tv.apple.com. Subtitle availability varies by video, language, and platform. Netflix and Apple TV+ may require their own subscriptions. Chrome's built-in AI and translation features depend on browser, hardware, and language support. AI answers can contain mistakes.

Captionary is an independent extension and is not affiliated with or endorsed by YouTube, Netflix, Apple, or OpenAI.

## Links to supply later

- Homepage: leave blank until a Captionary page is publicly available.
- Support URL: https://github.com/mxggle/captionary/issues — the repository is public and has issues enabled (checked October 18, 2026).
- Privacy policy URL: publish the reviewed policy draft in `privacy-policy.md` on an accessible HTTPS page, then enter that actual URL. A local file path is not sufficient.

## Listing images

Prepare real captures of the final extension, with no API keys, private account details, or personal vocabulary visible:

1. Dual subtitles and the subtitle list on a video you are entitled to show.
2. A word or phrase lookup in context.
3. Saved vocabulary and review.
4. Reader with your own sample text.
5. Optional AI settings with empty credential fields, or a sentence explanation.

Google currently specifies at least one screenshot at 1280 × 800 or 640 × 400, a 128 × 128 PNG icon, and a 440 × 280 small promotional image. A 1400 × 560 marquee image is optional. Existing package icons are under `public/icon/`; no store screenshots or promotional images have been created in this preparation pass.

## References

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
