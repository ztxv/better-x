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
    permissions: ['storage', 'sidePanel'],
    action: { default_title: 'Open Saved for X' },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
