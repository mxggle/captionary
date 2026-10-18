import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
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
    action: { default_title: '__MSG_actionTitle__' },
    side_panel: { default_path: 'sidepanel.html' },
    commands: {
      'open-side-panel': {
        suggested_key: { default: 'Alt+L' },
        description: '__MSG_commandToggleSidepanel__',
      },
    },
  },
  vite: () => ({
    build: { chunkSizeWarningLimit: 2000 },
  }),
});
