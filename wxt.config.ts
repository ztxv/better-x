import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import { PRODUCT_NAME } from './src/lib/brand';

export default defineConfig({
  modules: [],
  vite: () => ({
    plugins: [react()],
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  }),
  manifest: {
    name: PRODUCT_NAME,
    description: 'Save, organize, and download posts from X in a private, local library.',
    version: '1.3.0',
    minimum_chrome_version: '116',
    // `downloads` saves media through the browser's own downloader. The host permissions are
    // only for the background worker's media checks: X's photo/video CDNs and the public
    // post-metadata endpoint used to find video files. No other site is reachable.
    // `activeTab` (no install warning, no standing access) lets a toolbar click or the shortcut
    // read the clicked tab's URL, so the panel overlay can tell an X tab from any other.
    // `identity` opens Spotify's consent window when the person connects the Spotify plugin
    // (Authorization Code + PKCE; there is no client secret). The Spotify hosts are reached only
    // by that plugin: the token endpoint, the Web API, and cover art (fetched by the worker
    // because X's page may not load images from Spotify's hosts).
    permissions: ['storage', 'sidePanel', 'downloads', 'activeTab', 'identity'],
    host_permissions: [
      'https://pbs.twimg.com/*',
      'https://video.twimg.com/*',
      'https://cdn.syndication.twimg.com/*',
      'https://api.spotify.com/*',
      'https://accounts.spotify.com/*',
      'https://*.scdn.co/*',
      'https://*.spotifycdn.com/*',
      // Only to see a sign-in tab arrive at the Spotify redirect address (the fallback when
      // Chrome's own sign-in window will not open); nothing is fetched from it.
      'https://*.chromiumapp.org/*',
    ],
    action: { default_title: `Open ${PRODUCT_NAME}` },
    // The shortcut does exactly what clicking the toolbar icon does, in every mode.
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+B' } },
    },
    // The panel overlay frames the side panel's page inside x.com, so only X may load it.
    web_accessible_resources: [
      { resources: ['sidepanel.html'], matches: ['https://x.com/*', 'https://twitter.com/*'] },
    ],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
