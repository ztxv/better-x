/**
 * Real-Chrome smoke test for the unpacked extension. Serves an X-shaped page at
 * https://x.com/home (request interception; no X account), then saves posts and downloads
 * REAL media from X's CDNs (network required). Files go to .smoke/, never ~/Downloads.
 * Usage: npm run build && node scripts/smoke/run.mjs [extension dir]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { page as fixture, featuresPage, FEATURE_POSTS, ELON } from './fixture.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'results');
const DL = path.join(OUT, 'downloads');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
// Like a real profile: downloads go to the default folder without prompting.
fs.mkdirSync(path.join(OUT, 'profile', 'Default'), { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'profile', 'Default', 'Preferences'),
  JSON.stringify({
    download: { default_directory: DL, prompt_for_download: false, directory_upgrade: true },
    savefile: { default_directory: DL },
  }),
);
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: ['--window-size=1280,900', '--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 900 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const extId = new URL(worker.url()).host;
const sw = await worker.worker();
const swErrors = [];
sw.on('console', (m) => m.type() === 'error' && swErrors.push(m.text()));
console.log('extension', extId);

let theme = 'light';
async function openX({ path = '/home', body = () => fixture(theme), controls = 7 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource|blob:/.test(m.text()) &&
      errors.push(m.text()),
  );
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('https://x.com/')) {
      if (url === `https://x.com${path}`)
        return req.respond({ status: 200, contentType: 'text/html', body: body() });
      return req.respond({ status: 204, body: '' });
    }
    req.continue();
  });
  await page.goto(`https://x.com${path}`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(
    (n) => document.querySelectorAll('.bx-control').length === n,
    { timeout: 15000 },
    controls,
  );
  return { page, errors };
}
const sel = (id) => `article[data-post="${id}"] .bx-control`;
async function clickPost(page, id) {
  await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    if (r.top < 260 || r.bottom > innerHeight - 260) scrollBy(0, r.top - 320);
  }, sel(id));
  await sleep(150);
  await page.click(sel(id));
}
const text = (page, s) =>
  page.$eval(s, (n) => n.innerText.replace(/\s+/g, ' ').trim()).catch(() => null);
const waitText = (page, s, re, timeout = 30000) =>
  page
    .waitForFunction(
      (s, src) => {
        const n = document.querySelector(s);
        return n && new RegExp(src).test(n.innerText);
      },
      { timeout, polling: 100 },
      s,
      re.source,
    )
    .then(() => true)
    .catch(() => false);
const files = () => {
  try {
    return fs.readdirSync(path.join(DL, 'Better-X')).sort();
  } catch {
    return [];
  }
};
const fileInfo = (name) => {
  const p = path.join(DL, 'Better-X', name);
  const head = fs.readFileSync(p).subarray(0, 12);
  return {
    size: fs.statSync(p).size,
    jpeg: head[0] === 0xff && head[1] === 0xd8,
    mp4: head.subarray(4, 8).toString() === 'ftyp',
  };
};
const waitFile = async (name, ms = 60000) => {
  for (let t = 0; t < ms; t += 250) {
    try {
      if (files().includes(name)) return true;
    } catch {}
    await sleep(250);
  }
  return false;
};

const { page, errors } = await openX();
check(
  'one control per top-level post (quote gets none)',
  (await page.$$('.bx-control')).length === 7,
);

// --- text-only post: one click saves, brief Saved confirmation, no Download
const rowBefore = await page.$eval('article[data-post="1100000000000000001"] [role=group]', (n) =>
  n.getBoundingClientRect().toJSON(),
);
await clickPost(page, '1100000000000000001');
await page.waitForSelector('#bx-chip', { timeout: 5000 });
check(
  'text-only save shows "Saved" without Download',
  (await text(page, '#bx-chip')) === 'Saved',
  await text(page, '#bx-chip'),
);
const rowAfter = await page.$eval('article[data-post="1100000000000000001"] [role=group]', (n) =>
  n.getBoundingClientRect().toJSON(),
);
check(
  'chip does not change the action row layout',
  JSON.stringify(rowBefore) === JSON.stringify(rowAfter),
);
check(
  'control shows saved state',
  (await page.$eval(sel('1100000000000000001'), (n) => n.dataset.saved)) === 'true',
);
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/01-text-saved.png` });
await sleep(2200);
check('plain Saved chip dismisses after ~1.6s', !(await page.$('#bx-chip')));

// --- photo: save, chip with Download, single click downloads original
await clickPost(page, '440322224407314432');
await page.waitForSelector('#bx-chip .bx-chip-action', { timeout: 5000 });
check(
  'media save shows "Saved" and "Download"',
  /Saved\s+Download/.test(await text(page, '#bx-chip')),
  await text(page, '#bx-chip'),
);
await page.hover('#bx-chip');
await sleep(3500);
check('hovering the chip pauses dismissal', !!(await page.$('#bx-chip')));
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/02-photo-chip.png` });
await page.click('#bx-chip .bx-chip-action');
check(
  'photo download reports Downloaded',
  await waitText(page, '#bx-chip', /Downloaded/),
  await text(page, '#bx-chip'),
);
const photoName = 'TheEllenShow_440322224407314432_1.jpg';
check(
  'photo file saved at original resolution',
  (await waitFile(photoName)) && fileInfo(photoName).jpeg && fileInfo(photoName).size > 150000,
  JSON.stringify(fs.existsSync(path.join(DL, 'Better-X', photoName)) && fileInfo(photoName)),
);
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/03-photo-downloaded.png` });
await page.keyboard.press('Escape');

// --- GIF: saved as MP4
await clickPost(page, '1100000000000000003');
await page.waitForSelector('#bx-chip .bx-chip-action');
await page.click('#bx-chip .bx-chip-action');
check(
  'GIF download reports Downloaded',
  await waitText(page, '#bx-chip', /Downloaded/),
  await text(page, '#bx-chip'),
);
const gifName = 'gifposter_1100000000000000003_1.mp4';
check(
  'GIF saved as a real MP4',
  (await waitFile(gifName)) && fileInfo(gifName).mp4,
  fs.existsSync(path.join(DL, 'Better-X', gifName)) ? JSON.stringify(fileInfo(gifName)) : 'missing',
);
await page.keyboard.press('Escape');

// --- real video behind a blob: player
await clickPost(page, ELON);
await page.waitForSelector('#bx-chip .bx-chip-action');
await page.click('#bx-chip .bx-chip-action');
check(
  'video download reports Downloaded',
  await waitText(page, '#bx-chip', /Downloaded/, 90000),
  await text(page, '#bx-chip'),
);
const vidName = `elonmusk_${ELON}_1.mp4`;
check(
  'video saved as an MP4 file (not the poster)',
  (await waitFile(vidName, 90000)) && fileInfo(vidName).mp4 && fileInfo(vidName).size > 1_000_000,
  fs.existsSync(path.join(DL, 'Better-X', vidName)) ? JSON.stringify(fileInfo(vidName)) : 'missing',
);
await page.keyboard.press('Escape');

// --- two photos, one missing: chooser, Download all, partial result
await clickPost(page, '1100000000000000005');
await page.waitForSelector('#bx-chip .bx-chip-action');
await page.click('#bx-chip .bx-chip-action');
await page.waitForSelector('#bx-menu .bx-choice', { timeout: 5000 });
const choices = await page.$$eval('#bx-menu .bx-choice', (ns) => ns.map((n) => n.innerText.trim()));
check(
  'multi-media opens chooser with previews',
  choices.join('|') === 'Image 1|Image 2' && (await page.$$('#bx-menu .bx-thumb img')).length >= 1,
  choices.join('|'),
);
await page.screenshot({ path: `${OUT}/04-chooser.png` });
const allLabel = await text(page, '#bx-menu .bx-primary');
check('chooser offers "Download all (2)"', allLabel === 'Download all (2)', allLabel);
await page.click('#bx-menu .bx-primary');
check(
  'partial batch reports 1 of 2 and why',
  await waitText(page, '#bx-menu .bx-status', /1 of 2 downloaded/),
  await text(page, '#bx-menu .bx-status'),
);
check(
  'unavailable item offers Open post on X',
  !!(await page.$('#bx-menu .bx-status a[href="https://x.com/batch/status/1100000000000000005"]')),
);
await page.screenshot({ path: `${OUT}/05-partial.png` });
await page.keyboard.press('Escape');

// --- parent photo quoting a video: quoted media only when chosen
const before = files().length;
await clickPost(page, '1100000000000000006');
await page.waitForSelector('#bx-chip .bx-chip-action');
await page.click('#bx-chip .bx-chip-action');
await page.waitForSelector('#bx-menu .bx-choice');
const quoteChoices = await page.$$eval('#bx-menu .bx-choice', (ns) =>
  ns.map((n) => n.innerText.trim()),
);
check(
  'quoted media is labelled and separate',
  quoteChoices.join('|') === 'Image|Quoted video' &&
    /From the quoted post/.test(await text(page, '#bx-menu')),
  quoteChoices.join('|'),
);
await sleep(500);
check('nothing downloads until a choice is made', files().length === before);
await page.click('#bx-menu .bx-choice:nth-of-type(2), #bx-menu .bx-choices > button:last-child');
check(
  'quoted video downloads from the quoted post',
  await waitText(page, '#bx-menu .bx-status', /Downloaded/, 90000),
  await text(page, '#bx-menu .bx-status'),
);
const qName = `elonmusk_${ELON}_1 (1).mp4`;
check(
  'quoted video file named for the quoted post (uniquified)',
  await waitFile(qName, 90000),
  files().join(', '),
);
check('parent image was not downloaded silently', !files().some((f) => f.startsWith('quoter_')));
await page.keyboard.press('Escape');

// --- blob-only video X cannot describe
await clickPost(page, '1999999999999999997');
await page.waitForSelector('#bx-chip .bx-chip-action');
await page.click('#bx-chip .bx-chip-action');
check(
  'unresolvable video says "Video unavailable to download"',
  await waitText(page, '#bx-chip', /Video unavailable to download/),
  await text(page, '#bx-chip'),
);
check(
  '…and offers Open post on X',
  !!(await page.$('#bx-chip a[href="https://x.com/ghost/status/1999999999999999997"]')),
);
check('no poster or partial file was saved for it', !files().some((f) => f.startsWith('ghost_')));
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/06-unavailable.png` });
await page.keyboard.press('Escape');

// --- saved-post menu: order, keyboard, focus, Escape
await clickPost(page, '440322224407314432');
await page.waitForSelector('#bx-menu');
const items = await page.$$eval('#bx-menu .bx-item', (ns) => ns.map((n) => n.innerText.trim()));
check(
  'saved menu: Download image / Open bookmark library / Remove bookmark',
  items.join('|') === 'Download image|Open bookmark library|Remove bookmark',
  items.join('|'),
);
check(
  'trigger reports aria-expanded',
  (await page.$eval(sel('440322224407314432'), (n) => n.getAttribute('aria-expanded'))) === 'true',
);
check(
  'focus moves into the menu',
  await page.evaluate(() => document.activeElement?.closest('#bx-menu') !== null),
);
await page.keyboard.press('ArrowDown');
check(
  'ArrowDown moves to the next action',
  /Open bookmark library/.test(await page.evaluate(() => document.activeElement.innerText)),
);
await page.screenshot({ path: `${OUT}/07-menu.png` });
await page.keyboard.press('Escape');
check(
  'Escape closes the menu and returns focus to the control',
  !(await page.$('#bx-menu')) &&
    (await page.evaluate(() => document.activeElement?.classList.contains('bx-control'))),
);
const box = await page.$eval(sel('440322224407314432'), (n) => n.getBoundingClientRect().toJSON());
await clickPost(page, '440322224407314432');
await page.waitForSelector('#bx-menu');
const mbox = await page.$eval('#bx-menu', (n) => n.getBoundingClientRect().toJSON());
check(
  'menu fits in the viewport',
  mbox.left >= 8 && mbox.right <= 1272 && mbox.top >= 8 && mbox.bottom <= 892,
  JSON.stringify(mbox),
);
await page.evaluate(() => scrollBy(0, 40));
await sleep(150);
const mbox2 = await page
  .$eval('#bx-menu', (n) => n.getBoundingClientRect().toJSON())
  .catch(() => null);
check(
  'menu follows its control on scroll',
  mbox2 && Math.abs(mbox2.top - (mbox.top - 40)) <= 3,
  JSON.stringify({ before: mbox.top, after: mbox2?.top }),
);
await page.evaluate(() => scrollTo(0, 2000));
await sleep(200);
check('menu closes when its control scrolls away', !(await page.$('#bx-menu')));
await page.evaluate(() => scrollTo(0, 0));
await sleep(100);

// --- viewport edge: menu flips above when there is no room below
await page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  scrollBy(0, r.bottom - innerHeight + 12);
}, sel('1999999999999999997'));
await sleep(200);
await page.click(sel('1999999999999999997'));
await page.waitForSelector('#bx-menu');
await sleep(200);
const flip = await page.$eval('#bx-menu', (n) => ({
  side: n.dataset.side,
  bottom: n.getBoundingClientRect().bottom,
}));
check(
  'menu flips above near the bottom edge',
  flip.side === 'above' && flip.bottom <= 892,
  JSON.stringify(flip),
);
await page.keyboard.press('Escape');
await page.evaluate(() => scrollTo(0, 0));

// --- live settings from another context
const panel = await browser.newPage();
await panel.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle0' });
await panel.evaluate(() =>
  chrome.storage.local.set({
    'bx.settings': {
      version: 1,
      theme: 'auto',
      accent: 'pink',
      downloadsEnabled: true,
      afterSave: 'quiet',
      menuActions: { download: false, openLibrary: false },
      saveAs: false,
    },
  }),
);
await sleep(300);
await page.bringToFront();
const accent = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--bx-accent').trim(),
);
check('accent change reaches the open X tab live', accent === '#f91880', accent);
await clickPost(page, '440322224407314432');
await page.waitForSelector('#bx-menu');
const items2 = await page.$$eval('#bx-menu .bx-item', (ns) => ns.map((n) => n.innerText.trim()));
check(
  'hidden menu actions leave Remove bookmark',
  items2.join('|') === 'Remove bookmark',
  items2.join('|'),
);
await page.keyboard.press('Escape');
await clickPost(page, '1100000000000000006');
await sleep(400);
// Post 6 is saved: click opened menu. Use an unsaved post for the quiet check: remove + resave text post.
await page.keyboard.press('Escape');
await clickPost(page, '1100000000000000001'); // saved → menu
await page.waitForSelector('#bx-menu');
await page.click('#bx-menu .bx-danger');
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'false',
  {},
  sel('1100000000000000001'),
);
check(
  'Remove bookmark from the page works and restores focus',
  await page.evaluate(() => document.activeElement?.classList.contains('bx-control')),
);
await clickPost(page, '1100000000000000001');
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'true',
  {},
  sel('1100000000000000001'),
);
await sleep(300);
check('quiet setting: saving shows no chip', !(await page.$('#bx-chip')));
await panel.evaluate(() =>
  chrome.storage.local.set({
    'bx.settings': {
      version: 1,
      theme: 'auto',
      accent: 'blue',
      downloadsEnabled: false,
      afterSave: 'downloadOffer',
      menuActions: { download: true, openLibrary: true },
      saveAs: false,
    },
  }),
);
await sleep(300);
await clickPost(page, '1100000000000000001'); // menu
await page.waitForSelector('#bx-menu');
check(
  'downloads off: no Download in menu',
  (await page.$$eval('#bx-menu .bx-item', (ns) => ns.map((n) => n.innerText.trim()))).join('|') ===
    'Open bookmark library|Remove bookmark',
);
await page.keyboard.press('Escape');
await panel.evaluate(() => chrome.storage.local.remove('bx.settings'));

// --- side panel library
await panel.bringToFront();
await panel.setViewport({ width: 400, height: 900 });
await panel.reload({ waitUntil: 'networkidle0' });
await sleep(500);
const navText = await text(panel, '.library-nav');
check(
  'library has a built-in Downloaded entry with completed posts',
  /Downloaded 5/.test(navText),
  navText,
);
await panel.screenshot({
  captureBeyondViewport: false,
  path: `${OUT}/08-panel-all.png`,
  fullPage: false,
});
const chips = await panel.$$eval('.download-chip', (ns) => ns.map((n) => n.innerText.trim()));
check(
  'cards show download badges incl. partial',
  chips.includes('Downloaded') && chips.includes('1 of 2 downloaded'),
  chips.join(' | '),
);
await panel.click('.nav-downloaded');
await sleep(200);
const dlHead = await text(panel, '.list-head');
check('Downloaded view lists 5 posts', /Downloaded 5 posts/.test(dlHead), dlHead);
await panel.screenshot({ path: `${OUT}/09-panel-downloaded.png` });
// Create a normal collection named Downloaded and move the photo into it: independent of the smart view.
await panel.evaluate(async () => {
  const send = (m) => chrome.runtime.sendMessage(m);
  const c = await send({ type: 'createCollection', name: 'Downloaded' });
  await send({ type: 'update', id: '440322224407314432', patch: { collectionId: c.data.id } });
  await send({ type: 'delete', id: '1100000000000000003' });
});
await sleep(400);
const cardTexts = await panel.$$eval('.bookmark-item', (ns) =>
  ns.map((n) => n.innerText.replace(/\s+/g, ' ')),
);
const photoCard = cardTexts.find((t) => /Real photo/.test(t)) ?? '';
check(
  'photo card shows both its user collection and its download badge',
  /Downloaded.*Downloaded|Downloaded/.test(photoCard) &&
    (await panel.$$eval('.bookmark-item .chip', (ns) =>
      ns.some(
        (n) =>
          n.innerText.trim() === 'Downloaded' &&
          n.querySelector('svg') &&
          !n.classList.contains('download-chip'),
      ),
    )),
  photoCard.slice(0, 140),
);
check(
  'removed bookmark stays in Downloaded, marked Not in bookmarks',
  cardTexts.some((t) => /Real GIF/.test(t) && /Not in bookmarks/.test(t)),
);
const allCount = await panel.evaluate(
  async () => (await chrome.runtime.sendMessage({ type: 'list' })).data.bookmarks.length,
);
check(
  'removed bookmark is not silently restored to All Bookmarks',
  allCount === 6,
  String(allCount),
);
await panel.screenshot({ path: `${OUT}/10-panel-removed.png` });
// Open the download dialog for the partial batch.
await panel.click('.nav-all');
await sleep(200);
const idx = (await panel.$$eval('.bookmark-item', (ns) => ns.map((n) => n.innerText))).findIndex(
  (t) => /Two photos/.test(t),
);
const card = (await panel.$$('.bookmark-item'))[idx];
await (await card.$('button[aria-label="More actions"]')).click();
const menuItems = await card.$$eval('.item-menu button', (ns) => ns.map((n) => n.innerText.trim()));
check(
  'library overflow menu offers Download media…',
  menuItems[0] === 'Download media…',
  menuItems.join('|'),
);
await (await card.$('.item-menu button')).click();
await panel.waitForSelector('.download-dialog');
await sleep(600);
const dialog = await text(panel, '.download-dialog');
check(
  'dialog shows per-item state, file presence, and Download remaining',
  /File available locally/.test(dialog) &&
    /unavailable to download/.test(dialog) &&
    /Removing a bookmark never deletes/.test(dialog),
  dialog,
);
await panel.screenshot({ path: `${OUT}/11-panel-dialog.png` });
await panel.keyboard.press('Escape');
// Settings sheet.
await panel.click('.settings-button');
await panel.waitForSelector('.settings-sheet');
await panel.click('.swatch[aria-label="Green"]');
await sleep(200);
const brand = await panel.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
);
check('accent swatch applies to the library', brand === '#00ba7c', brand);
await panel.screenshot({
  captureBeyondViewport: false,
  path: `${OUT}/12-settings.png`,
  fullPage: true,
});
await panel.click('.reset-button');
await sleep(300);
check(
  'reset restores default accent without touching data',
  (await panel.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
  )) === '#1d9bf0' &&
    (await panel.evaluate(
      async () => (await chrome.runtime.sendMessage({ type: 'list' })).data.bookmarks.length,
    )) === 6,
);
await panel.keyboard.press('Escape');
// Clear download history keeps bookmarks and files.
const fileCount = files().length;
await panel.evaluate(() => chrome.runtime.sendMessage({ type: 'clearDownloads' }));
await sleep(300);
const after = await panel.evaluate(async () => ({
  b: (await chrome.runtime.sendMessage({ type: 'list' })).data.bookmarks.length,
  d: (await chrome.runtime.sendMessage({ type: 'downloads' })).data.length,
}));
check(
  'clearing history keeps bookmarks and files',
  after.b === 6 && after.d === 0 && files().length === fileCount,
  JSON.stringify({ ...after, files: files().length }),
);

// --- keyboard-only: save with Enter, Tab into the chip, download with Enter
await page.bringToFront();
await panel.evaluate(() =>
  chrome.runtime.sendMessage({ type: 'delete', id: '440322224407314432' }),
);
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'false',
  {},
  sel('440322224407314432'),
);
await page.evaluate((s) => {
  const n = document.querySelector(s);
  n.scrollIntoView({ block: 'center' });
  n.focus();
}, sel('440322224407314432'));
await page.keyboard.press('Enter');
await page.waitForSelector('#bx-chip .bx-chip-action');
await sleep(3500);
check('keyboard save keeps the offer up longer than 3s', !!(await page.$('#bx-chip')));
// The save must leave focus on the control (Chrome blurs a focused control that is disabled).
const focusedBeforeTab = await page.evaluate(
  () => document.activeElement?.className || document.activeElement?.tagName,
);
await page.keyboard.press('Tab');
check(
  'Tab from the control enters the chip',
  await page.evaluate(() => document.activeElement?.classList.contains('bx-chip-action')),
  `focus before Tab: ${focusedBeforeTab}`,
);
await page.keyboard.down('Shift');
await page.keyboard.press('Tab');
await page.keyboard.up('Shift');
check(
  'Shift+Tab returns to the control',
  await page.evaluate(() => document.activeElement?.classList.contains('bx-control')),
);
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
check(
  'keyboard download completes',
  await waitText(page, '#bx-chip', /Downloaded/),
  await text(page, '#bx-chip'),
);
await sleep(3500);
check('focused chip is not removed from under the keyboard', !!(await page.$('#bx-chip')));
await page.keyboard.press('Escape');
check(
  'Escape returns focus to the control',
  !(await page.$('#bx-chip')) &&
    (await page.evaluate(() => document.activeElement?.classList.contains('bx-control'))),
);

// --- recycled article (virtualized list reuses the element for another post)
await clickPost(page, '1100000000000000006');
await page.waitForSelector('#bx-menu');
await page.evaluate(() => {
  const a = document.querySelector(
    'article[data-post="1100000000000000006"] > a[href*="/status/"]',
  );
  a.href = 'https://x.com/someoneelse/status/1100000000000000099';
});
await sleep(300);
check('overlay closes when its post element is reused', !(await page.$('#bx-menu')));
check(
  'reused control shows the new post as unsaved',
  (await page.$eval(
    'article[data-post="1100000000000000006"] .bx-control',
    (n) => n.dataset.saved,
  )) === 'false',
);

// --- X-like routes and layout: the runtime follows SPA navigation and live layout changes
// The extension mirrors the runtime's state on <html>: data-bx-route, data-bx-layout.
const runtimeAttr = (p, name) => p.evaluate((n) => document.documentElement.getAttribute(n), name);
const waitAttr = (p, name, value) =>
  p
    .waitForFunction(
      (n, v) => document.documentElement.getAttribute(n) === v,
      { timeout: 5000 },
      name,
      value,
    )
    .then(() => true)
    .catch(() => false);
// What X does: pushState with no reload, no popstate, and often no DOM or title change at all.
const spaTo = (p, url) => p.evaluate((u) => history.pushState({}, '', u), url);
await page.bringToFront();
await page.evaluate(() => scrollTo(0, 0));
check(
  'runtime starts on the page it was injected into',
  (await runtimeAttr(page, 'data-bx-route')) === 'home' &&
    (await runtimeAttr(page, 'data-bx-layout')) === 'wide',
  `${await runtimeAttr(page, 'data-bx-route')} / ${await runtimeAttr(page, 'data-bx-layout')}`,
);
await spaTo(page, '/elonmusk');
check('pushState to a profile is a route change', await waitAttr(page, 'data-bx-route', 'profile'));
await spaTo(page, '/elonmusk/status/1585341984679469056');
check('pushState to a post is a route change', await waitAttr(page, 'data-bx-route', 'post'));
await page.evaluate(() =>
  history.replaceState({}, '', '/elonmusk/status/1585341984679469056?s=20'),
);
await spaTo(page, '/compose/post');
check('a modal route is reported as the route', await waitAttr(page, 'data-bx-route', 'compose'));
await page.goBack();
check('back out of the modal is recognized', await waitAttr(page, 'data-bx-route', 'post'));
await page.goBack();
check('back is recognized', await waitAttr(page, 'data-bx-route', 'profile'));
await page.goForward();
check('forward is recognized', await waitAttr(page, 'data-bx-route', 'post'));
// Saving keeps working after navigating without a reload.
await panel.evaluate(() =>
  chrome.runtime.sendMessage({ type: 'delete', id: '1100000000000000001' }),
);
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'false',
  {},
  sel('1100000000000000001'),
);
await spaTo(page, '/explore');
await waitAttr(page, 'data-bx-route', 'explore');
await clickPost(page, '1100000000000000001');
check(
  'saving still works after SPA navigation',
  await waitText(page, '#bx-chip', /Saved/),
  await text(page, '#bx-chip'),
);
check(
  '...and the control shows it saved',
  (await page.$eval(sel('1100000000000000001'), (n) => n.dataset.saved)) === 'true',
);
await page.keyboard.press('Escape');
// A narrow window (the browser side panel) makes X switch layout without a route change.
const routeBeforeResize = await runtimeAttr(page, 'data-bx-route');
await page.setViewport({ width: 420, height: 900 });
check(
  'narrowing the window is detected as the narrow layout',
  await waitAttr(page, 'data-bx-layout', 'narrow'),
);
check('...with no route change', (await runtimeAttr(page, 'data-bx-route')) === routeBeforeResize);
await page.setViewport({ width: 1280, height: 900 });
check('widening it again is detected', await waitAttr(page, 'data-bx-layout', 'wide'));
// X replacing the app wrapper must not blind the layout service.
await page.evaluate(() => {
  const old = document.getElementById('bx-app');
  const fresh = old.cloneNode(true);
  fresh.className = 'app-narrow';
  old.replaceWith(fresh);
});
check('a replaced app wrapper is followed', await waitAttr(page, 'data-bx-layout', 'narrow'));
await page.evaluate(() => (document.getElementById('bx-app').className = 'app-wide'));
check('...and its later changes', await waitAttr(page, 'data-bx-layout', 'wide'));

// --- customization: Hide Ads / Hide Grok / Hide For You, driven through the real Customize view
// Real-Chrome checks of the rules on X-shaped markup. The fixture is not X: these show the rules
// behave as designed on that markup, not that they match the live site.
const features = await openX({
  path: '/home?fixture=features',
  body: () => featuresPage(theme),
  controls: FEATURE_POSTS,
});
const fx = features.page;
const shown = (p, s) => p.$eval(s, (n) => getComputedStyle(n).display !== 'none').catch(() => null);
const waitShown = (p, s, want, timeout = 5000) =>
  p
    .waitForFunction(
      (s, want) => {
        const n = document.querySelector(s);
        return !!n && (getComputedStyle(n).display !== 'none') === want;
      },
      { timeout },
      s,
      want,
    )
    .then(() => true)
    .catch(() => false);
/** Finds a Customize setting the way a user does, by searching for it. */
async function findSetting(title) {
  await panel.bringToFront();
  await panel.click('#customize-tab');
  await panel.waitForSelector('.customize input[type="search"]');
  const box = await panel.$('.customize input[type="search"]');
  await box.focus();
  await panel.keyboard.press('Escape'); // clears whatever was searched for before
  await box.type(title);
  await panel.waitForFunction(
    (t) =>
      [...document.querySelectorAll('.customize .setting-toggle strong')].some(
        (n) => n.textContent === t,
      ),
    {},
    title,
  );
  // The group opens with a 200 ms height transition; a click lands only once it has finished.
  await sleep(320);
}
/** Flips a Customize switch by its label, the way a user would, and waits for it to read back. */
async function toggleFeature(title, on) {
  await findSetting(title);
  const input = async () =>
    (
      await panel.evaluateHandle(
        (t) =>
          [...document.querySelectorAll('.customize .setting-toggle')]
            .find((l) => l.querySelector('strong').textContent === t)
            ?.querySelector('input'),
        title,
      )
    ).asElement();
  if ((await (await input()).evaluate((i) => i.checked)) !== on) await (await input()).click();
  await panel.waitForFunction(
    (t, v) =>
      [...document.querySelectorAll('.customize .setting-toggle')]
        .find((l) => l.querySelector('strong').textContent === t)
        ?.querySelector('input').checked === v,
    {},
    title,
    on,
  );
  await fx.bringToFront();
}
const styleCount = () => fx.$$eval('style#bx-features', (n) => n.length);
const controlCount = () => fx.$$eval('.bx-control', (n) => n.length);

