/**
 * Real-Chrome checks of Account insights (badges, the details card), the country filter (posts and
 * quoted posts, Always Show, modes, reveal, restore) and the account request manager, on an
 * X-shaped page. X's `AboutAccountQuery` is answered by the test with response bodies shaped like
 * the ones X Profile Location recorded from x.com; the extension makes its real same-origin fetch
 * and the test intercepts it. Proves the behavior on this markup and these responses, not
 * compatibility with live x.com (which answers automated browsers with 403).
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'insights');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------------- the fake X */

const PROFILES = {
  alice: {
    id: '101',
    name: 'Alice',
    place: 'Germany',
    source: 'Germany App Store',
    accurate: true,
  },
  bob: { id: '102', name: 'Bob', place: 'United States', source: 'web', accurate: true },
  carol: {
    id: '103',
    name: 'Carol',
    place: 'Nigeria',
    source: 'Nigeria Android App',
    accurate: false,
  },
  dave: { id: '104', name: 'Dave', place: 'Japan', source: 'Japan App Store', accurate: true },
  eve: { id: '105', name: 'Eve' },
  friend: { id: '106', name: 'Friend', place: 'Germany', source: 'web', accurate: true },
  asia: { id: '107', name: 'Asia', place: 'South Asia', source: 'web', accurate: true },
};
const aboutBody = (handle) => {
  const p = PROFILES[handle];
  if (!p)
    return { data: { user_result_by_screen_name: { result: { __typename: 'UserUnavailable' } } } };
  return {
    data: {
      user_result_by_screen_name: {
        result: {
          rest_id: p.id,
          core: { screen_name: handle, name: p.name, created_at: 'Wed Oct 10 20:19:24 +0000 2018' },
          about_profile: p.place
            ? {
                account_based_in: p.place,
                location_accurate: p.accurate,
                source: p.source,
                username_changes: { count: '2' },
              }
            : {},
        },
      },
    },
  };
};

const icon =
  '<svg viewBox="0 0 24 24" width="18.75" height="18.75"><path d="M1 1h22v22H1z"/></svg>';
const actions =
  () => `<div role="group" style="display:flex;justify-content:space-between;max-width:420px">
  ${['reply', 'retweet', 'like', 'bookmark', 'share']
    .map(
      (id) =>
        `<div><button data-testid="${id}" style="width:34px;height:34px;background:none;border:0">${icon}</button></div>`,
    )
    .join('')}</div>`;
const nameBlock = (handle, id) => `<div data-testid="User-Name">
  <div><div><a href="/${handle}" role="link"><span>${PROFILES[handle]?.name ?? handle}</span></a></div></div>
  <div style="display:flex">
    <div><a href="/${handle}" role="link" tabindex="-1"><span>@${handle}</span></a></div>
    <div aria-hidden="true"><span>·</span></div>
    <div><a href="/${handle}/status/${id}" role="link"><time datetime="2024-03-21T00:00:00Z">Mar 21</time></a></div>
  </div></div>`;
const post = ({ id, handle, text, quote }) => `<div data-testid="cellInnerDiv" id="cell-${id}"><div>
  <article data-testid="tweet" role="article" tabindex="0" id="post-${id}" style="padding:12px;border-bottom:1px solid #ddd">
    ${nameBlock(handle, id)}
    <div data-testid="tweetText">${text}</div>
    ${
      quote
        ? `<div role="link" tabindex="0" data-testid="quoteTweet" id="quote-${id}" style="border:1px solid #ccc;margin:8px;padding:8px">
      ${nameBlock(quote.handle, quote.id)}<div data-testid="tweetText">${quote.text}</div></div>`
        : ''
    }
    ${actions()}
  </article></div></div>`;

