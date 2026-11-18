/**
 * Real-Chrome checks of the plugin system and the Spotify player on an X-shaped page (left menu
 * with an account switcher). Spotify itself is scripted: the worker's requests to
 * api.spotify.com are answered here through the DevTools Fetch domain, so this proves the
 * player, the plugin switch and the message path, not a real Spotify account.
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
const OUT = path.join(ROOT, '.smoke', 'plugins');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const xPage = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Home / X</title>
<style>body{margin:0;background:#000;color:#e7e9ea;font-family:sans-serif;display:flex}
header{width:275px;height:100vh;position:sticky;top:0;display:flex;flex-direction:column;justify-content:space-between;padding:0 8px;box-sizing:border-box}
nav a{display:block;padding:12px;color:inherit;font-size:20px;text-decoration:none}
#foot{margin:12px 0}</style></head>
<body style="background-color: rgb(0, 0, 0);">
  <header role="banner"><nav><a href="/home">Home</a><a href="/explore">Explore</a></nav>
    <div id="foot"><button data-testid="SideNav_AccountSwitcher_Button" style="width:100%;height:64px">@someone</button></div>
  </header>
  <main style="width:600px">${post({ id: '1500000000000000001', handle: 'listener', text: 'A post' })}</main>
</body></html>`;

// 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const spotify = {
  playing: true,
  progress: 23000,
  commands: [],
  art: [],
  product403: false,
  delayGet: 0,
};
const playback = () => ({
  is_playing: spotify.playing,
  progress_ms: spotify.progress,
  shuffle_state: false,
  repeat_state: 'off',
  currently_playing_type: 'track',
  device: { is_restricted: false },
  actions: { disallows: {} },
  item: {
    name: 'And 1 : 100 sum',
    duration_ms: 204000,
    artists: [{ name: '406ahmad' }, { name: 'Dragnutz' }],
    album: {
      name: 'LIFE OF AHMAD 3',
      images: [
        { url: 'https://i.scdn.co/image/big', width: 640 },
        { url: 'https://i.scdn.co/image/cover', width: 300 },
      ],
    },
    external_urls: { spotify: 'https://open.spotify.com/track/abc' },
  },
});

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
  defaultViewport: { width: 1280, height: 800 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const sw = await worker.worker();
const cdp = await worker.createCDPSession();
await cdp.send('Fetch.enable', {
  patterns: [{ urlPattern: 'https://api.spotify.com/*' }, { urlPattern: 'https://i.scdn.co/*' }],
});
cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
  const respond = (code, body, type = 'application/json') =>
    cdp
      .send('Fetch.fulfillRequest', {
        requestId,
        responseCode: code,
        responseHeaders: [{ name: 'content-type', value: type }],
        body: Buffer.from(body).toString('base64'),
      })
      .catch(() => {});
  const url = new URL(request.url);
  if (url.hostname === 'i.scdn.co') {
    spotify.art.push(url.pathname);
    return respond(200, PNG, 'image/png');
  }
  if (url.pathname === '/v1/me/player' && request.method === 'GET') {
    const body = JSON.stringify(playback());
    if (spotify.delayGet) await new Promise((r) => setTimeout(r, spotify.delayGet));
    return respond(200, body);
  }
  spotify.commands.push(`${request.method} ${url.pathname}${url.search}`);
  if (spotify.product403)
    return respond(
      403,
      JSON.stringify({ error: { status: 403, message: 'x', reason: 'PREMIUM_REQUIRED' } }),
    );
  if (url.pathname.endsWith('/pause')) spotify.playing = false;
  if (url.pathname.endsWith('/play')) spotify.playing = true;
  if (url.pathname.endsWith('/seek'))
    spotify.progress = Number(url.searchParams.get('position_ms'));
  return respond(200, '{}');
});
const store = (values) => sw.evaluate((values) => chrome.storage.local.set(values), values);
const plugin = (on, clientId = '') =>
  store({ 'bx.plugins': { enabled: { spotify: on }, spotify: { clientId } } });
const pageErrors = [];

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: xPage });
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.bx-control').length >= 1, {
    timeout: 15000,
  });
  const pause = (ms = 400) => new Promise((r) => setTimeout(r, ms));
  const player = () =>
    page.evaluate(() => {
      const host = document.querySelector('bx-spotify-player');
      if (!host) return null;
      const root = host.shadowRoot;
      const text = (s) => root.querySelector(s)?.textContent ?? null;
      return {
        count: document.querySelectorAll('bx-spotify-player').length,
        aboveAccount:
          host.nextElementSibling?.getAttribute('data-testid') === 'SideNav_AccountSwitcher_Button',
        status: root.querySelector('.card').dataset.status,
        message: text('.message'),
        title: text('.title'),
        artists: text('.artists'),
        times: text('.times'),
        art: root.querySelector('.art img')?.src.slice(0, 22) ?? null,
        toggle: root.querySelector('.toggle')?.getAttribute('aria-label') ?? null,
        controls: root.querySelector('.controls') ? !root.querySelector('.controls').hidden : null,
        note: text('.note'),
        width: Math.round(host.getBoundingClientRect().width),
      };
    });
  const press = (selector) =>
    page.evaluate(
      (s) => document.querySelector('bx-spotify-player').shadowRoot.querySelector(s).click(),
      selector,
    );

  check('off by default: nothing is added to X', (await player()) === null);

  await plugin(true);
  await pause();
  let p = await player();
  check(
    'switched on: the player appears above the account switcher',
    p?.count === 1 && p.aboveAccount,
    JSON.stringify(p),
  );
  check(
    'with no Client ID it asks for setup, not a fake song',
    p?.status === 'setup' && p.title === null,
    JSON.stringify(p),
  );

  await plugin(true, 'a'.repeat(32));
  await pause();
  p = await player();
  check(
    'with a Client ID but no account it says not connected',
    p?.status === 'disconnected',
    JSON.stringify(p),
  );

  await store({
    'bx.spotify.auth': {
      clientId: 'a'.repeat(32),
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600_000,
      user: { name: 'Listener', product: 'premium' },
    },
  });
  await pause(900);
  p = await player();
  check(
    'connected: shows the track, artists, cover and time',
    p?.status === 'playing' &&
      p.title === 'And 1 : 100 sum' &&
      p.artists === '406ahmad, Dragnutz' &&
      p.art === 'data:image/png;base64,' &&
      /^00:2\d03:24$/.test(p.times ?? ''),
    JSON.stringify(p),
  );
  await page.screenshot({
    path: path.join(OUT, 'playing.png'),
    clip: { x: 0, y: 500, width: 300, height: 300 },
  });

  const before = p.times;
  await pause(1600);
  p = await player();
  check('the progress moves between polls', p.times !== before, `${before} → ${p.times}`);

  await press('.toggle');
  await pause(900);
  p = await player();
  check(
    'pause is sent to Spotify and the button becomes Play',
    spotify.commands.includes('PUT /v1/me/player/pause') && p.toggle === 'Play',
    JSON.stringify({ commands: spotify.commands, toggle: p.toggle }),
  );
  await press('.next');
  await pause(900);
  check(
    'next is sent to Spotify',
    spotify.commands.includes('POST /v1/me/player/next'),
    spotify.commands.join(', '),
  );

  // X's menu handles presses itself; a press on the player must not reach it (it opened the
  // account switcher on live X). Real mouse clicks, through the shadow root.
  await page.evaluate(() => {
    window.menuPresses = 0;
    const foot = document.getElementById('foot');
    for (const type of ['click', 'mousedown', 'pointerdown'])
      foot.addEventListener(type, () => window.menuPresses++);
  });
  const inPlayer = (selector) =>
    page.evaluateHandle(
      (s) => document.querySelector('bx-spotify-player').shadowRoot.querySelector(s),
      selector,
    );
  const before403 = spotify.commands.length;
  await (await inPlayer('.toggle')).click();
  await pause(900);
  await (await inPlayer('.times')).click();
  await pause(200);
  check(
    'pressing the player does not reach X’s menu (no account switcher)',
    (await page.evaluate(() => window.menuPresses)) === 0 &&
      spotify.commands.length === before403 + 1,
    JSON.stringify({
      presses: await page.evaluate(() => window.menuPresses),
      commands: spotify.commands,
    }),
  );

  // The big cover view.
  const coverState = () =>
    page.evaluate(() => {
      const host = document.querySelector('bx-spotify-cover');
      const root = host?.shadowRoot;
      const card = document.querySelector('bx-spotify-player').shadowRoot;
      return {
        open: !!host,
        image: root?.querySelector('.cover')?.src.slice(0, 22) ?? null,
        title: root?.querySelector('.caption strong')?.textContent ?? null,
        controlsInView: !!root?.querySelector('.controls .toggle'),
        controlsInCard: !!card.querySelector('.controls .toggle'),
        size: host ? Math.round(root.querySelector('.cover').getBoundingClientRect().width) : 0,
      };
    });
  spotify.art.length = 0;
  await (await inPlayer('.art')).click();
  await pause(700);
  let c = await coverState();
  check(
    'clicking the cover opens it large, with the title and the controls',
    c.open &&
      c.image === 'data:image/png;base64,' &&
      c.title === 'And 1 : 100 sum' &&
      c.controlsInView &&
      !c.controlsInCard &&
      c.size >= 300,
    JSON.stringify(c),
  );
  check(
    'the full-size cover is fetched by the worker',
    spotify.art.includes('/image/big'),
    spotify.art.join(', '),
  );
  await page.screenshot({ path: path.join(OUT, 'cover.png') });
  const commandsBefore = spotify.commands.length;
  await page.evaluate(() =>
    document
      .querySelector('bx-spotify-cover')
      .shadowRoot.querySelector('.controls .toggle')
      .click(),
  );
  await pause(900);
  check(
    'the controls in the big view work',
    spotify.commands.length === commandsBefore + 1,
    spotify.commands.slice(commandsBefore).join(', '),
  );
  await page.keyboard.press('Escape');
  await pause(200);
  c = await coverState();
  check(
    'Escape closes it and the controls go back to the card',
    !c.open && c.controlsInCard,
    JSON.stringify(c),
  );
  await (await inPlayer('.art')).click();
  await pause(300);
  await page.mouse.click(5, 5);
  await pause(200);
  c = await coverState();
  check(
    'a click outside closes it too, and never reaches X’s menu',
    !c.open && c.controlsInCard && (await page.evaluate(() => window.menuPresses)) === 0,
    JSON.stringify(c),
  );

  // X re-renders its menu: the player puts itself back, once.
  await page.evaluate(() => {
    const foot = document.getElementById('foot');
    const fresh = foot.cloneNode(false);
    const button = document.createElement('button');
    button.dataset.testid = 'SideNav_AccountSwitcher_Button';
    button.textContent = '@someone';
    fresh.append(button);
    foot.replaceWith(fresh);
  });
  await pause();
  p = await player();
  check(
    'after X re-renders its menu the player is back, once',
    p?.count === 1 && p.aboveAccount,
    JSON.stringify(p),
  );

  // No Premium: Spotify refuses a command; the buttons go away and the player says why.
  spotify.product403 = true;
  await press('.toggle');
  await pause(900);
  p = await player();
  check(
    'without Premium the controls are removed and explained',
    p.controls === false && /Premium/.test(p.note ?? '') && p.title === 'And 1 : 100 sum',
    JSON.stringify(p),
  );
  await page.screenshot({
    path: path.join(OUT, 'no-premium.png'),
    clip: { x: 0, y: 500, width: 300, height: 300 },
  });

  // The collapsed (icons-only) menu.
  await page.evaluate(() => (document.querySelector('header').style.width = '88px'));
  await pause();
  const compact = await page.evaluate(() => {
    const root = document.querySelector('bx-spotify-player').shadowRoot;
    return {
      meta: getComputedStyle(root.querySelector('.meta')).display,
      art: getComputedStyle(root.querySelector('.art')).display,
    };
  });
  check(
    'in X’s collapsed menu only the cover remains',
    compact.meta === 'none' && compact.art !== 'none',
    JSON.stringify(compact),
  );
  await page.evaluate(() => (document.querySelector('header').style.width = '275px'));

  const requestsBefore = spotify.commands.length;
  await plugin(false, 'a'.repeat(32));
  await pause();
  check('switched off: the player is removed at once', (await player()) === null);
  const listeners = await page.evaluate(
    () => document.querySelectorAll('bx-spotify-player').length,
  );
  await pause(1200);
  check('and nothing keeps running', listeners === 0 && spotify.commands.length === requestsBefore);

  await plugin(true, 'a'.repeat(32));
  await pause(900);
  p = await player();
  check(
    'switched on again: one player, state restored from storage',
    p?.count === 1 && p.status === 'playing',
    JSON.stringify(p),
  );

  // Disconnect while a slow poll is still out: the poll's answer is about the old connection
  // and must not be shown, and the disconnect must not wait for the next poll.
  spotify.delayGet = 1500;
  await pause(1300);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pause(250);
  await sw.evaluate(() => chrome.storage.local.remove('bx.spotify.auth'));
  await pause(500);
  p = await player();
  check(
    'disconnecting during a poll shows at once',
    p?.status === 'disconnected',
    JSON.stringify(p),
  );
  await pause(1500);
  p = await player();
  check('and the stale poll answer is dropped', p?.status === 'disconnected', JSON.stringify(p));
  spotify.delayGet = 0;

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('plugin smoke ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} plugin checks passed`);
process.exit(failed ? 1 : 0);
