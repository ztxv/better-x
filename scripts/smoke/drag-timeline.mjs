/**
 * Real-Chrome checks of "Also drag photos in the timeline" (`posts.dragTimelinePhotos`) on an
 * X-shaped timeline: a post whose photos sit in a row that scrolls sideways with scroll snapping
 * (each photo a link that would open the viewer), and a post with a single photo. The mouse is
 * driven with real input events. Proves the gesture on this markup, not on live X.
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
const OUT = path.join(ROOT, '.smoke', 'drag-timeline');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const photo = (n) =>
  `<a href="/someone/status/1400000000000000002/photo/${n}" class="slide"><div data-testid="tweetPhoto"><img alt="photo ${n}" src="${PIXEL}"></div></a>`;
const timelinePage = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Home / X</title>
<style>
  body{margin:0;background:#000;color:#eee;font-family:sans-serif}
  main{width:600px}
  #row{display:flex;gap:8px;width:500px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
  .slide{flex:none;width:400px;height:300px;scroll-snap-align:start;display:block}
  .slide img,#single img{width:100%;height:100%;background:#345;display:block}
  #single{display:block;width:500px;height:300px}
</style></head>
<body style="background-color: rgb(0, 0, 0);">
  <main>
    ${post({ id: '1400000000000000001', handle: 'loader', text: 'A post so the content script has something' })}
    <article data-testid="tweet" id="carousel-post">
      <div data-testid="tweetText">Three photos</div>
      <div><div id="row">${photo(1)}${photo(2)}${photo(3)}</div></div>
    </article>
    <article data-testid="tweet" id="single-post">
      <div data-testid="tweetText">One photo</div>
      <a id="single" href="/someone/status/1400000000000000003/photo/1"><div data-testid="tweetPhoto"><img alt="only" src="${PIXEL}"></div></a>
    </article>
  </main>
  <script>
    window.state = { clicks: 0 };
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) { e.preventDefault(); state.clicks++; }
    });
  </script>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
  ],
  defaultViewport: { width: 1280, height: 900 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const sw = await worker.worker();
const pageErrors = [];
const setFeatures = (features) =>
  sw.evaluate(async (features) => {
    const { 'bx.settings': current = {} } = await chrome.storage.local.get('bx.settings');
    await chrome.storage.local.set({
      'bx.settings': { ...current, features: { ...current.features, ...features } },
    });
  }, features);

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: timelinePage });
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.bx-control').length >= 1, {
    timeout: 15000,
  });
  const pause = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const box = (selector) =>
    page.evaluate((selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, selector);
  const row = () =>
    page.evaluate(() => {
      const el = document.getElementById('row');
      return {
        scroll: Math.round(el.scrollLeft),
        snap: el.style.scrollSnapType,
        attr: document.documentElement.hasAttribute('data-bx-photo-dragging'),
        clicks: state.clicks,
      };
    });
  const reset = async () => {
    await page.evaluate(() => {
      document.getElementById('row').scrollLeft = 0;
      state.clicks = 0;
    });
    await pause(200);
  };
  async function drag(dx, dy = 0, { release = true, at = '#row .slide:first-child img' } = {}) {
    const from = await box(at);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++)
      await page.mouse.move(from.x + (dx * step) / 8, from.y + (dy * step) / 8);
    if (release) await page.mouse.up();
  }
  const ghost = (selector) =>
    page.evaluate((selector) => {
      const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
      document.querySelector(selector).dispatchEvent(event);
      return event.defaultPrevented;
    }, selector);

  // Off by default: a drag on a photo is only the link's own click.
  await reset();
  await drag(-200);
  await pause();
  let r = await row();
  // (Chrome starts its own link drag here, so there is no click either: X behaves the same.)
  check(
    'off by default: a drag does not scroll the photos',
    r.scroll === 0 && !r.attr,
    JSON.stringify(r),
  );

  // The sub-option on, but the photo-viewer option it belongs to off: still nothing.
  await setFeatures({ 'posts.dragPhotos': false, 'posts.dragTimelinePhotos': true });
  await pause(300);
  await reset();
  await drag(-200);
  await pause();
  r = await row();
  check('needs “Drag to navigate photos” on too', r.scroll === 0 && !r.attr, JSON.stringify(r));

  await setFeatures({ 'posts.dragPhotos': true, 'posts.dragTimelinePhotos': true });
  await pause(300);
  await reset();

  await drag(-150, 4, { release: false });
  let mid = await row();
  check(
    'the photos follow the pointer while dragging, snapping paused',
    mid.attr && mid.scroll === 150 && mid.snap === 'none',
    JSON.stringify(mid),
  );
  await page.mouse.up();
  await pause(900);
  r = await row();
  check('drag left settles on the next photo', r.scroll === 408, JSON.stringify(r));
  check('the drag does not also open the photo', r.clicks === 0, JSON.stringify(r));
  check(
    'snapping is put back and nothing is left behind',
    r.snap === '' && !r.attr,
    JSON.stringify(r),
  );

  await drag(150, 0, { at: '#row .slide:nth-child(2) img' });
  await pause(900);
  r = await row();
  check(
    'drag right goes back to the first photo',
    r.scroll === 0 && r.clicks === 0,
    JSON.stringify(r),
  );

  await reset();
  await drag(-30);
  await pause(900);
  r = await row();
  check('a short drag snaps back', r.scroll === 0 && r.clicks === 0, JSON.stringify(r));

  await reset();
  await drag(3, 2);
  await pause();
  r = await row();
  check(
    'a normal click still opens the photo',
    r.scroll === 0 && r.clicks === 1,
    JSON.stringify(r),
  );

  await reset();
  await drag(10, 200, { release: false });
  mid = await row();
  await page.mouse.up();
  await pause();
  check('a vertical drag is left alone', !mid.attr && mid.scroll === 0, JSON.stringify(mid));

  await reset();
  await drag(-200, 0, { at: '#single img' });
  await pause();
  r = await row();
  check('a single photo is left alone', !r.attr && r.scroll === 0, JSON.stringify(r));

  check(
    'the image-drag ghost is prevented on a carousel photo',
    (await ghost('#row img')) === true,
  );
  check('and on the link around it', (await ghost('#row a')) === true);
  check('but not on a single photo', (await ghost('#single img')) === false);

  await setFeatures({ 'posts.dragTimelinePhotos': false });
  await pause(300);
  await reset();
  await drag(-200);
  await pause();
  r = await row();
  check(
    'switched off: normal behavior is back immediately',
    r.scroll === 0 && !r.attr,
    JSON.stringify(r),
  );

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('timeline drag smoke ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} timeline drag checks passed`);
process.exit(failed ? 1 : 0);
