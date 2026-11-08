/**
 * Real-Chrome checks of the toolbar mode and the popup: the setting chooses what the toolbar
 * icon does (Chrome's own `action.getPopup` and `sidePanel.getPanelBehavior` are what it consults
 * on a click), the choice survives a worker stop and a browser restart, and the popup, opened for
 * real with `action.openPopup`, is the same app: Library and Customize, no horizontal overflow,
 * long lists scroll inside it, and it stays in step with the side panel page. Also the Library's
 * "Downloaded" status badge at several widths. A real click on the toolbar icon cannot be
 * automated; the configuration Chrome reads on that click is what is checked.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'launch');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const pageErrors = [];
const watch = (page) => {
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource/.test(m.text()) &&
      pageErrors.push(m.text()),
  );
};

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    pipe: true,
    enableExtensions: [EXT],
    userDataDir: path.join(OUT, 'profile'),
    args: ['--no-first-run', '--no-default-browser-check'],
    defaultViewport: { width: 1280, height: 900 },
  });
async function connect(browser) {
  const target = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
    { timeout: 20000 },
  );
  return { sw: await target.worker(), extId: new URL(target.url()).host };
}
const toolbar = (sw) =>
  sw.evaluate(async () => ({
    popup: (await chrome.action.getPopup({})).replace(/^chrome-extension:\/\/[^/]+\//, ''),
    panelOnClick: (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick,
  }));
async function waitToolbar(sw, want, timeout = 6000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await toolbar(sw);
    if (last.popup === want.popup && last.panelOnClick === want.panelOnClick) return [true, last];
    await sleep(100);
  }
  return [false, last];
}
const SIDE = { popup: '', panelOnClick: true };
const POPUP = { popup: 'compact.html', panelOnClick: false };

let browser = await launch();
let { sw, extId } = await connect(browser);

/* ----------------------------------------------------------------- default and switching */
let [ok, seen] = await waitToolbar(sw, SIDE);
check(
  'by default the toolbar icon opens the side panel (no popup, panel on click)',
  ok,
  JSON.stringify(seen),
);

const sp = await browser.newPage();
watch(sp);
await sp.setViewport({ width: 400, height: 900 });
await sp.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle0' });

// A library of 60 posts, the first 4 with download history from another browser.
const base = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/lib/fixtures/backups/saved-for-x-v3.json'), 'utf8'),
);
const clone = (value, id) =>
  JSON.parse(JSON.stringify(value).replaceAll('1700000000000000001', id));
const bookmarks = [];
const downloads = [];
for (let i = 0; i < 60; i++) {
  const id = String(1700000000000100000n + BigInt(i));
  bookmarks.push({
    ...clone(base.bookmarks[0], id),
    collectionId: null,
    text: `Library post number ${i}`,
  });
  if (i < 4)
    downloads.push({ ...clone(base.downloads[0], id), id: `dl-${i}`, batchId: `batch-${i}` });
}
const library = path.join(OUT, 'library.json');
fs.writeFileSync(
  library,
  JSON.stringify({
    format: 'better-x',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks,
    collections: [],
    downloads,
  }),
);
await (await sp.$('.library-view input[type="file"]')).uploadFile(library);
await sp.waitForFunction(() => document.querySelectorAll('.bookmark-item').length >= 60, {
  timeout: 15000,
});
check('the test library loads (60 posts, 4 with older download history)', true);

// Choose Popup in the real Settings dialog.
const openDialog = async (page) => {
  if (!(await page.$('.settings-sheet')))
    await page.click('button[aria-label="Settings and data"]');
  await page.waitForSelector('.settings-sheet');
};
const chooseOpenAs = async (page, label) => {
  await openDialog(page);
  await page.evaluate((label) => {
    const radio = [...document.querySelectorAll('.settings-sheet label.radio-option')].find(
      (l) => l.querySelector('strong').textContent === label,
    );
    radio.querySelector('input').click();
  }, label);
};
await chooseOpenAs(sp, 'Popup');
[ok, seen] = await waitToolbar(sw, POPUP);
check(
  'choosing Popup in Settings switches the toolbar icon to the popup, at once, no reload',
  ok,
  JSON.stringify(seen),
);
check(
  '...and the choice is stored, not tied to the page',
  (await sw.evaluate(
    async () => (await chrome.storage.local.get('bx.settings'))['bx.settings'].openAs,
  )) === 'popup',
);
await sp.keyboard.press('Escape');

