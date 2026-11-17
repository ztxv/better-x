/**
 * Real-Chrome checks of "Drag to navigate photos" on an X-shaped photo viewer: a modal dialog
 * holding a carousel (a row of slides moved with `transform`, arrows rendered only where there is
 * a photo in that direction, Left/Right keys), a video slide and the post beside it. The mouse is
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
const OUT = path.join(ROOT, '.smoke', 'drag');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const viewerPage = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Home / X</title>
<style>
  body{margin:0;background:#000;color:#eee;font-family:sans-serif}
  #viewer{position:fixed;inset:0;display:flex;background:rgba(0,0,0,.9)}
  #stage{position:relative;flex:1;overflow:hidden}
  ul{display:flex;margin:0;padding:0;list-style:none;height:100%;transition:transform 300ms ease}
  li{flex:none;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  li img, li video{width:600px;height:400px;background:#345}
  #side{width:350px;background:#111}
  .nav{position:absolute;top:50%;width:36px;height:36px}
</style></head>
<body style="background-color: rgb(0, 0, 0);">
  <main style="width:600px">${post({ id: '1400000000000000001', handle: 'dragger', text: 'Post behind the viewer' })}</main>
  <div id="layers"><div id="viewer" role="dialog" aria-modal="true">
    <div id="stage" aria-roledescription="carousel">
      <ul role="list">
        <li role="listitem"><div data-testid="swipe-to-dismiss"><img alt="one" src="${PIXEL}"></div></li>
        <li role="listitem"><div data-testid="swipe-to-dismiss"><img alt="two" src="${PIXEL}"></div></li>
        <li role="listitem"><div data-testid="swipe-to-dismiss"><div data-testid="videoPlayer"><video></video></div></div></li>
      </ul>
    </div>
    <div id="side"><article><div data-testid="tweetText">Some selectable text beside the photo</div></article></div>
  </div></div>
  <script>
    const stage = document.getElementById('stage'), list = stage.querySelector('ul');
    window.state = { index: 0, clicks: 0, navClicks: 0 };
    function nav(testid, label, delta, side) {
      const b = document.createElement('button');
      b.className = 'nav'; b.dataset.testid = testid; b.setAttribute('aria-label', label);
      b.style[side] = '8px'; b.textContent = delta < 0 ? '<' : '>';
      b.addEventListener('click', (e) => { e.stopPropagation(); state.navClicks++; go(state.index + delta); });
      return b;
    }
    function go(i) {
      state.index = Math.max(0, Math.min(2, i));
      list.style.transform = 'translate3d(' + (-state.index * stage.clientWidth) + 'px, 0px, 0px)';
      stage.querySelectorAll('.nav').forEach((b) => b.remove());
      if (state.index > 0) stage.append(nav('Carousel-NavLeft', 'Previous slide', -1, 'left'));
      if (state.index < 2) stage.append(nav('Carousel-NavRight', 'Next slide', 1, 'right'));
    }
    go(0);
    stage.addEventListener('click', () => state.clicks++);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') go(state.index + 1);
      if (e.key === 'ArrowLeft') go(state.index - 1);
    });
  </script>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: ['--no-first-run', '--no-default-browser-check', '--no-sandbox'],
  defaultViewport: { width: 1280, height: 800 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const sw = await worker.worker();
const pageErrors = [];
const setFeature = (on) =>
  sw.evaluate(async (on) => {
    const { 'bx.settings': current = {} } = await chrome.storage.local.get('bx.settings');
    await chrome.storage.local.set({
      'bx.settings': { ...current, features: { ...current.features, 'posts.dragPhotos': on } },
    });
  }, on);

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: viewerPage });
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.bx-control').length >= 1, {
    timeout: 15000,
  });
  const pause = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const state = () => page.evaluate(() => ({ ...window.state }));
  const reset = async (index = 0) => {
    await page.evaluate((i) => {
      go(i);
      state.clicks = 0;
      state.navClicks = 0;
    }, index);
    await pause(350);
  };
  const live = () =>
    page.evaluate(() => ({
      attr: document.documentElement.hasAttribute('data-bx-photo-dragging'),
      translate: getComputedStyle(document.querySelector('#stage ul')).translate,
      inline: document.querySelector('#stage ul').style.translate,
    }));
  // The stage is 930 px wide; the photo sits in its middle.
  const CX = 465;
  const CY = 400;
  /** Press at the photo, move by dx/dy in steps, optionally stop before releasing. */
  async function drag(dx, dy = 0, { release = true, from = [CX, CY] } = {}) {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++)
      await page.mouse.move(from[0] + (dx * step) / 8, from[1] + (dy * step) / 8);
    if (release) await page.mouse.up();
  }

  // Off (the default): a drag is nothing but X's own press, move and click.
  await drag(-250);
  await pause();
  let s = await state();
  check(
    'off by default: a drag changes nothing',
    s.index === 0 && s.clicks === 1,
    JSON.stringify(s),
  );

  await setFeature(true);
  await pause(300);
  await reset();

  await drag(-250, 6, { release: false });
  let mid = await live();
  check(
    'the row of photos follows the pointer while dragging',
    mid.attr && mid.translate === '-250px',
    JSON.stringify(mid),
  );
  await page.mouse.up();
  await pause(400);
  s = await state();
  let after = await live();
  check('drag left goes to the next photo', s.index === 1, JSON.stringify(s));
  check('through X’s own arrow, exactly once', s.navClicks === 1, JSON.stringify(s));
  check('a completed drag does not also click', s.clicks === 0, JSON.stringify(s));
  check(
    'nothing is left behind after the drag',
    !after.attr && after.inline === '' && after.translate === 'none',
    JSON.stringify(after),
  );

  await drag(250);
  await pause(400);
  s = await state();
  check('drag right goes to the previous photo', s.index === 0, JSON.stringify(s));

  // First photo: nothing before it. The photo resists and snaps back.
  await drag(300, 0, { release: false });
  mid = await live();
  check(
    'at the first photo a drag right is resisted',
    mid.translate === '60px',
    JSON.stringify(mid),
  );
  await page.mouse.up();
  await pause(400);
  s = await state();
  check('and stays on the first photo', s.index === 0 && s.navClicks === 2, JSON.stringify(s));

  // A short drag snaps back.
  await reset();
  await drag(-30);
  await pause(400);
  s = await state();
  after = await live();
  check(
    'a drag under the threshold snaps back',
    s.index === 0 && s.navClicks === 0 && after.inline === '',
    JSON.stringify({ s, after }),
  );

  // A plain click (a few pixels of jitter) is X's click.
  await reset();
  await drag(3, 2);
  await pause();
  s = await state();
  check('a normal click still reaches X', s.index === 0 && s.clicks === 1, JSON.stringify(s));

  // A vertical movement is left alone.
  await reset();
  await drag(10, 200, { release: false });
  mid = await live();
  await page.mouse.up();
  await pause();
  s = await state();
  check(
    'a vertical drag is not taken over',
    !mid.attr && mid.inline === '' && s.index === 0 && s.clicks === 1,
    JSON.stringify({ mid, s }),
  );

  // Released far from the photo (over the post beside it).
  await reset();
  await page.mouse.move(CX, CY);
  await page.mouse.down();
  await page.mouse.move(CX - 100, CY);
  await page.mouse.move(1200, 700);
  await page.mouse.move(100, 700);
  await page.mouse.up();
  await pause(400);
  s = await state();
  after = await live();
  check(
    'a release away from the photo still ends the drag',
    !after.attr && after.inline === '' && s.index === 1,
    JSON.stringify({ s, after }),
  );

  // A cancelled gesture (window loses focus mid-drag) snaps back and does not stick.
  await reset();
  await drag(-200, 0, { release: false });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  after = await live();
  await page.mouse.move(CX - 400, CY);
  const moved = await live();
  await page.mouse.up();
  await pause(400);
  s = await state();
  check(
    'a cancelled drag lets go and does not navigate',
    !after.attr && after.inline === '' && moved.inline === '' && s.index === 0,
    JSON.stringify({ after, moved, s }),
  );

  // Last slide is a video: the player is never dragged; the arrows and keys still work.
  await reset(2);
  await drag(250);
  await pause(400);
  s = await state();
  check('a video is not draggable', s.index === 2 && s.navClicks === 0, JSON.stringify(s));
  await page.click('[data-testid="Carousel-NavLeft"]');
  await pause(350);
  await page.keyboard.press('ArrowLeft');
  await pause(350);
  s = await state();
  check('arrow buttons and keys still navigate', s.index === 0, JSON.stringify(s));

  // Text beside the photo still selects.
  await reset();
  await drag(120, 0, { from: [940, 9] });
  const selected = await page.evaluate(() => String(getSelection()));
  s = await state();
  check('text beside the photo still selects', selected.length > 0 && s.index === 0, selected);
  await page.evaluate(() => getSelection().removeAllRanges());

  const ghost = await page.evaluate(() => {
    const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
    document.querySelector('#stage img').dispatchEvent(event);
    return event.defaultPrevented;
  });
  check('the browser’s image-drag ghost is prevented', ghost === true);

  // Off and on again: still exactly one handler.
  await setFeature(false);
  await pause(300);
  await setFeature(true);
  await pause(300);
  await reset();
  await drag(-250);
  await pause(400);
  s = await state();
  check('toggling twice leaves one handler', s.index === 1 && s.navClicks === 1, JSON.stringify(s));

  // Reduced motion: the photo changes, with no settle animation.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await reset();
  await drag(-250);
  const animations = await page.evaluate(
    () =>
      document
        .querySelector('#stage ul')
        .getAnimations()
        .filter((a) => !a.transitionProperty).length,
  );
  await pause(400);
  s = await state();
  check(
    'reduced motion: no settle animation',
    animations === 0 && s.index === 1,
    String(animations),
  );
  await page.emulateMediaFeatures([]);

  // Off: X's behavior is back at once, without a reload.
  await setFeature(false);
  await pause(300);
  await reset();
  await drag(-250, 0, { release: false });
  mid = await live();
  await page.mouse.up();
  await pause();
  s = await state();
  const ghostOff = await page.evaluate(() => {
    const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
    document.querySelector('#stage img').dispatchEvent(event);
    return event.defaultPrevented;
  });
  check(
    'switched off: normal behavior is back immediately',
    !mid.attr && mid.inline === '' && s.index === 0 && s.clicks === 1 && ghostOff === false,
    JSON.stringify({ mid, s, ghostOff }),
  );

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('drag smoke ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} drag checks passed`);
process.exit(failed ? 1 : 0);
