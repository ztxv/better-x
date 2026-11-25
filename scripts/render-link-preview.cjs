// Renders the link-preview card and the app icons from their sources.
//   node scripts/render-link-preview.cjs
// Writes: demo-site/og-image.png (1200x630), demo-site/apple-touch-icon.png (180x180, opaque),
//         demo-site/assets/icon-192.png and icon-512.png (opaque).
// Requires Playwright + Chromium to be installed (not a dependency of this repo).
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const site = path.join(root, 'demo-site');
const logo = fs.readFileSync(path.join(site, 'assets/favicon.svg'), 'utf8');

// Opaque, full-bleed square: black background (the site's), logo at ~64% so it survives
// iOS's rounded-corner mask and Android's adaptive-icon crop.
const iconHtml = (size) => `<body style="margin:0;width:${size}px;height:${size}px;background:#000;display:grid;place-items:center">
  <div style="width:${Math.round(size * 0.64)}px;height:${Math.round(size * 0.64)}px">${logo.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(__dirname, 'og-image.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(site, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });

  for (const [file, size] of [['apple-touch-icon.png', 180], ['assets/icon-192.png', 192], ['assets/icon-512.png', 512]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHtml(size));
    await page.screenshot({ path: path.join(site, file), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
})();
