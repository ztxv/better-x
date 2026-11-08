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
    version: '1.0.5',
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
    action: { default_title: `Open ${PRODUCT_NAME}` },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