const TIMELINE = [
  { id: '1100000000000000001', handle: 'alice', text: 'Alice one' },
  { id: '1100000000000000002', handle: 'alice', text: 'Alice two' },
  { id: '1100000000000000003', handle: 'bob', text: 'Bob one' },
  { id: '1100000000000000004', handle: 'carol', text: 'Carol one' },
  {
    id: '1100000000000000005',
    handle: 'dave',
    text: 'Dave quotes Alice',
    quote: { id: '1100000000000000099', handle: 'alice', text: 'Alice quoted' },
  },
  { id: '1100000000000000006', handle: 'eve', text: 'Eve, country unknown' },
  { id: '1100000000000000007', handle: 'friend', text: 'Friend, also Germany' },
  { id: '1100000000000000008', handle: 'asia', text: 'Regional account' },
  {
    id: '1100000000000000009',
    handle: 'bob',
    text: 'Bob quotes Alice',
    quote: { id: '1100000000000000098', handle: 'alice', text: 'Alice quoted again' },
  },
];
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>insights fixture</title></head>
<body style="margin:0;background:#fff;color:#0f1419;font-family:sans-serif">
<div id="layers"></div>
<div id="bx-app" class="app-wide" style="display:flex"><main data-testid="primaryColumn" style="width:600px">
${TIMELINE.map(post).join('')}<div style="height:1400px"></div></main></div></body></html>`;

/* --------------------------------------------------------------------------- browser */

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
  args: ['--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 1100 },
});
const worker = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const sw = await worker.worker();
const pageErrors = [];

/** Requests X would have seen, by handle, and what to answer. */
let hits = {};
let answer = (handle) => ({ status: 200, body: aboutBody(handle) });

const configure = ({ features = {}, lookup = 'visible', filter = {}, values = {} } = {}) =>
  sw.evaluate(
    (features, lookup, filter, values) =>
      chrome.storage.local.set({
        'bx.settings': {
          version: 5,
          features,
          values,
          insights: { lookup },
          filter: {
            countries: [],
            mode: 'collapse',
            posts: true,
            quotes: true,
            alwaysShow: [],
            ...filter,
          },
        },
      }),
    features,
    lookup,
    filter,
    values,
  );
const clearCache = () =>
  sw.evaluate(() => chrome.storage.local.remove(['bx.accounts', 'bx.accounts.cooldown']));
const cached = () =>
  sw.evaluate(async () => {
    const stored = (await chrome.storage.local.get('bx.accounts'))['bx.accounts'];
    return stored ? Object.keys(stored.entries).sort() : [];
  });

async function open() {
  hits = {};
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource/.test(m.text()) &&
      pageErrors.push(m.text()),
  );
  await page.setCookie({ name: 'ct0', value: 'smoketoken', url: 'https://x.com/' });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('https://x.com/')) return req.continue();
    if (url === 'https://x.com/home')
      return req.respond({ status: 200, contentType: 'text/html', body: PAGE });
    const match = /AboutAccountQuery\?variables=([^&]+)/.exec(url);
    if (match) {
      const handle = JSON.parse(decodeURIComponent(match[1])).screenName;
      hits[handle] = (hits[handle] ?? 0) + 1;
      const { status, body, headers } = answer(handle);
      return req.respond({
        status,
        contentType: 'application/json',
        headers: headers ?? {},
        body: JSON.stringify(body),
      });
    }
    return req.respond({ status: 204, body: '' });
  });
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.bx-control').length >= 5, {
    timeout: 15000,
    polling: 50,
  });
  return page;
}
const until = (page, fn, arg, timeout = 8000) =>
  page.waitForFunction(fn, { timeout, polling: 50 }, arg);
const hidden = (page, id) =>
  page.evaluate(
    (id) => !document.getElementById(id).checkVisibility({ visibilityProperty: true }),
    id,
  );
const shown = async (page, id) => !(await hidden(page, id));
const badgeOf = (page, id) =>
  page.evaluate((id) => {
    const b = document.querySelector(`#${id} .bx-acct`);
    return b
      ? {
          text: b.textContent.trim(),
          state: b.dataset.state,
          tag: b.tagName,
          label: b.getAttribute('aria-label'),
          items: [...b.querySelectorAll('.bx-acct-item')].map((i) => i.dataset.kind),
        }
      : null;
  }, id);