/* ------------------------------------------------------------------------ the real popup */
await sw.evaluate(() => chrome.action.openPopup());
const popupTarget = await browser.waitForTarget((t) => t.url().endsWith('/compact.html'), {
  timeout: 10000,
});
const popup = (await popupTarget.page()) ?? (await popupTarget.asPage());
watch(popup);
await popup.waitForSelector('.app-shell[data-mode="popup"]');
await popup.waitForFunction(() => document.querySelectorAll('.bookmark-item').length >= 60, {
  timeout: 15000,
});
const geometry = () =>
  popup.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    shell: document.querySelector('.app-shell').getBoundingClientRect().width,
    body: (() => {
      const b = document.querySelector('.app-body');
      return {
        client: b.clientHeight,
        scroll: b.scrollHeight,
        overflowX: b.scrollWidth > b.clientWidth + 1,
      };
    })(),
  }));
let g = await geometry();
await popup.screenshot({ path: path.join(OUT, 'popup-library.png') });
console.log('      popup viewport', JSON.stringify(g));
check(
  'the popup is the same app, compact: 400 wide, no horizontal overflow',
  g.shell === 400 && g.scrollWidth <= g.width && g.bodyScrollWidth <= g.width && !g.body.overflowX,
  JSON.stringify(g),
);
check(
  '...a long Library scrolls inside it (60 posts)',
  g.body.scroll > g.body.client * 3 &&
    (await popup.evaluate(() => {
      const b = document.querySelector('.app-body');
      b.scrollTop = 400;
      return b.scrollTop;
    })) > 0,
);
await popup.evaluate(() => (document.querySelector('.app-body').scrollTop = 0));
await popup.type('.search-wrap input', 'number 7');
await popup.waitForFunction(() => document.querySelectorAll('.bookmark-item').length === 1, {
  timeout: 5000,
});
check('...search works in the popup', true);
await popup.$eval('.search-wrap input', (i) => i.focus());
await popup.keyboard.press('Escape');
await popup.evaluate(() => {
  const i = document.querySelector('.search-wrap input');
  i.select();
});
await popup.keyboard.press('Backspace');
await popup.waitForFunction(() => document.querySelectorAll('.bookmark-item').length >= 60, {
  timeout: 5000,
});

// Customize in the popup: every setting present, switches and sliders work, and it syncs.
await popup.click('#customize-tab');
await popup.waitForSelector('.customize input[type="search"]');
check(
  'Customize lists all 76 settings in the popup',
  (await popup.$$('.customize .setting-toggle')).length === 76,
  String((await popup.$$('.customize .setting-toggle')).length),
);
await popup.screenshot({ path: path.join(OUT, 'popup-customize.png') });
await popup.evaluate(() =>
  document.querySelectorAll('.group-toggle[aria-expanded="false"]').forEach((b) => b.click()),
);
await sleep(450);
g = await geometry();
check(
  '...with every group open there is still no horizontal overflow, and it scrolls',
  g.scrollWidth <= g.width && !g.body.overflowX && g.body.scroll > g.body.client * 5,
  JSON.stringify(g),
);
const settingsNow = () =>
  sw.evaluate(async () => (await chrome.storage.local.get('bx.settings'))['bx.settings']);
const find = async (page, text) => {
  const box = await page.$('.customize input[type="search"]');
  await box.focus();
  await page.keyboard.press('Escape');
  await box.type(text);
  await sleep(450);
};
await find(popup, 'Hide Jobs');
await popup.click('.customize .setting-toggle input');
await sleep(300);
check(
  'a switch flipped in the popup is stored',
  (await settingsNow()).features?.['navigation.hideJobs'] === true,
);
await find(popup, 'Post text size');
await popup.click('.customize .setting-toggle input');
await popup.waitForFunction(() => !document.querySelector('.customize .slider').disabled);
await popup.focus('.customize .slider');
for (let i = 0; i < 2; i++) await popup.keyboard.press('ArrowRight');
await sleep(500);
check(
  'a slider moved by keyboard in the popup is stored (16 → 18)',
  (await settingsNow()).values?.['appearance.postTextSize'] === 18,
  JSON.stringify((await settingsNow()).values),
);
// The side panel page, already open, shows both without being touched.
await sp.bringToFront();
await sp.click('#customize-tab');
await find(sp, 'Hide Jobs');
check(
  'the side panel shows the popup’s switch',
  await sp.$eval('.customize .setting-toggle input', (i) => i.checked),
);
await find(sp, 'Post text size');
check('...and its slider', (await sp.$eval('.customize .slider', (i) => i.value)) === '18');
// And the other way.
await find(sp, 'Hide Jobs');
await sp.click('.customize .setting-toggle input');
await popup.bringToFront();
await find(popup, 'Hide Jobs');
await popup.waitForFunction(
  () => !document.querySelector('.customize .setting-toggle input').checked,
  { timeout: 5000 },
);
check('a change in the side panel appears in the popup', true);

