/**
 * Real-Chrome checks of every customization feature on an X-shaped catalog page (see
 * `catalog-fixture.mjs`, `catalog-spec.mjs`): each feature hides what it should, leaves its
 * decoys alone, follows route / layout / sidebar changes, is fully undone when switched off, and
 * all of them together leave Saved's controls and ordinary posts alone. Settings are written to
 * `chrome.storage.local` as the side panel does, so this runs the same path as the Customize view.
 * Proves the rules on this markup, not compatibility with live X.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { catalogPage } from './catalog-fixture.mjs';
import { COVERED_ELSEWHERE, PATHS, SCENARIOS } from './catalog-spec.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'catalog');
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
const pageErrors = [];

/** Stores settings the way the side panel does. `raw` values are written untouched. */
const store = (features = {}, values = {}) =>
  sw.evaluate(
    (features, values) =>
      chrome.storage.local.set({ 'bx.settings': { version: 3, features, values } }),
    features,
    values,
  );

async function openCatalog() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource|blob:/.test(m.text()) &&
      pageErrors.push(m.text()),
  );
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: catalogPage() });
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.bx-control').length >= 5 &&
      document.documentElement.hasAttribute('data-bx-layout') &&
      document.documentElement.hasAttribute('data-bx-sidebar'),
    { timeout: 15000 },
  );
  return page;
}

// A timer, not a frame: a background tab never runs animation frames, but styles are computed on read.
const frames = (page) => page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
const visible = (page, ids) =>
  page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const el = document.getElementById(id);
          return [id, el ? el.checkVisibility({ visibilityProperty: true }) : null];
        }),
      ),
    ids,
  );
/** Ids that are not in the state wanted (`true` visible, `false` hidden); null ids are missing. */
async function wrong(page, ids, want) {
  const state = await visible(page, ids);
  return ids.filter((id) => state[id] !== want);
}
/** Save controls that are hidden although the post they sit in is shown. */
const hiddenSaveControls = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('.bx-control')].filter((control) => {
        const post = control.closest('[data-testid="cellInnerDiv"]')?.firstElementChild;
        const postShown = !post || post.checkVisibility({ visibilityProperty: true });
        return postShown && !control.checkVisibility({ visibilityProperty: true });
      }).length,
  );
/** Where the card after a hidden one sits, and how much room the hidden one takes. */
const gap = (page, { gone, next }) =>
  page.evaluate(
    (gone, next) => {
      const cards = [gone].flat().map((id) => document.getElementById(id));
      const rects = cards.map((card) => card.getBoundingClientRect());
      return {
        nextTop: document.getElementById(next).getBoundingClientRect().top,
        goneHeight: rects.reduce((sum, rect) => sum + rect.height, 0),
        space: rects.reduce(
          (sum, rect, i) =>
            sum + rect.height + parseFloat(getComputedStyle(cards[i]).marginBottom || '0'),
          0,
        ),
      };
    },
    gone,
    next,
  );
