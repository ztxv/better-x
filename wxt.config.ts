import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  modules: [],
  vite: () => ({ plugins: [react()] }),
  manifest: {
    name: 'Saved for X',
    description: 'A private, organized library for posts you save on X.',
    version: '0.1.0',
    minimum_chrome_version: '116',
    // `downloads` saves media through the browser's own downloader. The host permissions are
    // only for the background worker's media checks: X's photo/video CDNs and the public
    // post-metadata endpoint used to find video files. No other site is reachable.
    permissions: ['storage', 'sidePanel', 'downloads'],
    host_permissions: [
      'https://pbs.twimg.com/*',
      'https://video.twimg.com/*',
      'https://cdn.syndication.twimg.com/*',
    ],
    action: { default_title: 'Open Saved for X' },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