check(
  'customization is off by default: nothing is hidden',
  (await shown(fx, '#inner-promo')) === true &&
    (await shown(fx, '#trend-promo')) === true &&
    (await shown(fx, '#menu-ads')) === true &&
    (await styleCount()) === 0,
);
await toggleFeature('Hide Ads', true);
check(
  'Hide Ads hides the promoted post on the open tab',
  await waitShown(fx, '#inner-promo', false),
);
check(
  '...and leaves ordinary posts visible',
  (await shown(fx, '#inner-plain1')) === true &&
    (await shown(fx, '#inner-plain2')) === true &&
    (await shown(fx, '#inner-mention')) === true,
);
check(
  '...and does not hide the timeline cell X positions',
  (await shown(fx, '#cell-promo')) === true,
);
check(
  '...a tracked block that is not a post stays visible',
  (await shown(fx, '#inner-nopost')) === true,
);
check(
  '...the newer markup shape (no test IDs) is untouched',
  (await shown(fx, '#tailwind-post')) === true,
);
check(
  'Hide Ads hides the promoted trend and the Ads menu link, not their neighbours',
  (await shown(fx, '#trend-promo')) === false &&
    (await shown(fx, '#trend-plain')) === true &&
    (await shown(fx, '#menu-ads')) === false &&
    (await shown(fx, '#menu-settings')) === true,
);
check(
  'the Ads link in the narrow layout’s dialog is only hidden in that layout',
  (await shown(fx, '#sheet-ads')) === true,
);
await fx.setViewport({ width: 420, height: 900 });
check('...narrow: hidden', await waitShown(fx, '#sheet-ads', false));
check('...and its other links stay', (await shown(fx, '#sheet-settings')) === true);
await fx.setViewport({ width: 1280, height: 900 });
check('...wide again: visible', await waitShown(fx, '#sheet-ads', true));
// Saving keeps working with a customization on.
await fx.evaluate(() => document.querySelector('#cell-plain1 .bx-control').click());
check(
  'saving works with Hide Ads on',
  await waitText(fx, '#bx-chip', /Saved/),
  await text(fx, '#bx-chip'),
);
await fx.keyboard.press('Escape');
await toggleFeature('Hide Ads', false);
check(
  'switching Hide Ads off restores the post, trend and menu link',
  (await waitShown(fx, '#inner-promo', true)) &&
    (await shown(fx, '#trend-promo')) === true &&
    (await shown(fx, '#menu-ads')) === true &&
    (await styleCount()) === 0,
);
for (let i = 0; i < 3; i++) {
  await toggleFeature('Hide Ads', true);
  await waitShown(fx, '#inner-promo', false);
  await toggleFeature('Hide Ads', false);
  await waitShown(fx, '#inner-promo', true);
}
await toggleFeature('Hide Ads', true);
check(
  'repeated toggling leaves one stylesheet and no duplicate controls',
  (await styleCount()) === 1 && (await controlCount()) === FEATURE_POSTS,
  `${await styleCount()} styles, ${await controlCount()} controls`,
);
await panel.bringToFront();
await panel.reload({ waitUntil: 'networkidle0' });
await panel.click('#customize-tab');
check(
  'the setting persists across reopening the panel',
  await panel.evaluate(
    () =>
      [...document.querySelectorAll('.customize .setting-toggle')]
        .find((l) => l.querySelector('strong').textContent === 'Hide Ads')
        ?.querySelector('input').checked,
  ),
);
check(
  'the Library is still reachable and working after using Customize',
  await (async () => {
    await panel.click('#library-tab');
    await panel.waitForSelector('.nav-all', { visible: true });
    return (await panel.$$('.bookmark-item')).length > 0;
  })(),
);
await toggleFeature('Hide Ads', false);

