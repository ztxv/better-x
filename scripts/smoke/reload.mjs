/**
 * Reloads the extension under an open X tab with every customization on, and checks that the
 * orphaned content script takes its work off the page: controls, overlay, stylesheets, markers.
 * What it hid is shown again, and the tab is not pushed anywhere. Runs on the features fixture.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { featuresPage, FEATURE_POSTS } from './fixture.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'reload');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: ['--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 900 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const sw = await worker.worker();
await sw.evaluate(() =>
  chrome.storage.local.set({
    'bx.settings': {
      version: 2,
      features: { 'cleanup.hideAds': true, 'cleanup.hideGrok': true, 'feed.hideForYou': true },
    },
  }),
);
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith('https://x.com/')) return req.continue();
  if (url === 'https://x.com/home')
    return req.respond({ status: 200, contentType: 'text/html', body: featuresPage('light') });
  return req.respond({ status: 204, body: '' });
});
await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
await page.waitForFunction(
  (n) => document.querySelectorAll('.bx-control').length === n,
  {},
  FEATURE_POSTS,
);
await page.waitForFunction(
  () =>
    document.documentElement.hasAttribute('data-bx-hide-for-you') &&
    !!document.getElementById('bx-features'),
  { timeout: 8000 },
);
await page.click('#cell-plain1 .bx-control');
await sleep(400);
const state = () =>
  page.evaluate(() => ({
    controls: document.querySelectorAll('.bx-control').length,
    overlay: !!document.querySelector('#bx-chip, #bx-menu'),
    markers: ['data-bx-route', 'data-bx-layout', 'data-bx-hide-for-you'].filter((a) =>
      document.documentElement.hasAttribute(a),
    ),
    styles: document.querySelectorAll('style#bx-features, style#bx-accent').length,
    promoShown: getComputedStyle(document.getElementById('inner-promo')).display !== 'none',
    grokShown: getComputedStyle(document.getElementById('nav-grok')).display !== 'none',
    forYouShown: getComputedStyle(document.getElementById('tab-foryou')).display !== 'none',
    following: document.getElementById('tab-following-link').getAttribute('aria-selected'),
    path: location.pathname,
  }));
const before = await state();
check(
  'with every customization on, the page is customized and Saved is running',
  before.controls === FEATURE_POSTS &&
    before.overlay &&
    before.styles === 2 &&
    !before.promoShown &&
    !before.grokShown &&
    !before.forYouShown &&
    before.following === 'true',
  JSON.stringify(before),
);
await sw.evaluate(() => chrome.runtime.reload()).catch(() => {});
await sleep(3500);
const after = await state();
check(
  'after the extension reloads, the old script has removed everything it put on the page',
  after.controls === 0 && !after.overlay && after.markers.length === 0 && after.styles === 0,
  JSON.stringify(after),
);
check('...what it hid is shown again', after.promoShown && after.grokShown && after.forYouShown);
check(
  '...and X is left where it was: still on Home, still on Following, no errors',
  after.path === '/home' && after.following === 'true' && errors.length === 0,
  errors.join(' | ').slice(0, 200),
);
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
