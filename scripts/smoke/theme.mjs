/**
 * Real-Chrome checks of X themes on an X-shaped page: one element per kind of surface the theme
 * paints (inline Lights Out black, React Native Web classes, the translucent sticky bar, borders,
 * dividers, secondary text) and the ones it must leave alone (media, crop selection, Better X's
 * own controls). Settings are written to `chrome.storage.local` as the side panel does.
 * Proves the rules on this markup, not compatibility with live X (see scripts/theme/probe.js).
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { post } from './fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'theme');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

/** An X-shaped dark page. Class names and inline values are the ones `src/themes/surfaces.ts` lists. */
function themePage(mode = 'dark') {
  const black = mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  return `<!doctype html><html data-theme="${mode}"><head><meta charset="utf-8"><title>Home / X</title><link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.3.ico">
  <style>
    .r-kemksi{background-color:rgb(0,0,0)} .r-5zmot{background-color:rgba(0,0,0,0.65)}
    .r-1kqtdi0{border:1px solid rgb(47,51,54)} .r-1igl3o0{border-bottom:1px solid rgb(47,51,54)}
    .r-gu4em3{background-color:rgb(47,51,54);height:1px} .r-1bwzh9t{color:rgb(113,118,123)}
    .r-g2wdr4{background-color:rgb(22,24,28)} .r-1niwhzg{background-color:rgba(0,0,0,0)}
  </style>
  <script>requestAnimationFrame(() => { window.__firstFrame = document.documentElement.getAttribute('data-bx-theme'); });</script>
  </head>
  <body style="margin:0;background-color: ${black};color:rgb(231,233,234);font-family:sans-serif">
    <div id="inline-black" style="background-color: ${black};">inline</div>
    <div id="rnw-bg" class="r-kemksi">class bg</div>
    <div id="sticky" class="r-5zmot">sticky header</div>
    <div id="card" class="r-g2wdr4">raised card</div>
    <div id="bordered" class="r-1kqtdi0">bordered</div>
    <div id="bottom" class="r-1igl3o0">bottom border</div>
    <div id="divider" class="r-gu4em3"></div>
    <span id="muted-inline" style="color: rgb(113, 118, 123);">@handle</span>
    <span id="muted-class" class="r-1bwzh9t">· 2h</span>
    <div id="crop" class="r-1niwhzg r-633pao">crop</div>
    <img id="media" width="20" height="20" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    <video id="clip" width="20" height="20"></video>
    <main style="width:600px">
      ${post({ id: '1300000000000000001', handle: 'themer', text: 'A post on a themed page' })}
      ${post({ id: '1300000000000000002', handle: 'themer', text: 'Another' })}
    </main>
  </body></html>`;
}

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
const pageErrors = [];

const setTheme = (xTheme) =>
  sw.evaluate(async (xTheme) => {
    const { 'bx.settings': current = {} } = await chrome.storage.local.get('bx.settings');
    await chrome.storage.local.set({
      'bx.settings': { ...current, version: 6, xTheme: { ...current.xTheme, ...xTheme } },
    });
  }, xTheme);

async function open(mode = 'dark') {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: themePage(mode) });
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.bx-control').length >= 2, {
    timeout: 15000,
  });
  return page;
}

const wait = (page) => page.evaluate(() => new Promise((r) => setTimeout(r, 80)));
const colors = (page) =>
  page.evaluate(() => {
    const css = (id, prop) => getComputedStyle(document.getElementById(id))[prop];
    return {
      attr: document.documentElement.getAttribute('data-bx-theme'),
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      inline: css('inline-black', 'backgroundColor'),
      rnw: css('rnw-bg', 'backgroundColor'),
      sticky: css('sticky', 'backgroundColor'),
      card: css('card', 'backgroundColor'),
      bordered: css('bordered', 'borderTopColor'),
      bottom: css('bottom', 'borderBottomColor'),
      divider: css('divider', 'backgroundColor'),
      mutedInline: css('muted-inline', 'color'),
      mutedClass: css('muted-class', 'color'),
      crop: css('crop', 'backgroundColor'),
      media: [css('media', 'backgroundColor'), css('media', 'filter'), css('media', 'opacity')],
      clip: [css('clip', 'backgroundColor'), css('clip', 'filter')],
      controls: [...document.querySelectorAll('.bx-control')].filter((c) =>
        c.checkVisibility({ visibilityProperty: true }),
      ).length,
    };
  });

// Dim: bg #15202b, raised #28323d, border #38444d, text #f7f9f9, muted #8b98a5.
const DIM = {
  attr: 'dim',
  html: 'rgb(21, 32, 43)',
  body: 'rgb(21, 32, 43)',
  text: 'rgb(247, 249, 249)',
  inline: 'rgb(21, 32, 43)',
  rnw: 'rgb(21, 32, 43)',
  sticky: 'rgba(21, 32, 43, 0.85)',
  card: 'rgb(40, 50, 61)',
  bordered: 'rgb(56, 68, 77)',
  bottom: 'rgb(56, 68, 77)',
  divider: 'rgb(56, 68, 77)',
  mutedInline: 'rgb(139, 152, 165)',
  mutedClass: 'rgb(139, 152, 165)',
};
const differences = (got, want) =>
  Object.entries(want)
    .filter(([key, value]) => JSON.stringify(got[key]) !== JSON.stringify(value))
    .map(([key, value]) => `${key}: ${got[key]} ≠ ${value}`);