const count = (page, selector) =>
  page.evaluate((s) => document.querySelectorAll(s).length, selector);

/* ----------------------------------------------------------------------------- 1. badges */

console.log('— Account badges');
await configure({
  features: {
    'insights.flags': true,
    'insights.connection': true,
    'insights.warnings': true,
    'insights.details': true,
  },
  lookup: 'visible',
});
let page = await open();
await until(page, () => document.querySelectorAll('.bx-acct[data-state="loaded"]').length >= 9);
check(
  'automatic mode: every post with an answer gets one badge',
  (await count(page, '.bx-acct[data-state="loaded"]')) >= 8,
);
check(
  'one request per account, not per post (alice shows in 4 posts and quotes)',
  Object.values(hits).every((n) => n === 1) && hits.alice === 1,
  JSON.stringify(hits),
);
check(
  'no duplicate badge in any post',
  await page.evaluate(() =>
    [...document.querySelectorAll('article')].every(
      (a) => a.querySelectorAll(':scope > [data-testid="User-Name"] .bx-acct').length <= 1,
    ),
  ),
);
const alice = await badgeOf(page, 'post-1100000000000000001');
check(
  'Germany flag + Apple mark for an App Store account',
  alice?.text.includes('🇩🇪') && alice.items.join() === 'flag,connection',
  JSON.stringify(alice),
);
const bob = await badgeOf(page, 'post-1100000000000000003');
check(
  'United States flag + Web mark',
  bob?.text.includes('🇺🇸') && bob.items.join() === 'flag,connection',
);
const carol = await badgeOf(page, 'post-1100000000000000004');
check(
  'Android mark and a location warning when X says the location may be inaccurate',
  carol?.items.join() === 'flag,connection,warning',
  JSON.stringify(carol),
);
const eve = await badgeOf(page, 'post-1100000000000000006');
check(
  'an account X gave no country for shows no flag (nothing invented)',
  !eve || !eve.items.includes('flag'),
  JSON.stringify(eve),
);
const regional = await badgeOf(page, 'post-1100000000000000008');
check(
  'a region label shows a region pin, not a flag',
  regional?.items[0] === 'region',
  JSON.stringify(regional),
);
check(
  'the badge sits after the @handle in the name row, outside every link',
  await page.evaluate(() => {
    const b = document.querySelector('#post-1100000000000000001 .bx-acct');
    const handle = [
      ...document.querySelectorAll('#post-1100000000000000001 [data-testid="User-Name"] a'),
    ].find((a) => a.textContent.startsWith('@'));
    return (
      !b.closest('a') &&
      !!(
        handle.parentElement.nextElementSibling === b ||
        handle.parentElement.parentElement.contains(b)
      )
    );
  }),
);
check(
  'the badge does not wrap or push the Save control',
  await page.evaluate(() => {
    const b = document.querySelector('#post-1100000000000000001 .bx-acct');
    const row = b.parentElement;
    return b.getBoundingClientRect().height < 30 && row.getBoundingClientRect().height < 40;
  }),
);
check('the Save control is on every post', (await count(page, '.bx-control')) >= 9);
await page.screenshot({ path: path.join(OUT, 'badges.png') });