// Hide Grok
const GROK_SURFACES = [
  '#nav-grok',
  '#menu-grok',
  '#grok-drawer',
  '#followups',
  '#followups-nav',
  '#ask-grok',
  '#grok-actions',
  '#grok-promo',
];
const allShown = async (selectors, want) => {
  for (const s of selectors) if ((await shown(fx, s)) !== want) return false;
  return true;
};
check('Hide Grok is off by default', await allShown(GROK_SURFACES, true));
await toggleFeature('Hide Grok', true);
check(
  'Hide Grok hides the Grok nav entry, menu entry, drawer and promo on the open tab',
  (await waitShown(fx, '#nav-grok', false)) &&
    (await shown(fx, '#menu-grok')) === false &&
    (await shown(fx, '#grok-drawer')) === false &&
    (await shown(fx, '#grok-promo')) === false,
);
check(
  '...and the post-level prompts, Ask Grok and Grok actions',
  (await shown(fx, '#followups')) === false &&
    (await shown(fx, '#followups-nav')) === false &&
    (await shown(fx, '#ask-grok')) === false &&
    (await shown(fx, '#grok-actions')) === false,
);
check(
  '...but not other navigation, other sidebar cards, or any post (including ones about Grok)',
  await allShown(
    [
      '#nav-home',
      '#menu-settings',
      '#other-promo',
      '#inner-mention',
      '#inner-grokpost',
      '#inner-plain1',
    ],
    true,
  ),
);
check('Hide Grok leaves ads alone', (await shown(fx, '#inner-promo')) === true);
check(
  'the narrow dialog’s Grok entry is only hidden in that layout',
  (await shown(fx, '#sheet-grok')) === true,
);
await fx.setViewport({ width: 420, height: 900 });
check('...narrow: hidden', await waitShown(fx, '#sheet-grok', false));
check('...and Grok stays hidden there', (await shown(fx, '#nav-grok')) === false);
await fx.setViewport({ width: 1280, height: 900 });
check('...wide again: visible', await waitShown(fx, '#sheet-grok', true));
await fx.evaluate(() => document.querySelector('#cell-plain2 .bx-control').click());
check(
  'saving works with Hide Grok on',
  await waitText(fx, '#bx-chip', /Saved/),
  await text(fx, '#bx-chip'),
);
await fx.keyboard.press('Escape');
await toggleFeature('Hide Ads', true);
check(
  'Hide Ads and Hide Grok work together',
  (await waitShown(fx, '#inner-promo', false)) && (await shown(fx, '#nav-grok')) === false,
);
await toggleFeature('Hide Grok', false);
check(
  'switching Hide Grok off restores Grok and leaves Hide Ads on',
  (await waitShown(fx, '#nav-grok', true)) &&
    (await allShown(GROK_SURFACES, true)) &&
    (await shown(fx, '#inner-promo')) === false,
);
await toggleFeature('Hide Ads', false);
for (let i = 0; i < 3; i++) {
  await toggleFeature('Hide Grok', true);
  await toggleFeature('Hide Grok', false);
}
check(
  'repeated Hide Grok toggling leaves nothing behind',
  (await styleCount()) === 0 &&
    (await controlCount()) === FEATURE_POSTS &&
    (await allShown(GROK_SURFACES, true)),
);