const styleSheetState = (page) =>
  page.evaluate(() => {
    const style = document.getElementById('bx-features');
    if (!style) return null;
    const css = style.textContent.replace(/\/\*[\s\S]*?\*\//g, '');
    return { rules: style.sheet.cssRules.length, blocks: (css.match(/\{/g) ?? []).length };
  });
/** Waits until `style#bx-features` mentions (or stops mentioning) a feature, then lets styles settle. */
async function waitFeature(page, id, on) {
  await page.waitForFunction(
    (id, on) => {
      const text = document.getElementById('bx-features')?.textContent ?? '';
      return text.includes(`/* ${id} */`) === on;
    },
    { timeout: 8000 },
    id,
    on,
  );
  await frames(page);
}

async function prepare(page, { layout = 'wide', route = 'home', sidebar = true }) {
  await page.setViewport({ width: layout === 'narrow' ? 420 : 1280, height: 900 });
  await page.waitForFunction(
    (layout) => document.documentElement.getAttribute('data-bx-layout') === layout,
    { timeout: 8000 },
    layout,
  );
  await page.evaluate((url) => {
    if (location.pathname + location.search !== url) history.pushState(null, '', url);
  }, PATHS[route]);
  await page.waitForFunction(
    (route) => document.documentElement.getAttribute('data-bx-route') === route,
    { timeout: 8000 },
    route,
  );
  await page.evaluate((sidebar) => {
    window.__sidebar ??= document.getElementById('sidebar');
    const el = window.__sidebar;
    if (sidebar && !el.isConnected) document.getElementById('bx-app').append(el);
    if (!sidebar && el.isConnected) el.remove();
  }, sidebar);
  await page.waitForFunction(
    (sidebar) => document.documentElement.hasAttribute('data-bx-sidebar') === sidebar,
    { timeout: 8000 },
    sidebar,
  );
  await frames(page);
}

const page = await openCatalog();
check('the catalog page loads with Saved running', true);

/* -------------------------------------------------------------------- per-feature scenarios */
const ONLY = process.env.CATALOG_ONLY;
for (const sc of SCENARIOS) {
  if (ONLY && !sc.feature.includes(ONLY)) continue;
  const label = `${sc.feature} — ${sc.name}`;
  const ids = [...(sc.hides ?? []), ...(sc.keeps ?? [])];
  try {
    await prepare(page, sc);
    await store();
    await frames(page);
    const problems = [];

    if (sc.slider) {
      const { target, prop, off, on, min, max, def } = sc.slider;
      const read = () => page.$eval(target, (n, prop) => getComputedStyle(n)[prop], prop);
      if ((await read()) !== off) problems.push(`off value ${await read()} not ${off}`);
      const cases = [
        [{}, def, 'default'],
        [{ [sc.feature]: min }, min, 'minimum'],
        [{ [sc.feature]: max }, max, 'maximum'],
        [{ [sc.feature]: max * 100 }, max, 'above the range'],
        [{ [sc.feature]: -50 }, min, 'below the range'],
        [{ [sc.feature]: 'wide' }, def, 'not a number'],
      ];
      for (const [values, want, what] of cases) {
        await store({ [sc.feature]: true }, values);
        await waitFeature(page, sc.feature, true);
        const expected = on(want);
        if ((await read()) !== expected) problems.push(`${what}: ${await read()} not ${expected}`);
      }
      await store();
      await waitFeature(page, sc.feature, false);
      if ((await read()) !== off) problems.push(`not restored: ${await read()} not ${off}`);
    } else if (sc.style) {
      const { target, prop, off, on } = sc.style;
      const read = () => page.$eval(target, (n, prop) => getComputedStyle(n)[prop], prop);
      const ok = (want, value) => (typeof want === 'function' ? want(value) : value === want);
      if (!ok(off, await read())) problems.push(`off value ${await read()}`);
      await store({ [sc.feature]: true });
      await waitFeature(page, sc.feature, true);
      if (!ok(on, await read())) problems.push(`on value ${await read()}`);
      await store();
      await waitFeature(page, sc.feature, false);
      if (!ok(off, await read())) problems.push(`not restored: ${await read()}`);
    } else {
      const everything = await wrong(page, ids, true);
      if (everything.length) problems.push(`off, not visible: ${everything}`);
      const before = sc.collapses ? await gap(page, sc.collapses) : null;
      await store({ [sc.feature]: true });
      await waitFeature(page, sc.feature, true);
      if (sc.collapses) {
        const after = await gap(page, sc.collapses);
        // The next card moves up by the whole card: its height and its margin, no reserved space.
        const moved = before.nextTop - after.nextTop;
        if (Math.abs(moved - before.space) > 1)
          problems.push(`next card moved ${moved}px, expected ${before.space}px`);
        if (after.goneHeight !== 0) problems.push(`card still has height ${after.goneHeight}px`);
      }
      const stillShown = await wrong(page, sc.hides ?? [], false);
      const lost = await wrong(page, sc.keeps ?? [], true);
      if (stillShown.length) problems.push(`not hidden: ${stillShown}`);
      if (lost.length) problems.push(`wrongly hidden: ${lost}`);
      const sheet = await styleSheetState(page);
      if (!sheet || sheet.rules !== sheet.blocks)
        problems.push(`a rule did not parse: ${JSON.stringify(sheet)}`);
      if (sc.saveControlsVisible) {
        const hiddenControls = await hiddenSaveControls(page);
        if (hiddenControls) problems.push(`${hiddenControls} Save controls hidden`);
      }
      await store();
      await waitFeature(page, sc.feature, false);
      const restored = await wrong(page, ids, true);
      if (restored.length) problems.push(`not restored: ${restored}`);
      if (await styleSheetState(page)) problems.push('stylesheet left behind');
    }
    check(label, problems.length === 0, problems.join('; '));
  } catch (error) {
    check(label, false, String(error).slice(0, 200));
  }
}

/* ------------------------------------------------------------ the catalog is fully exercised */
const allIds = [...new Set([...SCENARIOS.map((sc) => sc.feature), ...COVERED_ELSEWHERE])];

/* ------------------------------------------------------------------ all features together */
await prepare(page, {});
const everyFeature = Object.fromEntries(allIds.map((id) => [id, true]));
const start = Date.now();
await store(everyFeature);
await page.waitForFunction(
  (n) =>
    (document.getElementById('bx-features')?.textContent.match(/\/\* [a-z]+\.\w+ \*\//g) ?? [])
      .length >= n,
  { timeout: 10000 },
  allIds.length - 2, // Hide For You has no stylesheet entry when its activation wins the race
);
await frames(page);
const sheetAll = await styleSheetState(page);
check(
  `all ${allIds.length} features on: every rule parses`,
  sheetAll && sheetAll.rules === sheetAll.blocks,
  JSON.stringify(sheetAll),
);
const survivors = await wrong(
  page,
  ['inner-plain', 'inner-plain-text', 'inner-heading-post', 'primary', 'imagine-text'],
  true,
);
check(
  '...ordinary posts and the timeline are still shown',
  survivors.length === 0,
  String(survivors),
);
check(
  '...and every Save control on a post that is still shown is itself shown',
  (await hiddenSaveControls(page)) === 0 &&
    (await page.$$eval('.bx-control', (n) => n.length)) >= 5,
);
await store();
await page.waitForFunction(() => !document.getElementById('bx-features'), { timeout: 8000 });
await frames(page);
const restoredAll = await page.evaluate(() =>
  [...document.querySelectorAll('[id]')]
    .filter((el) => el.tagName !== 'STYLE' && !el.checkVisibility({ visibilityProperty: true }))
    .map((el) => el.id),
);
check(
  '...switching them all off restores the page',
  restoredAll.length === 0,
  restoredAll.join(', '),
);
console.log(`      (all features on and off: ${Date.now() - start} ms)`);

/* ------------------------------------------------------------------ dynamic behaviour */
await prepare(page, {});
await store({ 'feed.hideInlinePrompts': true, 'feed.hideReposts': true });
await waitFeature(page, 'feed.hideInlinePrompts', true);
await page.evaluate(() => {
  const cell = document.createElement('div');
  cell.setAttribute('data-testid', 'cellInnerDiv');
  cell.innerHTML =
    '<div id="inner-late"><div data-testid="inlinePrompt" id="late-prompt">Late</div></div>';
  document.getElementById('timeline').append(cell);
});
await frames(page);
check(
  'a prompt X renders after the feature is on is hidden at once',
  (await wrong(page, ['inner-late'], false)).length === 0,
);
const timelineHtml = await page.$eval('#timeline', (n) => n.innerHTML);
await page.$eval('#timeline', (n) => (n.innerHTML = ''));
await page.$eval('#timeline', (n, html) => (n.innerHTML = html), timelineHtml);
await frames(page);
check(
  'a timeline X re-renders keeps its rules: the same cells are hidden and shown',
  (await wrong(page, ['inner-prompt', 'inner-repost'], false)).length === 0 &&
    (await wrong(page, ['inner-plain'], true)).length === 0,
);
await prepare(page, { route: 'profile' });
check(
  'a route-scoped rule lets go when the route changes',
  (await wrong(page, ['inner-repost'], true)).length === 0 &&
    (await wrong(page, ['inner-prompt'], false)).length === 0,
);
await prepare(page, { route: 'home' });
check(
  '...and takes hold again when the route comes back',
  (await wrong(page, ['inner-repost'], false)).length === 0,
);
await store({ 'navigation.hideBadges': true });
await waitFeature(page, 'navigation.hideBadges', true);
await prepare(page, { layout: 'narrow' });
check(
  'a layout-scoped rule follows X into the narrow layout and back',
  (await wrong(page, ['nav-pip-label'], false)).length === 0 &&
    (await wrong(page, ['nav-pip-live'], true)).length === 0,
);
await prepare(page, { layout: 'wide' });
check(
  '...wide again',
  (await wrong(page, ['nav-pip-live'], false)).length === 0 &&
    (await wrong(page, ['nav-pip-label'], true)).length === 0,
);
await store({ 'navigation.hideExplore': true });
await waitFeature(page, 'navigation.hideExplore', true);
await prepare(page, { sidebar: false });
check(
  'Explore comes back when X drops its sidebar, and goes again when the sidebar does',
  (await wrong(page, ['nav-explore'], true)).length === 0,
);
await prepare(page, { sidebar: true });
check('...sidebar back', (await wrong(page, ['nav-explore'], false)).length === 0);

/* ---------------------------------------------- the sidebar card under re-rendering */
await store({ 'sidebar.hideWhoToFollow': true });
await waitFeature(page, 'sidebar.hideWhoToFollow', true);
await prepare(page, {});
await page.waitForFunction(
  () => document.getElementById('sec-wtf')?.hasAttribute('data-bx-hide-whoToFollow'),
  {
    timeout: 5000,
    polling: 50,
  },
);
const sectionsHtml = await page.$eval('#sections', (n) => n.innerHTML);
await page.$eval('#sections', (n) => (n.innerHTML = ''));
await page.$eval('#sections', (n, html) => (n.innerHTML = html), sectionsHtml);
await page.waitForFunction(
  () => document.getElementById('sec-wtf')?.hasAttribute('data-bx-hide-whoToFollow'),
  {
    timeout: 5000,
    polling: 50,
  },
);
check(
  'X re-rendering the sidebar: the whole Who to follow card is hidden again, the others stay',
  (await wrong(page, ['sec-wtf', 'aside-wtf'], false)).length === 0 &&
    (await wrong(page, ['sec-search', 'sec-news', 'sec-trends', 'sec-premium', 'sec-other'], true))
      .length === 0,
);
await page.evaluate(() => {
  // The module arrives late, into a card that was empty.
  const wrap = document.querySelector('#sec-wtf > div > div');
  window.__wtf = wrap.innerHTML;
  wrap.innerHTML = '';
});
await page.waitForFunction(
  () => !document.getElementById('sec-wtf').hasAttribute('data-bx-hide-whoToFollow'),
  {
    timeout: 5000,
    polling: 50,
  },
);
await page.evaluate(
  () => (document.querySelector('#sec-wtf > div > div').innerHTML = window.__wtf),
);
await page.waitForFunction(
  () => document.getElementById('sec-wtf').hasAttribute('data-bx-hide-whoToFollow'),
  {
    timeout: 5000,
    polling: 50,
  },
);
check('...and a card that empties and refills is released and taken again', true);
await prepare(page, { route: 'post' });
await page.waitForFunction(() => !document.querySelector('[data-bx-hide-whoToFollow]'), {
  timeout: 5000,
  polling: 50,
});
check(
  'Relevant people on a post page keep their card',
  (await wrong(page, ['sec-wtf', 'aside-wtf'], true)).length === 0,
);
await prepare(page, { route: 'home' });
await prepare(page, { layout: 'narrow' });
await prepare(page, { layout: 'wide' });
await page.waitForFunction(
  () => document.getElementById('sec-wtf')?.hasAttribute('data-bx-hide-whoToFollow'),
  {
    timeout: 5000,
    polling: 50,
  },
);
check(
  'narrow and wide again: still collapsed',
  (await wrong(page, ['sec-wtf'], false)).length === 0,
);
await store();
await waitFeature(page, 'sidebar.hideWhoToFollow', false);
check(
  'switching it off removes every mark and brings the card back',
  (await page.$$('[data-bx-hide-whoToFollow]')).length === 0 &&
    (await wrong(page, ['sec-wtf', 'aside-wtf'], true)).length === 0,
);

/* ------------------------------------------------------------------ two tabs stay in step */
await store();
await prepare(page, {});
const second = await openCatalog();
await store({ 'navigation.hideLists': true });
await waitFeature(page, 'navigation.hideLists', true);
await waitFeature(second, 'navigation.hideLists', true);
check(
  'a setting changed once applies to every open X tab',
  (await wrong(page, ['nav-lists'], false)).length === 0 &&
    (await wrong(second, ['nav-lists'], false)).length === 0,
);
await store();
await waitFeature(page, 'navigation.hideLists', false);
await waitFeature(second, 'navigation.hideLists', false);
check(
  '...and so does turning it off',
  (await wrong(page, ['nav-lists'], true)).length === 0 &&
    (await wrong(second, ['nav-lists'], true)).length === 0,
);
await second.close();

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