console.log('— Details card');
await page.evaluate(() => document.querySelector('#post-1100000000000000001 .bx-acct').click());
await until(page, () => document.getElementById('bx-acctcard'));
const card = await page.evaluate(() => {
  const c = document.getElementById('bx-acctcard');
  const r = c.getBoundingClientRect();
  return {
    labels: [...c.querySelectorAll('.bx-acct-term')].map((n) => n.textContent),
    text: c.textContent,
    inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
    role: c.getAttribute('role'),
    expanded: document
      .querySelector('#post-1100000000000000001 .bx-acct')
      .getAttribute('aria-expanded'),
  };
});
check(
  'the card lists only known rows',
  card.labels.join() === 'Based in,Connected via,Joined,Username changes',
  card.labels.join(),
);
check(
  'the card names the platform and explains what the location means',
  /Apple App Store/.test(card.text) &&
    /not nationality/.test(card.text) &&
    /not the app used for any one post/.test(card.text),
);
check(
  'the card is a dialog fully inside the viewport and marks its badge expanded',
  card.role === 'dialog' && card.inView && card.expanded === 'true',
);
await page.screenshot({ path: path.join(OUT, 'card.png') });
await page.keyboard.press('Escape');
check(
  'Escape closes the card and returns focus to the badge',
  !(await page.evaluate(() => !!document.getElementById('bx-acctcard'))) &&
    (await page.evaluate(() => document.activeElement?.classList.contains('bx-acct'))),
);
await page.evaluate(() => document.querySelector('#post-1100000000000000004 .bx-acct').click());
await until(page, () => document.getElementById('bx-acctcard'));
check(
  'a location warning appears as a card row, worded as X reporting it',
  await page.evaluate(() =>
    /X reports possible uncertainty/.test(document.getElementById('bx-acctcard').textContent),
  ),
);
// Refresh one account.
const before = hits.carol;
await page.evaluate(() => document.querySelector('.bx-acct-refresh').click());
await sleep(1200);
check(
  'Refresh asks X again for that account only',
  hits.carol === before + 1 && hits.alice === 1,
  JSON.stringify(hits),
);
await page.keyboard.press('Escape');
// Re-render safety: the card follows X replacing the post.
await page.evaluate(() => document.querySelector('#post-1100000000000000001 .bx-acct').click());
await until(page, () => document.getElementById('bx-acctcard'));
await page.evaluate(() => document.getElementById('cell-1100000000000000001').remove());
await sleep(600);
check(
  'the card closes when its post is removed by X',
  !(await page.evaluate(() => !!document.getElementById('bx-acctcard'))),
);

console.log('— Switching off restores the page');
await configure({ features: {}, lookup: 'visible' });
await until(page, () => document.querySelectorAll('.bx-acct').length === 0);
check(
  'turning every Account insights switch off removes every badge',
  (await count(page, '.bx-acct')) === 0,
);
await page.close();

/* ------------------------------------------------------------------------- 2. lookups */