// Hide For You
const tabClicks = () => fx.evaluate(() => window.__tabClicks.slice());
const tabState = () =>
  fx.evaluate(() => ({
    forYou: document.getElementById('tab-foryou-link').getAttribute('aria-selected'),
    following: document.getElementById('tab-following-link').getAttribute('aria-selected'),
    forYouShown: getComputedStyle(document.getElementById('tab-foryou')).display !== 'none',
    followingShown: getComputedStyle(document.getElementById('tab-following')).display !== 'none',
  }));
const spaTo2 = (p, url) => p.evaluate((u) => history.pushState({}, '', u), url);
const sameState = async (want) => {
  const s = await tabState();
  return Object.entries(want).every(([k, v]) => s[k] === v);
};
check(
  'Hide For You is off by default: For you is selected and visible',
  await sameState({ forYou: 'true', forYouShown: true }),
);
await toggleFeature('Hide For You', true);
check(
  'Hide For You selects Following and hides the For you tab on the open tab',
  await fx
    .waitForFunction(
      () =>
        document.getElementById('tab-following-link').getAttribute('aria-selected') === 'true' &&
        getComputedStyle(document.getElementById('tab-foryou')).display === 'none',
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false),
  JSON.stringify(await tabState()),
);
check(
  '...with a single click on Following, and Following still visible',
  JSON.stringify(await tabClicks()) === JSON.stringify(['tab-following-link']) &&
    (await sameState({ followingShown: true })),
);
await sleep(600);
check(
  'it does not keep clicking',
  JSON.stringify(await tabClicks()) === JSON.stringify(['tab-following-link']),
);
// Leaving Home stops the effect; other pages' tabs are untouched.
await spaTo2(fx, '/elonmusk');
check(
  'off Home the For you tab is shown again and nothing is clicked',
  (await fx
    .waitForFunction(
      () => getComputedStyle(document.getElementById('tab-foryou')).display !== 'none',
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false)) && (await tabClicks()).length === 1,
);
// X puts For you back when Home is opened again; Better X corrects it once.
await fx.evaluate(() => {
  document.getElementById('tab-foryou-link').setAttribute('aria-selected', 'true');
  document.getElementById('tab-following-link').setAttribute('aria-selected', 'false');
});
await spaTo2(fx, '/home');
check(
  'returning to Home selects Following again and hides For you',
  await fx
    .waitForFunction(
      () =>
        document.getElementById('tab-following-link').getAttribute('aria-selected') === 'true' &&
        getComputedStyle(document.getElementById('tab-foryou')).display === 'none',
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false),
);
check('...with exactly one more click', (await tabClicks()).length === 2);
// A modal over Home does not flicker the tab or trigger anything.
await spaTo2(fx, '/compose/post');
await sleep(300);
check(
  'opening the composer over Home changes nothing',
  (await sameState({ forYouShown: false })) && (await tabClicks()).length === 2,
);
await spaTo2(fx, '/home');
await sleep(300);
// Saving keeps working.
await fx.evaluate(() => document.querySelector('#cell-mention .bx-control').click());
check(
  'saving works with Hide For You on',
  await waitText(fx, '#bx-chip', /Saved/),
  await text(fx, '#bx-chip'),
);
await fx.keyboard.press('Escape');
// Switching off restores X's tabs and does not navigate.
const clicksBeforeOff = (await tabClicks()).length;
await toggleFeature('Hide For You', false);
check(
  'switching Hide For You off shows the For you tab again',
  await fx
    .waitForFunction(
      () => getComputedStyle(document.getElementById('tab-foryou')).display !== 'none',
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false),
);
check(
  '...and does not click, navigate away, or force Following afterwards',
  (await tabClicks()).length === clicksBeforeOff &&
    (await fx.evaluate(() => location.pathname)) === '/home' &&
    (await sameState({ following: 'true' })),
);
await fx.evaluate(() => {
  document.getElementById('tab-foryou-link').setAttribute('aria-selected', 'true');
  document.getElementById('tab-following-link').setAttribute('aria-selected', 'false');
});
await spaTo2(fx, '/explore');
await spaTo2(fx, '/home');
await sleep(400);
check(
  '...the user can sit on For you without being pushed off it',
  (await tabClicks()).length === clicksBeforeOff && (await sameState({ forYou: 'true' })),
);
// Independent of the other two, and repeated toggling leaves nothing behind.
await toggleFeature('Hide Ads', true);
await toggleFeature('Hide For You', true);
check(
  'all three features work together',
  (await waitShown(fx, '#inner-promo', false)) &&
    (await fx
      .waitForFunction(
        () => getComputedStyle(document.getElementById('tab-foryou')).display === 'none',
        { timeout: 5000 },
      )
      .then(() => true)
      .catch(() => false)),
);
await toggleFeature('Hide Grok', true);
await toggleFeature('Hide Grok', false);
await toggleFeature('Hide Ads', false);
for (let i = 0; i < 3; i++) {
  await toggleFeature('Hide For You', false);
  await toggleFeature('Hide For You', true);
}
await toggleFeature('Hide For You', false);
check(
  'repeated toggling leaves no markers, styles or duplicate controls',
  (await styleCount()) === 0 &&
    (await controlCount()) === FEATURE_POSTS &&
    (await fx.evaluate(() => !document.documentElement.hasAttribute('data-bx-hide-for-you'))),
);
// --- the Customize interface itself: search, groups, sliders, quick setups, state kept
await panel.bringToFront();
await panel.setViewport({ width: 400, height: 900 });
await panel.reload({ waitUntil: 'networkidle0' });
await panel.click('#customize-tab');
await panel.waitForSelector('.customize input[type="search"]');
const ui = {
  search: async (text) => {
    const box = await panel.$('.customize input[type="search"]');
    await box.focus();
    await panel.keyboard.press('Escape');
    if (text) await box.type(text);
    await sleep(120);
  },
  titles: () =>
    panel.$$eval('.customize .setting-toggle strong', (n) => n.map((x) => x.textContent)),
  settings: () =>
    panel.evaluate(async () => (await chrome.storage.local.get('bx.settings'))['bx.settings']),
};
await ui.search('');
const total = (await ui.titles()).length;
check(
  'Customize lists every setting, grouped',
  total > 60 && (await panel.$$('.customize-group')).length === 8,
  String(total),
);
await ui.search('sidebar');
const found = await ui.titles();
check(
  'search narrows the list as you type, across titles and descriptions',
  found.length > 3 && found.length < total / 3 && found.includes('Hide the sidebar'),
  found.length + ' found',
);
await ui.search('qqqqq');
check(
  '...and a miss shows an empty state with a way back',
  (await ui.titles()).length === 0 &&
    (await panel.$eval('.customize-empty', (n) => n.textContent.includes('No settings match'))),
);
await panel.click('.customize-empty .link-button');
check('...Clear search restores the list', (await ui.titles()).length === total);
await panel.focus('.customize input[type="search"]');
await panel.keyboard.type('ads');
await panel.keyboard.press('Escape');
check(
  'Escape clears the search',
  (await panel.$eval('.customize input[type="search"]', (i) => i.value)) === '',
);
await panel.evaluate(() =>
  [...document.querySelectorAll('.category-chips .category-chip')]
    .find((chip) => chip.textContent.startsWith('Sidebar'))
    .click(),
);
check(
  'a category chip shows just that category',
  (await panel.$$('.customize-group')).length === 1 &&
    (await panel.$eval('.customize-group .group-name', (n) => n.textContent)) === 'Sidebar',
);
await panel.click('.category-chips .category-chip:first-child');
const groupState = () =>
  panel.$$eval('.customize-group', (n) =>
    n.map((g) => ({ open: g.dataset.open, inert: g.querySelector('.group-panel').inert })),
  );