try {
  const page = await open('dark');
  const stock = await colors(page);
  check(
    'no theme: nothing painted, X’s own colors',
    stock.attr === null && stock.inline === 'rgb(0, 0, 0)',
  );

  await setTheme({ active: 'dim' });
  await wait(page);
  const dim = await colors(page);
  const wrong = differences(dim, DIM);
  check(
    'Dim paints every surface kind live, without a reload',
    wrong.length === 0,
    wrong.join('; '),
  );
  check('the crop selection stays see-through', dim.crop === 'rgba(0, 0, 0, 0)', dim.crop);
  check(
    'media is untouched',
    JSON.stringify([dim.media, dim.clip]) === JSON.stringify([stock.media, stock.clip]),
  );
  check(
    'Better X’s save controls still show',
    dim.controls === stock.controls && dim.controls >= 2,
  );

  await setTheme({ active: 'nord' });
  await wait(page);
  const nord = await colors(page);
  check(
    'switching preset updates live',
    nord.attr === 'nord' && nord.inline === 'rgb(46, 52, 64)',
    nord.inline,
  );

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    document.getElementById('inline-black').style.backgroundColor = 'rgb(255, 255, 255)';
  });
  await wait(page);
  const light = await colors(page);
  check(
    'X switched to Default: the theme steps aside entirely',
    light.attr === null &&
      light.body === 'rgb(255, 255, 255)' &&
      light.rnw === stock.rnw &&
      light.bordered === stock.bordered &&
      light.mutedClass === stock.mutedClass,
    JSON.stringify(differences(light, { attr: null, rnw: stock.rnw, bordered: stock.bordered })),
  );
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    document.getElementById('inline-black').style.backgroundColor = 'rgb(0, 0, 0)';
  });
  await wait(page);
  check('back to Lights out: the theme returns', (await colors(page)).attr === 'nord');

  const second = await open('dark');
  await wait(second);
  check('a second tab paints on load', (await colors(second)).attr === 'nord');
  check(
    'the first frame is already themed (cached X mode)',
    (await second.evaluate(() => window.__firstFrame)) === 'nord',
    String(await second.evaluate(() => window.__firstFrame)),
  );
  await setTheme({ active: 'custom', custom: { bg: '#101820' } });
  await Promise.all([wait(page), wait(second)]);
  const [a, b] = [await colors(page), await colors(second)];
  check(
    'both tabs follow a settings change',
    a.inline === 'rgb(16, 24, 32)' && b.inline === 'rgb(16, 24, 32)',
    `${a.inline} / ${b.inline}`,
  );

  await setTheme({ active: null });
  await Promise.all([wait(page), wait(second)]);
  const off = await colors(page);
  const back = differences(off, { ...stock, controls: stock.controls });
  check('theme off: every surface back to X’s own', back.length === 0, back.join('; '));
  check(
    'theme off: the stylesheet is empty',
    (await page.evaluate(() => document.getElementById('bx-theme')?.textContent)) === '',
  );
  // Twitter branding: the tab title and icon (Customize → Appearance).
  const brand = (features) =>
    sw.evaluate(async (features) => {
      const { 'bx.settings': current = {} } = await chrome.storage.local.get('bx.settings');
      await chrome.storage.local.set({ 'bx.settings': { ...current, features } });
    }, features);
  const head = () =>
    page.evaluate(() => ({
      title: document.title,
      icon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? '',
    }));
  await brand({ 'appearance.twitterTitle': true, 'appearance.twitterBird': true });
  await wait(page);
  let tab = await head();
  check(
    'Twitter branding: the tab says Twitter and shows the bird',
    tab.title === 'Home / Twitter' && tab.icon.startsWith('data:image/svg+xml'),
    JSON.stringify({ title: tab.title, icon: tab.icon.slice(0, 30) }),
  );
  await page.evaluate(() => {
    document.title = '(2) Home / X';
    document
      .querySelector('link[rel~="icon"]')
      .setAttribute('href', '//abs.twimg.com/favicons/twitter-pip.3.ico');
  });
  await wait(page);
  tab = await head();
  check(
    '...and follows X when it rewrites them (notification count and dot)',
    tab.title === '(2) Home / Twitter' && decodeURIComponent(tab.icon).includes('circle'),
    tab.title,
  );
  await brand({});
  await wait(page);
  tab = await head();
  check(
    '...and switching off puts X’s own title and icon back',
    tab.title === '(2) Home / X' && tab.icon === '//abs.twimg.com/favicons/twitter-pip.3.ico',
    JSON.stringify(tab),
  );
  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('theme smoke ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} theme checks passed`);
process.exit(failed ? 1 : 0);