console.log('— Lookup modes');
await clearCache();
await configure({ features: { 'insights.flags': true }, lookup: 'hover' });
page = await open();
await until(page, () => document.querySelectorAll('.bx-acct[data-state="idle"]').length >= 5);
await sleep(800);
check(
  'hover mode: a globe control per post and no request yet',
  Object.keys(hits).length === 0 && (await count(page, '.bx-acct[data-state="idle"]')) >= 5,
  JSON.stringify(hits),
);
const box = await page.evaluate(() => {
  const r = document.querySelector('#post-1100000000000000003 .bx-acct').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await until(page, () =>
  document.querySelector('#post-1100000000000000003 .bx-acct[data-state="loaded"]'),
);
check(
  'resting the pointer on the globe looks that account up, only that one',
  hits.bob === 1 && Object.keys(hits).length === 1,
  JSON.stringify(hits),
);
check(
  '…and its flag appears',
  (await badgeOf(page, 'post-1100000000000000003'))?.text.includes('🇺🇸'),
);
await page.close();

await clearCache();
await configure({ features: { 'insights.flags': true }, lookup: 'manual' });
page = await open();
await until(page, () => document.querySelectorAll('.bx-acct[data-state="idle"]').length >= 5);
await page.mouse.move(box.x, box.y);
await sleep(900);
check('manual mode: pointing does nothing', Object.keys(hits).length === 0);
await page.evaluate(() => document.querySelector('#post-1100000000000000004 .bx-acct').click());
await until(page, () =>
  document.querySelector('#post-1100000000000000004 .bx-acct[data-state="loaded"]'),
);
check(
  'manual mode: a click looks the account up',
  hits.carol === 1 && Object.keys(hits).length === 1,
);
check(
  'a click on a badge does not open the post (the page stays on /home)',
  page.url() === 'https://x.com/home',
);
await page.close();

console.log('— Cache, failures, rate limits');
await clearCache();
await configure({ features: { 'insights.flags': true }, lookup: 'visible' });
page = await open();
await until(page, () => document.querySelectorAll('.bx-acct[data-state="loaded"]').length >= 8);
await sleep(3500);
const stored = await cached();
check(
  'answers are stored for other tabs and later visits',
  stored.includes('alice') && stored.includes('bob'),
  stored.join(),
);
await page.close();
const warm = hits;
page = await open();
await until(page, () => document.querySelectorAll('.bx-acct[data-state="loaded"]').length >= 8);
await sleep(600);
check(
  'a warm cache: reopening the page asks X for nothing',
  Object.keys(hits).length === 0,
  JSON.stringify(hits),
);
void warm;
// Clearing the cache empties it everywhere and the visible posts are asked for again.
await sw.evaluate(() => chrome.storage.local.remove('bx.accounts'));
for (let i = 0; i < 300 && Object.keys(hits).length < 5; i++) await sleep(50);
check(
  'clearing the cache makes the posts on screen look their accounts up again',
  Object.keys(hits).length >= 5,
  JSON.stringify(hits),
);
await page.close();

await clearCache();
answer = (handle) =>
  handle === 'alice'
    ? {
        status: 429,
        body: {},
        headers: { 'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 90) },
      }
    : { status: 200, body: aboutBody(handle) };
page = await open();
await sleep(3000);
const afterLimit = { ...hits };
await sleep(2500);
check(
  'a 429 pauses all lookups until the reset X reported',
  JSON.stringify(hits) === JSON.stringify(afterLimit) && (hits.alice ?? 0) === 1,
  JSON.stringify(hits),
);
check(
  '…and the page stays usable, with no badge invented for the limited account',
  (await badgeOf(page, 'post-1100000000000000002')) === null &&
    (await count(page, '.bx-control')) >= 9,
);
const cooldown = await sw.evaluate(
  async () => (await chrome.storage.local.get('bx.accounts.cooldown'))['bx.accounts.cooldown'],
);
check(
  'the cooldown is shared with other tabs through storage',
  typeof cooldown === 'number' && cooldown > Date.now(),
);
await page.close();
answer = (handle) => ({ status: 200, body: aboutBody(handle) });
await clearCache();

/* ---------------------------------------------------------------- 3. country filtering */

console.log('— Country filter: posts');
await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['Germany'], mode: 'collapse', alwaysShow: [{ handle: 'friend' }] },
});
page = await open();
await until(page, () => document.querySelectorAll('[data-bx-filter="collapse"]').length >= 2);
check(
  'posts from a selected country collapse; Always Show and others stay',
  (await hidden(page, 'post-1100000000000000001')) &&
    (await hidden(page, 'post-1100000000000000002')) &&
    (await shown(page, 'post-1100000000000000003')) &&
    (await shown(page, 'post-1100000000000000007')) &&
    (await shown(page, 'post-1100000000000000006')),
);
check(
  'an account X gave no country for, and a region, are not filtered',
  (await shown(page, 'post-1100000000000000006')) &&
    (await shown(page, 'post-1100000000000000008')),
);
const ph = await page.evaluate(() => {
  const cell = document.getElementById('cell-1100000000000000001');
  const card = cell.querySelector('.bx-filter-card');
  const r = card.getBoundingClientRect();
  return {
    text: card.textContent,
    shown: card.checkVisibility(),
    h: r.height,
    inCell: cell.contains(card),
    nodeKept: !!document.getElementById('post-1100000000000000001'),
  };
});
check(
  'the placeholder names the reason and offers Show post; the post node is kept',
  /Post hidden by Better X/.test(ph.text) &&
    /Country: Germany/.test(ph.text) &&
    /Show post/.test(ph.text) &&
    ph.shown &&
    ph.inCell &&
    ph.nodeKept,
  ph.text,
);
check(
  'the placeholder is compact (the timeline does not collapse or jump)',
  ph.h > 30 && ph.h < 120,
  String(ph.h),
);
await page.screenshot({ path: path.join(OUT, 'collapsed.png') });
check(
  'Always Show was resolved to the account id and saved',
  await (async () => {
    await sleep(1500);
    return sw.evaluate(async () =>
      (await chrome.storage.local.get('bx.settings'))['bx.settings'].filter.alwaysShow.some(
        (e) => e.handle === 'friend' && e.id === '106',
      ),
    );
  })(),
);
await page.evaluate(() =>
  document.querySelector('#cell-1100000000000000001 .bx-filter-card button').click(),
);
await sleep(300);
check(
  'Show post reveals just that post',
  (await shown(page, 'post-1100000000000000001')) &&
    (await hidden(page, 'post-1100000000000000002')),
);
check(
  'the revealed post still has its Save control',
  await page.evaluate(() => !!document.querySelector('#post-1100000000000000001 .bx-control')),
);