const closedGroup = (await groupState()).find((g) => g.open === 'false');
check('a closed group is inert, so Tab skips it', closedGroup?.inert === true);

// Sliders, by keyboard and by the reset button, restyling the open X tab live.
const primaryWidth = () =>
  fx.$eval('[data-testid="primaryColumn"]', (n) => getComputedStyle(n).maxWidth);
/** Interval polling, not animation frames: the X tab is in the background while the panel is used. */
const waitWidth = (width) =>
  fx
    .waitForFunction(
      (width) =>
        getComputedStyle(document.querySelector('[data-testid="primaryColumn"]')).maxWidth ===
        width,
      { timeout: 5000, polling: 50 },
      width,
    )
    .then(() => true)
    .catch(() => false);
await ui.search('Timeline width');
check(
  'a slider is off until its switch is on',
  await panel.$eval('.customize .slider', (n) => n.disabled),
);
await panel.click('.customize .setting-toggle input');
await panel.waitForFunction(() => !document.querySelector('.customize .slider').disabled);
check('...then the X tab takes its number', await waitWidth('700px'), await primaryWidth());
await panel.focus('.customize .slider');
for (let i = 0; i < 3; i++) await panel.keyboard.press('ArrowRight');
check(
  'arrow keys move it one step each, and X follows',
  await waitWidth('730px'),
  await primaryWidth(),
);
await panel.keyboard.press('End');
const atMax = await waitWidth('1000px');
await panel.keyboard.press('Home');
const atMin = await waitWidth('500px');
check(
  'End goes to the maximum and Home to the minimum',
  atMax && atMin,
  `max ${atMax}, min ${atMin}, now ${await primaryWidth()}`,
);
await panel.click('.customize .slider-reset');
check('the reset button returns it to its default', await waitWidth('700px'), await primaryWidth());
check(
  'the slider is stored as a number, within its range',
  await ui.settings().then((v) => v.values['appearance.timelineWidth'] === 700 && v.version === 5),
);
await panel.click('.customize .setting-toggle input');
check(
  'turning it off removes the width rule and keeps nothing behind',
  await waitWidth('none'),
  await primaryWidth(),
);