// Keyboard and focus.
await popup.$eval('.customize input[type="search"]', (i) => i.blur());
const focusPath = [];
for (let i = 0; i < 6; i++) {
  await popup.keyboard.press('Tab');
  focusPath.push(
    await popup.evaluate(
      () =>
        document.activeElement?.getAttribute('aria-label') ||
        document.activeElement?.id ||
        document.activeElement?.tagName,
    ),
  );
}
check(
  'Tab moves focus through the popup, never off into nothing',
  focusPath.every((f) => f && f !== 'BODY'),
  focusPath.join(' > '),
);

// The Downloaded status badge in the popup and at side-panel widths.
const chips = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.download-chip')].map((chip) => {
      const card = chip.closest('.bookmark-item').getBoundingClientRect();
      const box = chip.getBoundingClientRect();
      const label = chip.querySelector('.chip-label');
      return {
        text: label.textContent,
        inside: box.left >= card.left - 0.5 && box.right <= card.right + 0.5,
        height: Math.round(box.height),
        clipped: label.scrollWidth > label.clientWidth + 1,
        padding: getComputedStyle(chip).paddingLeft,
      };
    }),
  );
await popup.click('#library-tab');
await popup.waitForSelector('.nav-all', { visible: true });
await popup.evaluate(() => document.querySelector('.app-body').scrollTo(0, 0));
let found = await chips(popup);
check(
  '“Downloaded previously” fits its pill in the popup',
  found.length === 4 &&
    found.every(
      (c) => c.text === 'Downloaded previously' && c.inside && !c.clipped && c.height <= 24,
    ),
  JSON.stringify(found[0]),
);
for (const width of [400, 360, 320, 280]) {
  await sp.bringToFront();
  await sp.setViewport({ width, height: 900 });
  await sp.click('#library-tab');
  await sp.waitForSelector('.nav-all', { visible: true });
  await sleep(250);
  found = await chips(sp);
  check(
    `the badge stays inside its card at ${width}px wide${width >= 320 ? ', text whole' : ' (may shorten with an ellipsis, never spill)'}`,
    found.length === 4 &&
      found.every((c) => c.inside && c.height <= 24 && (width < 320 || !c.clipped)),
    JSON.stringify(found[0]),
  );
}
const overflow = await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
check('...and the side panel itself never scrolls sideways', overflow);
await sp.setViewport({ width: 400, height: 900 });

// Back to the side panel from inside the popup: never trapped in a mode.
check(
  'the popup has an “Open in side panel” action',
  !!(await popup.$('button[aria-label="Open in side panel"]')),
);
await popup.bringToFront();
await chooseOpenAs(popup, 'Side panel');
await popup.screenshot({ path: path.join(OUT, 'popup-settings.png') });
[ok, seen] = await waitToolbar(sw, SIDE);
check('the mode can be changed back from inside the popup', ok, JSON.stringify(seen));
await popup.keyboard.press('Escape').catch((e) => console.log('esc', e.message.slice(0, 50)));
await popup.close().catch(() => {});
await sp.bringToFront();

/* ----------------------------------------------------------------- survives restarts */
await chooseOpenAs(sp, 'Popup');
[ok] = await waitToolbar(sw, POPUP);
await browser.close();
browser = await launch();
({ sw } = await connect(browser));
[ok, seen] = await waitToolbar(sw, POPUP, 10000);
check(
  'after the browser restarts, a new worker restores the Popup mode (the manifest has no popup, so only the worker can)',
  ok,
  JSON.stringify(seen),
);
// Leave the profile as a new install would have it.
const again = await browser.newPage();
await again.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle0' });
await again.setViewport({ width: 400, height: 900 });
await chooseOpenAs(again, 'Side panel');
[ok, seen] = await waitToolbar(sw, SIDE);
check(
  '...and switching back to the side panel restores the original behavior',
  ok,
  JSON.stringify(seen),
);

check(
  'no page errors in the side panel or the popup',
  pageErrors.length === 0,
  pageErrors.slice(0, 3).join(' | '),
);
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
