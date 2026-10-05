/** Stops the extension worker mid-download and checks the history still completes. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { page as fixture, ELON } from './fixture.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.resolve(process.argv[2] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke', 'restart');
const DL = path.join(OUT, 'downloads');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile', 'Default'), { recursive: true });
fs.mkdirSync(DL, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'profile', 'Default', 'Preferences'),
  JSON.stringify({ download: { default_directory: DL, prompt_for_download: false } }),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  userDataDir: path.join(OUT, 'profile'),
});
const swTarget = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
);
const extId = new URL(swTarget.url()).host;
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (r) =>
  r.url() === 'https://x.com/home'
    ? r.respond({ status: 200, contentType: 'text/html', body: fixture() })
    : r.url().startsWith('https://x.com/')
      ? r.respond({ status: 204, body: '' })
      : r.continue(),
);
await page.goto('https://x.com/home');
await page.waitForSelector('.sfx-control');
const s = `article[data-post="${ELON}"] .sfx-control`;
await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), s);
await page.click(s);
await page.waitForSelector('#sfx-chip .sfx-chip-action');
// Find the worker's version so it can be stopped from the browser side.
const session = await browser.target().createCDPSession();
const versions = new Map();
session.on('ServiceWorker.workerVersionUpdated', (e) =>
  e.versions.forEach((v) => versions.set(v.versionId, v)),
);
const pageSession = await page.createCDPSession();
pageSession.on('ServiceWorker.workerVersionUpdated', (e) =>
  e.versions.forEach((v) => versions.set(v.versionId, v)),
);
await pageSession
  .send('ServiceWorker.enable')
  .catch((e) => console.log('enable failed', e.message));
await page.click('#sfx-chip .sfx-chip-action');
// Stop the worker as soon as Chrome has accepted the download (its ID is bound).
const watcher = await browser.newPage();
await watcher.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'domcontentloaded' });
let stopped = 'no';
let atStop = null;
for (let i = 0; i < 400; i++) {
  atStop = await watcher
    .evaluate(async () => (await chrome.runtime.sendMessage({ type: 'downloads' })).data[0] ?? null)
    .catch(() => null);
  if (atStop?.chromeId) break;
  await sleep(10);
}
const [item] = atStop?.chromeId
  ? await watcher.evaluate((id) => chrome.downloads.search({ id }), atStop.chromeId)
  : [];
console.log(
  'at stop: record',
  atStop?.status,
  'chrome',
  item?.state,
  `${item?.bytesReceived}/${item?.totalBytes}`,
);
await watcher.close();
const ours = [...versions.values()].filter((v) =>
  v.scriptURL.startsWith(`chrome-extension://${extId}`),
);
for (const v of ours) {
  try {
    await pageSession.send('ServiceWorker.stopWorker', { versionId: v.versionId });
    stopped = `stopped ${v.versionId} (${v.runningStatus})`;
  } catch (e) {
    stopped = 'stop failed: ' + e.message;
  }
}
console.log('worker versions seen:', ours.length, stopped);
await sleep(8000);
// Open the library: reconciliation runs, and the worker restarts if needed.
const panel = await browser.newPage();
await panel.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle0' });
await sleep(1500);
const records = await panel.evaluate(async () =>
  (await chrome.runtime.sendMessage({ type: 'downloads' })).data.map((r) => ({
    status: r.status,
    chromeId: r.chromeId,
    filename: r.filename,
    error: r.error,
  })),
);
console.log('records after restart:', JSON.stringify(records));
const files = fs.existsSync(path.join(DL, 'Better-X'))
  ? fs.readdirSync(path.join(DL, 'Better-X'))
  : [];
console.log('files:', files.join(', '));
console.log(
  records.length === 1 && records[0].status === 'complete' && files.length === 1
    ? 'PASS worker restart'
    : 'FAIL worker restart',
);
await browser.close();