// Quick setups apply a whole configuration, leave Saved's settings alone, and undo.
await ui.search('');
await panel.evaluate(() =>
  chrome.storage.local.set({
    'bx.settings': {
      version: 3,
      accent: 'pink',
      downloadsEnabled: false,
      afterSave: 'quiet',
      features: { 'posts.plainText': true },
    },
  }),
);
await sleep(200);
const beforeDownloads = await ui.settings();
await panel.click('.preset:nth-child(1)');
check(
  'the Clean setup hides ads and Grok on the open X tab',
  (await waitShown(fx, '#inner-promo', false)) && (await waitShown(fx, '#nav-grok', false)),
);
const afterClean = await ui.settings();
check(
  '...replaces the other customization, and leaves Saved, downloads and the panel’s own settings alone',
  afterClean.accent === 'pink' &&
    afterClean.downloadsEnabled === false &&
    afterClean.afterSave === 'quiet' &&
    afterClean.features['posts.plainText'] === undefined &&
    afterClean.features['cleanup.hideAds'] === true,
  JSON.stringify(Object.keys(afterClean.features).length),
);
await panel.click('.preset-notice button');
check(
  'Undo restores exactly what was there before',
  (await waitShown(fx, '#inner-promo', true)) &&
    (await waitShown(fx, '#nav-grok', true)) &&
    (await ui
      .settings()
      .then((v) => JSON.stringify(v.features) === JSON.stringify(beforeDownloads.features))),
);
await panel.evaluate(() => chrome.storage.local.set({ 'bx.settings': { version: 3 } }));

