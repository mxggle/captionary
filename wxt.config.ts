import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Captionary',
    description:
      'Learn languages on YouTube, Netflix and Apple TV+ with dual subtitles, a pop-up dictionary, saved words and AI explanations.',
    permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'sidePanel', 'scripting', 'activeTab'],
    // Fixed hosts the extension needs for its own features. AI provider hosts are
    // NOT listed here: they are requested at runtime, one origin at a time, when the
    // user adds a provider (least privilege).
    host_permissions: [
      'https://www.youtube.com/*',
      'https://www.netflix.com/*',
      'https://*.nflxvideo.net/*',
      'https://*.wiktionary.org/*',
      // End-to-end tests talk to a mock AI server and cannot click Chrome's permission prompt.
      ...(process.env.LR_E2E ? ['http://localhost/*'] : []),
    ],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    action: { default_title: 'Captionary' },
    side_panel: { default_path: 'sidepanel.html' },
    commands: {
      'open-side-panel': {
        suggested_key: { default: 'Alt+L' },
        description: 'Open the AI tutor side panel',
      },
    },
  },
  vite: () => ({
    build: { chunkSizeWarningLimit: 2000 },
  }),
});