await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['Germany'], mode: 'hide' },
});
await until(page, () => document.querySelectorAll('[data-bx-filter="hide"]').length >= 2);
check(
  'hide mode: no placeholder',
  (await count(page, '.bx-filter-card')) === 0 && (await hidden(page, 'post-1100000000000000002')),
);
await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['Germany'], mode: 'highlight' },
});
await until(page, () => document.querySelectorAll('[data-bx-filter="highlight"]').length >= 2);
check(
  'highlight mode: shown and marked',
  (await shown(page, 'post-1100000000000000002')) && (await count(page, '.bx-filter-card')) === 0,
);
await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['South Asia'], mode: 'collapse' },
});
await until(page, () => document.querySelector('#cell-1100000000000000008[data-bx-filter]'));
check(
  'a region label matches only that region',
  (await hidden(page, 'post-1100000000000000008')) &&
    (await shown(page, 'post-1100000000000000001')),
);
await configure({ features: {}, lookup: 'hover', filter: { countries: ['Germany'] } });
await until(
  page,
  () => document.querySelectorAll('[data-bx-filter], .bx-filter-card').length === 0,
);
check(
  'turning the filter off restores every post',
  (await count(page, '[data-bx-filter], [data-bx-quote], .bx-filter-card')) === 0 &&
    (await shown(page, 'post-1100000000000000002')),
);
await page.close();

console.log('— Country filter: quoted posts');
await clearCache();
await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['Germany'], mode: 'collapse' },
});
page = await open();
await until(page, () => document.querySelectorAll('[data-bx-quote="collapse"]').length >= 2);
check(
  'Dave (Japan) quoting Alice (Germany): the post stays, only the quote collapses',
  (await shown(page, 'post-1100000000000000005')) &&
    (await hidden(page, 'quote-1100000000000000005')),
);
const qph = await page.evaluate(() => {
  const block = document.getElementById('quote-1100000000000000005');
  const card = block.nextElementSibling;
  return { cls: card?.className, text: card?.textContent, shown: card?.checkVisibility() };
});
check(
  'a small placeholder replaces the quote, naming the reason',
  /bx-filter-card/.test(qph.cls) &&
    /Quoted post hidden by Better X/.test(qph.text) &&
    /Country: Germany/.test(qph.text) &&
    /Show quoted post/.test(qph.text) &&
    qph.shown,
  qph.text,
);
check(
  'the parent author’s country is not given to the quoted author, nor the reverse',
  (await shown(page, 'post-1100000000000000003')) &&
    (await shown(page, 'post-1100000000000000009')) &&
    (await hidden(page, 'quote-1100000000000000009')),
);
check(
  'the quoting post’s Save control is still there and works around the placeholder',
  await page.evaluate(() => !!document.querySelector('#post-1100000000000000005 .bx-control')),
);
// Saving a post whose quote is collapsed keeps the quoted post.
await page.evaluate(() => document.querySelector('#post-1100000000000000005 .bx-control').click());
await sleep(1500);
const libraryPage = await browser.newPage();
await libraryPage.goto(`chrome-extension://${new URL(worker.url()).host}/sidepanel.html`, {
  waitUntil: 'networkidle2',
});
const saved = await libraryPage.evaluate(async () => {
  const { data } = await chrome.runtime.sendMessage({ type: 'list' });
  return data.bookmarks.find((b) => b.tweetId === '1100000000000000005');
});
await libraryPage.close();
check(
  'Saved keeps the quoted post (its author and text) although the quote is collapsed',
  saved?.quote?.authorHandle === 'alice' && /Alice quoted/.test(saved.quote.text ?? ''),
  JSON.stringify(saved?.quote),
);
check(
  'the saved text is the post’s own, not the placeholder’s',
  saved &&
    !/hidden by Better X/.test(saved.text ?? '') &&
    !/hidden by Better X/.test(saved.quote?.text ?? ''),
);
await page.evaluate(() =>
  document.querySelector('#quote-1100000000000000005 + .bx-filter-card button').click(),
);
await sleep(300);
check(
  'Show quoted post reveals only that quote',
  (await shown(page, 'quote-1100000000000000005')) &&
    (await hidden(page, 'quote-1100000000000000009')),
);
await configure({
  features: { 'filtering.country': true },
  lookup: 'hover',
  filter: { countries: ['Germany'], quotes: false },
});
await sleep(700);
check(
  'quoted posts can be left out of the filter',
  (await count(page, '[data-bx-quote="collapse"]')) === 0 &&
    (await hidden(page, 'post-1100000000000000001')),
);
await configure({ features: {}, lookup: 'hover' });
await until(
  page,
  () =>
    document.querySelectorAll('[data-bx-filter], [data-bx-quote], .bx-filter-card').length === 0,
);
check(
  'switching the filter off restores quotes too',
  (await shown(page, 'quote-1100000000000000009')) &&
    (await shown(page, 'quote-1100000000000000005')),
);
await page.close();