// The Library and Customize each keep their state while the other is showing.
await ui.search('footer');
await panel.click('#library-tab');
await panel.waitForSelector('.nav-all', { visible: true });
await panel.type('.search-wrap input', 'zzz');
await panel.click('#customize-tab');
check(
  'the Customize search is where it was left after a visit to the Library',
  (await panel.$eval('.customize input[type="search"]', (i) => i.value)) === 'footer',
);
await panel.click('#library-tab');
check(
  '...and so is the Library’s',
  (await panel.$eval('.search-wrap input', (i) => i.value)) === 'zzz',
);
await panel.$eval('.search-wrap input', (i) => i.focus());
await panel.keyboard.press('Escape');
await panel.click('#customize-tab');
await ui.search('');

// Motion: short, and off when the system asks.
const duration = (selector) => panel.$eval(selector, (n) => getComputedStyle(n).transitionDuration);
check(
  'chips and cards transition briefly',
  /0\.14s/.test(await duration('.category-chip')),
  await duration('.category-chip'),
);
await panel.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
check(
  'reduced motion removes every Customize transition',
  (await duration('.category-chip')) === '0s' &&
    (await duration('.group-panel')) === '0s' &&
    (await panel.$eval('.customize', (n) => getComputedStyle(n).animationName)) === 'none',
);
await panel.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await panel.setViewport({ width: 400, height: 900 });

// --- customization settings export and import, through the real Settings dialog
await panel.bringToFront();
const settingsNow = () =>
  panel.evaluate(async () => (await chrome.storage.local.get('bx.settings'))['bx.settings']);
const setSettings = (value) =>
  panel.evaluate((v) => chrome.storage.local.set({ 'bx.settings': v }), value);
const openSettings = async () => {
  if (!(await panel.$('.settings-sheet')))
    await panel.click('button[aria-label="Settings and data"]');
  await panel.waitForSelector('.settings-sheet');
};
const dialogButton = (label) =>
  panel.evaluateHandle(
    (t) =>
      [...document.querySelectorAll('.settings-sheet button')].find(
        (b) => b.textContent.trim() === t,
      ),
    label,
  );
const clickDialog = async (label) => (await dialogButton(label)).asElement().click();
const importFile = async (contents, name) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, contents);
  const input = await panel.$('.settings-sheet input[aria-label="Settings backup file"]');
  await input.uploadFile(file);
};
const backupStatus = () => panel.$eval('.backup-status', (n) => n.textContent).catch(() => '');
await setSettings({
  version: 3,
  theme: 'dark',
  accent: 'pink',
  downloadsEnabled: false,
  afterSave: 'quiet',
  features: { 'cleanup.hideAds': true, 'appearance.timelineWidth': true },
  values: { 'appearance.timelineWidth': 820 },
});
await openSettings();
check(
  'Data & backup keeps Library and customization backups apart, with their own labels',
  await panel.evaluate(() => {
    const t = document.querySelector('.data-section').textContent;
    return [
      'Export Library',
      'Import Library',
      'Export customization settings',
      'Import customization settings',
    ].every((l) => t.includes(l));
  }),
);
await clickDialog('Export customization settings');
const exported = async () => {
  for (let i = 0; i < 80; i++) {
    const name = fs
      .readdirSync(DL)
      .find((f) => /^better-x-settings-\d{4}-\d{2}-\d{2}\.json$/.test(f));
    if (name) return name;
    await sleep(100);
  }
  return null;
};
const exportName = await exported();
const exportedData = exportName && JSON.parse(fs.readFileSync(path.join(DL, exportName), 'utf8'));
check(
  'Export writes better-x-settings-DATE.json with the switches, numbers and look, and nothing else',
  exportedData?.format === 'better-x-settings' &&
    exportedData.version === 2 &&
    exportedData.features['cleanup.hideAds'] === true &&
    exportedData.values['appearance.timelineWidth'] === 820 &&
    exportedData.appearance.accent === 'pink' &&
    !JSON.stringify(exportedData).match(/downloadsEnabled|afterSave|bookmarks|chrome-extension/),
  exportName,
);
check('...and says so', /Exported 3 settings/.test(await backupStatus()), await backupStatus());

