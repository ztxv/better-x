/**
 * Real-Chrome checks of the panel overlay on an X-shaped page served under X's own frame policy.
 * The toolbar icon is clicked for real (`page.triggerExtensionAction`, the CDP
 * `Extensions.triggerAction`), so Chrome's own routing is what is tested: native mode never
 * creates the overlay; in overlay mode the click on an X tab reaches the worker and opens the
 * in-page panel, while other sites still get Chrome's side panel.
 *
 * The hard requirement is checked around every step: X's primary column (left and width), the
 * window's inner and client widths, the scroll position and the inline styles of `<html>`,
 * `<body>` and X's app are IDENTICAL with the overlay open, resized and closed. Also: flush right
 * at the stored width, drag to resize (clamped 320-560), Close button, Esc, toggling twice in a
 * row, clicks/scrolls/SPA navigation never closing it, open state shared by tabs and restored on
 * reload, and narrow and ultrawide windows. Not live X (automated Chrome gets 403 there): see
 * docs/MANUAL-CHECKLIST.md, "Panel overlay".
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { featuresPage } from './fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'overlay');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * X's policy for scripts and frames as sent by x.com (captured 2026-11-09, frame-src shortened to
 * its first entries; it lists no `chrome-extension:`). The fixture's script carries the nonce.
 */
const NONCE = 'bxsmoke';
const X_CSP = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${NONCE}' https://*.twimg.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.twimg.com",
  "frame-src 'self' https://accounts.google.com https://appleid.apple.com https://platform.twitter.com https://platform.x.com https://x.com https://*.x.com",
  "object-src 'none'",
].join(';');

/** The features fixture, centered like X's columns, so a narrower window would visibly move it. */
const xPage = () =>
  featuresPage('light')
    .replace('<style>', '<style>#bx-app{justify-content:center;min-height:3000px}')
    .replace('<script>', `<script nonce="${NONCE}">`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: ['--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 900 },
});
const pageErrors = [];
const cspViolations = [];

