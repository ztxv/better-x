/**
 * Real-Chrome smoke test for the unpacked extension. Serves an X-shaped page at
 * https://x.com/home (request interception; no X account), then saves posts and downloads
 * REAL media from X's CDNs (network required). Files go to .smoke/, never ~/Downloads.
 * Usage: npm run build && node scripts/smoke/run.mjs [extension dir]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { page as fixture, ELON } from './fixture.mjs';

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
async function openX() {
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
      if (url === 'https://x.com/home')
        return req.respond({ status: 200, contentType: 'text/html', body: fixture(theme) });
      return req.respond({ status: 204, body: '' });
    }
    req.continue();
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.sfx-control').length === 7, {
    timeout: 15000,
  });
  return { page, errors };
}
const sel = (id) => `article[data-post="${id}"] .sfx-control`;
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
    return fs.readdirSync(path.join(DL, 'Saved-for-X')).sort();
  } catch {
    return [];
  }
};
const fileInfo = (name) => {
  const p = path.join(DL, 'Saved-for-X', name);
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
  (await page.$$('.sfx-control')).length === 7,
);

// --- text-only post: one click saves, brief Saved confirmation, no Download
const rowBefore = await page.$eval('article[data-post="1100000000000000001"] [role=group]', (n) =>
  n.getBoundingClientRect().toJSON(),
);
await clickPost(page, '1100000000000000001');
await page.waitForSelector('#sfx-chip', { timeout: 5000 });
check(
  'text-only save shows "Saved" without Download',
  (await text(page, '#sfx-chip')) === 'Saved',
  await text(page, '#sfx-chip'),
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
check('plain Saved chip dismisses after ~1.6s', !(await page.$('#sfx-chip')));

// --- photo: save, chip with Download, single click downloads original
await clickPost(page, '440322224407314432');
await page.waitForSelector('#sfx-chip .sfx-chip-action', { timeout: 5000 });
check(
  'media save shows "Saved" and "Download"',
  /Saved\s+Download/.test(await text(page, '#sfx-chip')),
  await text(page, '#sfx-chip'),
);
await page.hover('#sfx-chip');
await sleep(3500);
check('hovering the chip pauses dismissal', !!(await page.$('#sfx-chip')));
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/02-photo-chip.png` });
await page.click('#sfx-chip .sfx-chip-action');
check(
  'photo download reports Downloaded',
  await waitText(page, '#sfx-chip', /Downloaded/),
  await text(page, '#sfx-chip'),
);
const photoName = 'TheEllenShow_440322224407314432_1.jpg';
check(
  'photo file saved at original resolution',
  (await waitFile(photoName)) && fileInfo(photoName).jpeg && fileInfo(photoName).size > 150000,
  JSON.stringify(fs.existsSync(path.join(DL, 'Saved-for-X', photoName)) && fileInfo(photoName)),
);
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/03-photo-downloaded.png` });
await page.keyboard.press('Escape');

// --- GIF: saved as MP4
await clickPost(page, '1100000000000000003');
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await page.click('#sfx-chip .sfx-chip-action');
check(
  'GIF download reports Downloaded',
  await waitText(page, '#sfx-chip', /Downloaded/),
  await text(page, '#sfx-chip'),
);
const gifName = 'gifposter_1100000000000000003_1.mp4';
check(
  'GIF saved as a real MP4',
  (await waitFile(gifName)) && fileInfo(gifName).mp4,
  fs.existsSync(path.join(DL, 'Saved-for-X', gifName))
    ? JSON.stringify(fileInfo(gifName))
    : 'missing',
);
await page.keyboard.press('Escape');

// --- real video behind a blob: player
await clickPost(page, ELON);
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await page.click('#sfx-chip .sfx-chip-action');
check(
  'video download reports Downloaded',
  await waitText(page, '#sfx-chip', /Downloaded/, 90000),
  await text(page, '#sfx-chip'),
);
const vidName = `elonmusk_${ELON}_1.mp4`;
check(
  'video saved as an MP4 file (not the poster)',
  (await waitFile(vidName, 90000)) && fileInfo(vidName).mp4 && fileInfo(vidName).size > 1_000_000,
  fs.existsSync(path.join(DL, 'Saved-for-X', vidName))
    ? JSON.stringify(fileInfo(vidName))
    : 'missing',
);
await page.keyboard.press('Escape');

// --- two photos, one missing: chooser, Download all, partial result
await clickPost(page, '1100000000000000005');
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await page.click('#sfx-chip .sfx-chip-action');
await page.waitForSelector('#sfx-menu .sfx-choice', { timeout: 5000 });
const choices = await page.$$eval('#sfx-menu .sfx-choice', (ns) =>
  ns.map((n) => n.innerText.trim()),
);
check(
  'multi-media opens chooser with previews',
  choices.join('|') === 'Image 1|Image 2' &&
    (await page.$$('#sfx-menu .sfx-thumb img')).length >= 1,
  choices.join('|'),
);
await page.screenshot({ path: `${OUT}/04-chooser.png` });
const allLabel = await text(page, '#sfx-menu .sfx-primary');
check('chooser offers "Download all (2)"', allLabel === 'Download all (2)', allLabel);
await page.click('#sfx-menu .sfx-primary');
check(
  'partial batch reports 1 of 2 and why',
  await waitText(page, '#sfx-menu .sfx-status', /1 of 2 downloaded/),
  await text(page, '#sfx-menu .sfx-status'),
);
check(
  'unavailable item offers Open post on X',
  !!(await page.$(
    '#sfx-menu .sfx-status a[href="https://x.com/batch/status/1100000000000000005"]',
  )),
);
await page.screenshot({ path: `${OUT}/05-partial.png` });
await page.keyboard.press('Escape');

// --- parent photo quoting a video: quoted media only when chosen
const before = files().length;
await clickPost(page, '1100000000000000006');
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await page.click('#sfx-chip .sfx-chip-action');
await page.waitForSelector('#sfx-menu .sfx-choice');
const quoteChoices = await page.$$eval('#sfx-menu .sfx-choice', (ns) =>
  ns.map((n) => n.innerText.trim()),
);
check(
  'quoted media is labelled and separate',
  quoteChoices.join('|') === 'Image|Quoted video' &&
    /From the quoted post/.test(await text(page, '#sfx-menu')),
  quoteChoices.join('|'),
);
await sleep(500);
check('nothing downloads until a choice is made', files().length === before);
await page.click(
  '#sfx-menu .sfx-choice:nth-of-type(2), #sfx-menu .sfx-choices > button:last-child',
);
check(
  'quoted video downloads from the quoted post',
  await waitText(page, '#sfx-menu .sfx-status', /Downloaded/, 90000),
  await text(page, '#sfx-menu .sfx-status'),
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
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await page.click('#sfx-chip .sfx-chip-action');
check(
  'unresolvable video says "Video unavailable to download"',
  await waitText(page, '#sfx-chip', /Video unavailable to download/),
  await text(page, '#sfx-chip'),
);
check(
  '…and offers Open post on X',
  !!(await page.$('#sfx-chip a[href="https://x.com/ghost/status/1999999999999999997"]')),
);
check('no poster or partial file was saved for it', !files().some((f) => f.startsWith('ghost_')));
await page.screenshot({ captureBeyondViewport: false, path: `${OUT}/06-unavailable.png` });
await page.keyboard.press('Escape');

// --- saved-post menu: order, keyboard, focus, Escape
await clickPost(page, '440322224407314432');
await page.waitForSelector('#sfx-menu');
const items = await page.$$eval('#sfx-menu .sfx-item', (ns) => ns.map((n) => n.innerText.trim()));
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
  await page.evaluate(() => document.activeElement?.closest('#sfx-menu') !== null),
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
  !(await page.$('#sfx-menu')) &&
    (await page.evaluate(() => document.activeElement?.classList.contains('sfx-control'))),
);
const box = await page.$eval(sel('440322224407314432'), (n) => n.getBoundingClientRect().toJSON());
await clickPost(page, '440322224407314432');
await page.waitForSelector('#sfx-menu');
const mbox = await page.$eval('#sfx-menu', (n) => n.getBoundingClientRect().toJSON());
check(
  'menu fits in the viewport',
  mbox.left >= 8 && mbox.right <= 1272 && mbox.top >= 8 && mbox.bottom <= 892,
  JSON.stringify(mbox),
);
await page.evaluate(() => scrollBy(0, 40));
await sleep(150);
const mbox2 = await page
  .$eval('#sfx-menu', (n) => n.getBoundingClientRect().toJSON())
  .catch(() => null);
check(
  'menu follows its control on scroll',
  mbox2 && Math.abs(mbox2.top - (mbox.top - 40)) <= 3,
  JSON.stringify({ before: mbox.top, after: mbox2?.top }),
);
await page.evaluate(() => scrollTo(0, 2000));
await sleep(200);
check('menu closes when its control scrolls away', !(await page.$('#sfx-menu')));
await page.evaluate(() => scrollTo(0, 0));
await sleep(100);

// --- viewport edge: menu flips above when there is no room below
await page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  scrollBy(0, r.bottom - innerHeight + 12);
}, sel('1999999999999999997'));
await sleep(200);
await page.click(sel('1999999999999999997'));
await page.waitForSelector('#sfx-menu');
await sleep(200);
const flip = await page.$eval('#sfx-menu', (n) => ({
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
    settings: {
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
  getComputedStyle(document.documentElement).getPropertyValue('--sfx-accent').trim(),
);
check('accent change reaches the open X tab live', accent === '#f91880', accent);
await clickPost(page, '440322224407314432');
await page.waitForSelector('#sfx-menu');
const items2 = await page.$$eval('#sfx-menu .sfx-item', (ns) => ns.map((n) => n.innerText.trim()));
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
await page.waitForSelector('#sfx-menu');
await page.click('#sfx-menu .sfx-danger');
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'false',
  {},
  sel('1100000000000000001'),
);
check(
  'Remove bookmark from the page works and restores focus',
  await page.evaluate(() => document.activeElement?.classList.contains('sfx-control')),
);
await clickPost(page, '1100000000000000001');
await page.waitForFunction(
  (s) => document.querySelector(s).dataset.saved === 'true',
  {},
  sel('1100000000000000001'),
);
await sleep(300);
check('quiet setting: saving shows no chip', !(await page.$('#sfx-chip')));
await panel.evaluate(() =>
  chrome.storage.local.set({
    settings: {
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
await page.waitForSelector('#sfx-menu');
check(
  'downloads off: no Download in menu',
  (await page.$$eval('#sfx-menu .sfx-item', (ns) => ns.map((n) => n.innerText.trim()))).join(
    '|',
  ) === 'Open bookmark library|Remove bookmark',
);
await page.keyboard.press('Escape');
await panel.evaluate(() => chrome.storage.local.remove('settings'));

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
await page.waitForSelector('#sfx-chip .sfx-chip-action');
await sleep(3500);
check('keyboard save keeps the offer up longer than 3s', !!(await page.$('#sfx-chip')));
await page.keyboard.press('Tab');
check(
  'Tab from the control enters the chip',
  await page.evaluate(() => document.activeElement?.classList.contains('sfx-chip-action')),
);
await page.keyboard.down('Shift');
await page.keyboard.press('Tab');
await page.keyboard.up('Shift');
check(
  'Shift+Tab returns to the control',
  await page.evaluate(() => document.activeElement?.classList.contains('sfx-control')),
);
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
check(
  'keyboard download completes',
  await waitText(page, '#sfx-chip', /Downloaded/),
  await text(page, '#sfx-chip'),
);
await sleep(3500);
check('focused chip is not removed from under the keyboard', !!(await page.$('#sfx-chip')));
await page.keyboard.press('Escape');
check(
  'Escape returns focus to the control',
  !(await page.$('#sfx-chip')) &&
    (await page.evaluate(() => document.activeElement?.classList.contains('sfx-control'))),
);

// --- recycled article (virtualized list reuses the element for another post)
await clickPost(page, '1100000000000000006');
await page.waitForSelector('#sfx-menu');
await page.evaluate(() => {
  const a = document.querySelector(
    'article[data-post="1100000000000000006"] > a[href*="/status/"]',
  );
  a.href = 'https://x.com/someoneelse/status/1100000000000000099';
});
await sleep(300);
check('overlay closes when its post element is reused', !(await page.$('#sfx-menu')));
check(
  'reused control shows the new post as unsaved',
  (await page.$eval(
    'article[data-post="1100000000000000006"] .sfx-control',
    (n) => n.dataset.saved,
  )) === 'false',
);

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
await dark.page.waitForSelector('#sfx-menu');
check(
  'overlays follow X dark theme',
  (await dark.page.$eval('#sfx-menu', (n) => n.dataset.theme)) === 'dark',
);
await dark.page.screenshot({ path: `${OUT}/13-dark-menu.png` });

// --- reduced motion
await dark.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const anim = await dark.page.$eval('#sfx-menu', (n) => getComputedStyle(n).animationName);
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