// Wipe the customization, then bring it back by importing the file.
await setSettings({
  version: 3,
  theme: 'light',
  downloadsEnabled: false,
  afterSave: 'quiet',
  features: {},
  values: {},
});
await waitShown(fx, '#inner-promo', true);
await importFile(JSON.stringify(exportedData), 'import-1.json');
await panel.waitForSelector('.backup-preview');
check(
  'Import previews what the file holds, merge selected, and has changed nothing yet',
  (await panel.$eval(
    '.backup-preview',
    (n) => /9 settings found/.test(n.textContent) && /9 recognized/.test(n.textContent),
  )) &&
    (await panel.$eval('.backup-modes input', (n) => n.checked)) &&
    Object.keys((await settingsNow()).features).length === 0,
);
await clickDialog('Merge');
await panel.waitForFunction(() =>
  /changes? applied/.test(document.querySelector('.backup-status')?.textContent ?? ''),
);
check(
  'Merging applies the file to the open X tab at once',
  (await waitShown(fx, '#inner-promo', false)) &&
    (await fx
      .waitForFunction(
        () =>
          getComputedStyle(document.querySelector('[data-testid="primaryColumn"]')).maxWidth ===
          '820px',
        { timeout: 5000, polling: 50 },
      )
      .then(() => true)
      .catch(() => false)),
);
const afterMerge = await settingsNow();
check(
  '...keeps what the file does not hold (Saved and download preferences) and sets the look',
  afterMerge.downloadsEnabled === false &&
    afterMerge.afterSave === 'quiet' &&
    afterMerge.accent === 'pink' &&
    afterMerge.theme === 'dark',
);
// Replace: a different switch is on; the file makes itself the whole customization.
await setSettings({
  ...afterMerge,
  features: { 'posts.hideViews': true, 'cleanup.hideAds': false },
});
await importFile(JSON.stringify(exportedData), 'import-2.json');
await panel.waitForSelector('.backup-preview');
await panel.evaluate(() => document.querySelectorAll('.backup-modes input')[1].click());
await clickDialog('Replace');
await panel.waitForFunction(() =>
  /changes? applied/.test(document.querySelector('.backup-status')?.textContent ?? ''),
);
const afterReplace = await settingsNow();
check(
  'Replace restores what the file does not name to its default',
  afterReplace.features['posts.hideViews'] === undefined &&
    afterReplace.features['cleanup.hideAds'] === true,
  JSON.stringify(afterReplace.features),
);
// Same file again: nothing to do.
await importFile(JSON.stringify(exportedData), 'import-3.json');
await panel.waitForSelector('.backup-preview');
await clickDialog('Merge');
await panel.waitForFunction(() =>
  /No changes needed/.test(document.querySelector('.backup-status')?.textContent ?? ''),
);
check('Importing the same file again changes nothing', true);
// Bad files change nothing and say why.
const beforeBad = JSON.stringify(await settingsNow());
for (const [contents, message] of [
  ['{not json', /not valid JSON/],
  [JSON.stringify({ format: 'better-x-settings', version: 99, features: {} }), /newer Better X/],
  [JSON.stringify({ format: 'better-x', version: 1, bookmarks: [] }), /Library backup/],
  [
    JSON.stringify({
      format: 'better-x-settings',
      version: 1,
      features: { 'cleanup.hideAds': 'yes' },
      values: { 'appearance.timelineWidth': 9999 },
    }),
    null,
  ],
]) {
  await importFile(contents, 'bad.json');
  await sleep(300);
  if (message) {
    check(
      `A bad file is refused (${message.source.slice(0, 18)}…) and nothing changes`,
      message.test(await backupStatus()) && JSON.stringify(await settingsNow()) === beforeBad,
      await backupStatus(),
    );
  } else {
    await panel.waitForSelector('.backup-preview');
    check(
      'A file with only invalid values previews as nothing to apply',
      (await panel.$eval(
        '.backup-preview',
        (n) => /2 with an invalid value/.test(n.textContent) || /invalid/.test(n.textContent),
      )) && JSON.stringify(await settingsNow()) === beforeBad,
    );
    await clickDialog('Cancel');
  }
}
await panel.keyboard.press('Escape');
await setSettings({ version: 3 });

check(
  'no page errors from any of it',
  features.errors.length === 0,
  features.errors.join(' | ').slice(0, 300),
);
await features.page.close();

// --- two X tabs saving the same post at the same moment
const second = await openX();
await page.bringToFront();
const domClick = (p) =>
  p.evaluate((s) => document.querySelector(s).click(), sel('1100000000000000005'));
await Promise.all([domClick(page), domClick(second.page)]);
await sleep(800);
const ids = await panel.evaluate(
  async () =>
    (await chrome.runtime.sendMessage({ type: 'list' })).data.bookmarks.filter(
      (b) => b.id === '1100000000000000005',
    ).length,
);
check('two tabs, same post: still one bookmark', ids === 1, String(ids));
await panel.evaluate(() =>
  chrome.runtime.sendMessage({ type: 'delete', id: '1100000000000000005' }),
);
await sleep(300);
await Promise.all([domClick(page), domClick(second.page)]);
await sleep(800);
const fresh = await panel.evaluate(
  async () =>
    (await chrome.runtime.sendMessage({ type: 'list' })).data.bookmarks.filter(
      (b) => b.id === '1100000000000000005',
    ).length,
);
check('two tabs saving a new post at once: one bookmark', fresh === 1, String(fresh));
check(
  'other tab shows it saved',
  (await second.page.$eval(sel('1100000000000000005'), (n) => n.dataset.saved)) === 'true',
);
await second.page.close();

// --- dark X theme
theme = 'dark';
const dark = await openX();
await clickPost(dark.page, '440322224407314432');
await dark.page.waitForSelector('#bx-menu');
check(
  'overlays follow X dark theme',
  (await dark.page.$eval('#bx-menu', (n) => n.dataset.theme)) === 'dark',
);
await dark.page.screenshot({ path: `${OUT}/13-dark-menu.png` });

// --- reduced motion
await dark.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const anim = await dark.page.$eval('#bx-menu', (n) => getComputedStyle(n).animationName);
check('reduced motion disables overlay animation', anim === 'none', anim);

check(
  'no page errors on X',
  errors.length === 0 && dark.errors.length === 0,
  [...errors, ...dark.errors].join(' / '),
);
check('no worker errors', swErrors.length === 0, swErrors.join(' / '));
console.log(
  '\nfiles:',
  files()
    .map((f) => `${f} (${fileInfo(f).size})`)
    .join(', '),
);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