try {
  const target = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
    { timeout: 20000 },
  );
  const sw = await target.worker();
  const extId = new URL(target.url()).host;
  const ext = (await browser.extensions()).get(extId);

  const writeSettings = (patch) =>
    sw.evaluate(async (patch) => {
      const stored = (await chrome.storage.local.get('bx.settings'))['bx.settings'] ?? {};
      await chrome.storage.local.set({ 'bx.settings': { ...stored, ...patch } });
    }, patch);
  const overlayState = () =>
    sw.evaluate(async () => (await chrome.storage.local.get('bx.overlay'))['bx.overlay'] ?? null);
  /** The Chrome tab id of the frontmost tab, and its side panel options. */
  const activePanel = () =>
    sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return { tabId: tab.id, ...(await chrome.sidePanel.getOptions({ tabId: tab.id })) };
    });
  const nativePanels = () =>
    browser
      .targets()
      .filter((t) => /\/sidepanel\.html(\?|$)/.test(t.url()) && !t.url().includes('overlay'))
      .length;

  async function openX(urlPath = '/home') {
    const page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      const text = m.text();
      if (/Content Security Policy/.test(text)) cspViolations.push(text.slice(0, 160));
      else if (m.type() === 'error' && !/Failed to load resource/.test(text)) pageErrors.push(text);
    });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname === 'x.com' && req.resourceType() === 'document')
        return req.respond({
          status: 200,
          contentType: 'text/html',
          headers: { 'content-security-policy': X_CSP },
          body: xPage(),
        });
      if (url.hostname === 'example.org')
        return req.respond({ status: 200, contentType: 'text/html', body: '<p>Another site</p>' });
      if (url.protocol.startsWith('http')) return req.respond({ status: 204, body: '' });
      req.continue();
    });
    await page.goto(`https://x.com${urlPath}`, { waitUntil: 'networkidle2' });
    // The content script has started once the runtime mirrors the route.
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-bx-route'), {
      timeout: 15000,
    });
    return page;
  }

  /** Everything about X's layout that the overlay must never change. */
  const layout = (page) =>
    page.evaluate(() => {
      const col = document.querySelector('[data-testid="primaryColumn"]').getBoundingClientRect();
      const app = document.getElementById('bx-app');
      return JSON.stringify({
        left: col.left,
        width: col.width,
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollY,
        html: document.documentElement.getAttribute('style'),
        body: document.body.getAttribute('style'),
        app: app.getAttribute('style') + '|' + app.className,
        layout: document.documentElement.getAttribute('data-bx-layout'),
      });
    });
  const host = (page) =>
    page.evaluate(() => {
      const el = document.querySelector('bx-panel-overlay');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        display: getComputedStyle(el).display,
        open: el.hasAttribute('data-open'),
        left: r.left,
        right: r.right,
        width: r.width,
        top: r.top,
        height: r.height,
        clientWidth: document.documentElement.clientWidth,
        innerHeight,
        parent: el.parentElement === document.documentElement,
      };
    });
  const isOpen = async (page) => {
    const h = await host(page);
    return !!h && h.open && h.display === 'block';
  };
  const waitOpen = (page, want, timeout = 4000) =>
    page
      .waitForFunction(
        (want) => {
          const el = document.querySelector('bx-panel-overlay');
          const open =
            !!el && el.hasAttribute('data-open') && getComputedStyle(el).display === 'block';
          const closed = !el || getComputedStyle(el).display === 'none';
          return want ? open : closed;
        },
        { timeout },
        want,
      )
      .then(
        () => sleep(260), // the 200 ms slide
        () => {},
      );
  const overlayFrame = (page) =>
    page
      .frames()
      .find((f) => f.url().startsWith(`chrome-extension://${extId}/sidepanel.html?overlay`));
  const click = async (page) => {
    await page.bringToFront();
    await page.triggerExtensionAction(ext);
  };

  /* ------------------------------------------------------------------- native mode */
  // Overlay is the default (1.1.5); start in Native, as someone who chose it.
  await writeSettings({ panelMode: 'native' });
  const x = await openX();
  await sleep(500);
  check('native mode: no overlay host on an X page', (await host(x)) === null);
  check(
    "...and the X tab keeps Chrome's side panel enabled",
    (await activePanel()).enabled !== false,
    JSON.stringify(await activePanel()),
  );
  await click(x);
  await sleep(800);
  check(
    '...a real toolbar click opens the native side panel and still creates no host',
    nativePanels() === 1 && (await host(x)) === null,
    `panels ${nativePanels()}`,
  );
  await click(x); // Chrome toggles its panel closed again
  await sleep(500);

  /* ------------------------------------------------------------------ overlay mode */
  await writeSettings({ panelMode: 'overlay' });
  await x.waitForFunction(() => true);
  await sleep(500);
  check(
    "overlay mode: the X tab disables Chrome's panel for itself (clicks reach the worker)",
    (await activePanel()).enabled === false,
    JSON.stringify(await activePanel()),
  );
  check('...and still creates nothing before the first open', (await host(x)) === null);

  const before = await layout(x);
  await click(x);
  await waitOpen(x, true);
  let h = await host(x);
  check('a real toolbar click on the X tab opens the overlay', await isOpen(x), JSON.stringify(h));
  check(
    'it is fixed to the right edge: flush right, full height, 400 px, a child of <html>',
    h &&
      h.right === h.clientWidth &&
      h.width === 400 &&
      h.top === 0 &&
      h.height === h.innerHeight &&
      h.parent,
    JSON.stringify(h),
  );
  let after = await layout(x);
  check(
    'X layout is IDENTICAL with the overlay open',
    after === before,
    `${before}\n      ${after}`,
  );
  const frame = overlayFrame(x);
  check("the frame loads the side panel page despite X's frame-src", !!frame, frame?.url());
  if (frame) {
    await frame
      .waitForSelector('.app-shell[data-mode="overlay"]', { timeout: 10000 })
      .catch(() => {});
    const app = await frame.evaluate(() => ({
      shell: document.querySelector('.app-shell')?.dataset.mode,
      close: !!document.querySelector('.close-overlay-button'),
      popupButton: !!document.querySelector('[aria-label="Open in popup"]'),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    check(
      '...in overlay mode: a Close button, no "Open in popup", no horizontal overflow',
      app.shell === 'overlay' && app.close && !app.popupButton && !app.overflow,
      JSON.stringify(app),
    );
  }
  check(
    'no CSP violation for the extension frame',
    cspViolations.length === 0,
    cspViolations.join(' | '),
  );

  // Non-modal: X keeps its clicks, scrolling and navigation, and none of them close the panel.
  const hit = await x.evaluate(() => {
    const at = (px, py) => document.elementFromPoint(px, py);
    const r = document.querySelector('[data-testid="primaryColumn"]').getBoundingClientRect();
    return {
      x: at(r.left + 20, 200)?.closest('[data-testid="primaryColumn"]') !== null,
      overlay: at(innerWidth - 50, 200)?.tagName.toLowerCase(),
    };
  });
  check(
    'X is still under the pointer left of the panel; the panel only covers itself',
    hit.x && hit.overlay === 'bx-panel-overlay',
    JSON.stringify(hit),
  );
  await x.mouse.click(400, 300);
  await x.mouse.wheel({ deltaY: 600 });
  await sleep(300);
  const scrolled = await x.evaluate(() => scrollY);
  await x.evaluate(() => history.pushState({}, '', '/explore'));
  await sleep(300);
  check(
    'clicking X, scrolling X and an SPA navigation leave it open (and X scrolls)',
    (await isOpen(x)) && scrolled > 0,
    `scrollY ${scrolled}`,
  );
  await x.evaluate(() => {
    history.pushState({}, '', '/home');
    scrollTo(0, 0);
  });
  await sleep(200);

  // Resize by dragging the left edge.
  h = await host(x);
  await x.mouse.move(h.left + 2, 450);
  await x.mouse.down();
  await x.mouse.move(h.left - 60, 450, { steps: 4 });
  await x.mouse.move(h.left + 2 - 100, 450, { steps: 4 });
  await x.mouse.up();
  await sleep(200);
  h = await host(x);
  check(
    'dragging the left edge 100 px resizes it to 500 px, still flush right, and stores it',
    h.width === 500 && h.right === h.clientWidth && (await overlayState())?.width === 500,
    `${JSON.stringify(h)} stored ${JSON.stringify(await overlayState())}`,
  );
  check('X layout is IDENTICAL after resizing', (await layout(x)) === before);
  await x.mouse.move(h.left + 2, 450);
  await x.mouse.down();
  await x.mouse.move(10, 450, { steps: 6 });
  await x.mouse.up();
  await x.mouse.move(h.left + 2, 450);
  await sleep(200);
  check(
    '...and is clamped at 560 px',
    (await host(x)).width === 560,
    String((await host(x)).width),
  );
  h = await host(x);
  await x.mouse.move(h.left + 2, 450);
  await x.mouse.down();
  await x.mouse.move(h.left + 162, 450, { steps: 6 });
  await x.mouse.up();
  await sleep(200);
  check('...and back to 400', (await host(x)).width === 400, String((await host(x)).width));

  // Close with the panel's own button.
  if (frame) {
    // CDP mouse events sent to the X page are not routed into the extension's out-of-process
    // frame (the page receives them on the <iframe>; keyboard input does reach the frame), so the
    // button is pressed from inside the frame. Real clicks in the panel are a manual check.
    await frame.evaluate(() => document.querySelector('.close-overlay-button').click());
    await waitOpen(x, false);
    check(
      'the Close button closes it, everywhere (stored closed)',
      !(await isOpen(x)) && (await overlayState())?.open === false,
    );
  }
  after = await layout(x);
  check('X layout is IDENTICAL after closing', after === before, after);
  check('closed, the host is display:none (covers nothing)', (await host(x))?.display === 'none');

  // Toggle twice in a row with real clicks.
  const toggles = [];
  for (let i = 0; i < 4; i++) {
    await click(x);
    await waitOpen(x, i % 2 === 0);
    toggles.push(await isOpen(x));
  }
  check(
    'the toolbar icon toggles it open, closed, open, closed',
    toggles.join() === 'true,false,true,false',
    toggles.join(),
  );
  check(
    '...with one host and X unchanged',
    (await x.$$('bx-panel-overlay')).length === 1 && (await layout(x)) === before,
  );

  // Esc inside the panel.
  await click(x);
  await waitOpen(x, true);
  const f2 = overlayFrame(x);
  await f2.waitForSelector('.app-shell', { timeout: 10000 });
  await f2.focus('.settings-button');
  await x.keyboard.press('Escape');
  await waitOpen(x, false);
  check('Esc with focus in the panel closes it', !(await isOpen(x)));
  await x.mouse.click(400, 300);
  await x.keyboard.press('Escape');
  await sleep(200);
  check('...and Esc on X itself does not reopen or affect it', !(await isOpen(x)));

  // Persistence across tabs and reloads.
  await click(x);
  await waitOpen(x, true);
  const second = await openX('/notifications');
  await waitOpen(second, true);
  check(
    'left open, a newly opened X tab opens with it (stored state restored)',
    await isOpen(second),
  );
  await click(second);
  await waitOpen(second, false);
  await x.bringToFront();
  await waitOpen(x, false);
  check(
    'closing it in one X tab closes it in the other',
    !(await isOpen(x)) && !(await isOpen(second)),
  );
  await click(x);
  await waitOpen(x, true);
  await x.reload({ waitUntil: 'networkidle2' });
  await waitOpen(x, true);
  check('it is open again after the X page reloads', await isOpen(x));
  check('...with X laid out as before', (await layout(x)) === before);

  // Narrow and ultrawide windows.
  for (const width of [700, 2560]) {
    await x.setViewport({ width, height: 900 });
    await sleep(300);
    const closedLayout = await layout(x);
    await click(x); // close
    await waitOpen(x, false);
    const openBefore = await layout(x);
    await click(x); // open
    await waitOpen(x, true);
    h = await host(x);
    check(
      `${width} px window: flush right at 400 px and X IDENTICAL open vs closed`,
      h.right === h.clientWidth &&
        h.width === 400 &&
        (await layout(x)) === openBefore &&
        closedLayout === openBefore,
      `${openBefore}\n      ${await layout(x)}`,
    );
  }
  await x.setViewport({ width: 1280, height: 900 });

  /* ---------------------------------------------- other sites, and leaving X */
  const other = await browser.newPage();
  await other.setRequestInterception(true);
  other.on('request', (req) =>
    req.respond({ status: 200, contentType: 'text/html', body: '<p>Another site</p>' }),
  );
  await other.goto('https://example.org/');
  const panelsBefore = nativePanels();
  await click(other);
  await sleep(800);
  check(
    "overlay mode on another site: the toolbar click opens Chrome's side panel",
    nativePanels() === panelsBefore + 1 && (await host(other)) === null,
    `panels ${panelsBefore} -> ${nativePanels()}`,
  );
  await click(other);
  await sleep(500);

  // The X tab goes to another site: its panel is still disabled, the worker gives it back.
  await second.bringToFront();
  await second.goto('https://example.org/left-x', { waitUntil: 'networkidle2' });
  const stalePanels = nativePanels();
  await click(second);
  await sleep(800);
  check(
    'a tab that left X still gets the native panel on its first click (inside the gesture)',
    nativePanels() === stalePanels + 1 && (await activePanel()).enabled !== false,
    `panels ${stalePanels} -> ${nativePanels()} ${JSON.stringify(await activePanel())}`,
  );

  /* ---------------------------------------------------------------- back to native */
  await writeSettings({ panelMode: 'native' });
  await x.bringToFront();
  await sleep(600);
  check(
    "switching back to native removes the overlay and gives the tab Chrome's panel back",
    (await host(x)) === null && (await activePanel()).enabled !== false,
    JSON.stringify(await activePanel()),
  );
  check('X layout after all of it is IDENTICAL to the start', (await layout(x)) === before);
  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('overlay smoke ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} overlay checks passed`);
process.exit(failed ? 1 : 0);