console.log('— Narrow layout');
await clearCache();
await configure({
  features: { 'insights.flags': true, 'filtering.country': true },
  lookup: 'visible',
  filter: { countries: ['Germany'] },
});
page = await open();
await page.setViewport({ width: 380, height: 900 });
await until(page, () => document.querySelectorAll('.bx-acct[data-state="loaded"]').length >= 5);
check(
  'narrow: no horizontal scroll and badges stay on one line',
  await page.evaluate(
    () =>
      document.documentElement.scrollWidth <= innerWidth + 1 &&
      [...document.querySelectorAll('.bx-acct')].every(
        (b) => b.getBoundingClientRect().height < 30,
      ),
  ),
);
await page.screenshot({ path: path.join(OUT, 'narrow.png') });
await page.close();

/* ------------------------------------------------------------------------- 4. the panel */

console.log('— Side panel controls');
const extId = new URL(worker.url()).host;
const panel = await browser.newPage();
panel.on('pageerror', (e) => pageErrors.push(String(e)));
await panel.setViewport({ width: 400, height: 1000 });
await configure({ features: {}, lookup: 'hover' });
await panel.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle2' });
await panel.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => /Customize/.test(b.textContent))?.click(),
);
await panel.waitForSelector('section[data-category="filtering"]', { timeout: 8000 });
await panel.evaluate(() => document.querySelector('#group-filtering').click());
await panel.waitForSelector('[data-panel="filtering"]', { visible: true, timeout: 5000 });
await panel.type('input[role="combobox"]', 'germ');
await panel.keyboard.press('Enter');
await panel.waitForFunction(
  () => document.querySelector('.chip-row li')?.textContent.includes('Germany'),
  { timeout: 5000 },
);
await panel.type('.handle-form input', '@Friend');
await panel.keyboard.press('Enter');
await sleep(400);
const fromPanel = await sw.evaluate(
  async () => (await chrome.storage.local.get('bx.settings'))['bx.settings'].filter,
);
check(
  'the panel stores the country and the Always Show handle',
  fromPanel.countries.join() === 'Germany' &&
    fromPanel.alwaysShow.some((e) => e.handle === 'friend'),
  JSON.stringify(fromPanel),
);
await panel.screenshot({ path: path.join(OUT, 'panel.png') });
check(
  'the panel fits at 400px without sideways scroll',
  await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
);
await panel.close();

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
