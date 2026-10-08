/**
 * Performance baseline: loads the same X-shaped timeline with and without the built extension
 * and records browser metrics over repeated runs. A measurement, not a pass/fail test.
 *
 * Fully offline: x.com serves the fixture, twimg.com images are a local 1x1 PNG, and every other
 * request is aborted. Each run uses a fresh browser and profile; modes alternate (off, on, off,
 * on, …) so slow drift on the machine affects both equally.
 *
 * `--shape x` serves the same 200 posts inside X's shell (timeline cells, tweet test IDs, action
 * rows, navigation, sidebar) so customization rules have elements to match, and
 * `--features default,typical,all` adds extension modes with those customizations switched on.
 *
 * Usage: npm run build && node scripts/perf/run.mjs [--runs N] [--out file.json] [--shape x]
 *        [--features default,typical,all] [extension dir]
 * Default output: perf/runs/<timestamp>.json (git-ignored). CHROME_PATH overrides Chrome.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { photo, post } from '../smoke/fixture.mjs';
import { actionRow, catalogPage, cell, tweetArticle } from '../smoke/catalog-fixture.mjs';
import { COVERED_ELSEWHERE, SCENARIOS } from '../smoke/catalog-spec.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const [value] = args.splice(index, 2).slice(1);
  return value;
};
const RUNS = Number(option('--runs') ?? process.env.PERF_RUNS ?? 5);
const OUT = option('--out');
const SHAPE = option('--shape') ?? 'plain';
const FEATURE_MODES = option('--features')?.split(',') ?? null;
if (!['plain', 'x'].includes(SHAPE)) throw new Error(`--shape is plain or x, not ${SHAPE}`);
const EXT = path.resolve(args[0] ?? path.join(ROOT, '.output/chrome-mv3'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Timeline shape: an initial page of posts, then batches appended as the page scrolls. */
const INITIAL = 20;
const BATCH = 20;
const BATCHES = 9; // 20 + 9 × 20 = 200 posts
const TOTAL = INITIAL + BATCH * BATCHES;
/** The injected save control. `.sfx-control` is the Saved for X 0.2.0 name, kept so the
 * baseline build (perf/baseline-0.2.0.json) can still be measured side by side. */
const CONTROL = '.bx-control, .sfx-control';

/** What each customization mode switches on. `typical` is the Minimal quick setup. */
const TYPICAL = [
  'cleanup.hideAds',
  'cleanup.hideGrok',
  'cleanup.hideGrokImageEdit',
  'cleanup.hideGrokPosts',
  'cleanup.hidePremiumUpsells',
  'cleanup.hideSubscriptions',
  'feed.hideInlinePrompts',
  'feed.hideSuggestedModules',
  'navigation.hidePremium',
  'navigation.hideBusiness',
  'sidebar.hidePremiumPromo',
  'sidebar.hideWhoToFollow',
  'navigation.hideCommunities',
  'navigation.hideJobs',
  'navigation.hideConnect',
  'navigation.hideSpaces',
  'navigation.hideHistory',
  'navigation.hideCreatorStudio',
  'navigation.hideBadges',
  'feed.hideNewPostsPill',
  'feed.hideManageTimelines',
  'feed.hideProfileSuggestions',
  'posts.hideViews',
  'posts.hideReplyCount',
  'posts.hideRepostCount',
  'posts.hideLikeCount',
  'posts.hideBookmarkCount',
  'posts.hideFollowCounts',
  'posts.hideVerifiedBadges',
  'sidebar.keepOnlySearch',
  'sidebar.hideFooter',
];
const ALL = [...new Set([...SCENARIOS.map((scenario) => scenario.feature), ...COVERED_ELSEWHERE])];
/** default, typical, all, cat:<category> (one whole category), or ids:<id>+<id>. */
const featureSet = (name) =>
  name === 'typical'
    ? TYPICAL
    : name === 'all'
      ? ALL
      : name === 'default'
        ? []
        : name.startsWith('cat:')
          ? ALL.filter((id) => id.startsWith(`${name.slice(4)}.`))
          : name.startsWith('ids:')
            ? name.slice(4).split('+')
            : null;
if (FEATURE_MODES)
  for (const name of FEATURE_MODES)
    if (!featureSet(name))
      throw new Error(
        `--features takes default, typical, all, cat:<category>, ids:<a>+<b>; not ${name}`,
      );

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function postHtml(index) {
  const id = String(1100000000000100000n + BigInt(index));
  const handle = `user${index % 17}`;
  const media =
    index % 3 === 0 ? photo(`PerfMedia${String(index).padStart(6, '0')}`, 1, id, handle) : '';
  const text = `Performance fixture post ${index}`;
  if (SHAPE === 'x')
    return cell(
      `p${index}`,
      tweetArticle(post({ id, handle, text, media, rowHtml: actionRow(index) })),
    );
  return post({ id, handle, text, media });
}

const APPEND = (batches) => `<script>
    const batches = ${JSON.stringify(batches)};
    let next = 0;
    // Appends the next batch the way an infinite timeline does; driven by the harness, not timers.
    window.__appendBatch = () => {
      if (next >= batches.length) return false;
      document.getElementById('timeline').insertAdjacentHTML('beforeend', batches[next++]);
      return true;
    };
  </script>`;

function fixture() {
  const batches = Array.from({ length: BATCHES }, (_, b) =>
    Array.from({ length: BATCH }, (_, i) => postHtml(INITIAL + b * BATCH + i)).join(''),
  );
  if (SHAPE === 'x') {
    const timeline = Array.from({ length: INITIAL }, (_, i) => postHtml(i)).join('');
    return catalogPage({ timeline, extras: false }).replace('</body>', `${APPEND(batches)}</body>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>X perf fixture</title></head>
  <body style="margin:0;background:#fff;color:#0f1419;font-family:sans-serif">
  <main id="timeline" style="width:600px;margin:0 auto">
  ${Array.from({ length: INITIAL }, (_, i) => postHtml(i)).join('')}
  </main>
  ${APPEND(batches)}
  </body></html>`;
}

const PAGE = fixture();
const METRICS = [
  'ScriptDuration',
  'TaskDuration',
  'RecalcStyleDuration',
  'LayoutDuration',
  'JSHeapUsedSize',
  'Nodes',
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(withExtension, features = []) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bx-perf-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    pipe: true,
    userDataDir: profile,
    ...(withExtension ? { enableExtensions: [EXT] } : {}),
    args: ['--window-size=1280,900', '--no-first-run', '--no-default-browser-check'],
    defaultViewport: { width: 1280, height: 900 },
  });
  try {
    if (withExtension) {
      const target = await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
      );
      if (features.length) {
        const worker = await target.worker();
        const on = Object.fromEntries(features.map((id) => [id, true]));
        await worker.evaluate(
          (features) => chrome.storage.local.set({ 'bx.settings': { version: 3, features } }),
          on,
        );
      }
    }
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.href === 'https://x.com/home')
        return request.respond({ status: 200, contentType: 'text/html', body: PAGE });
      if (/(^|\.)twimg\.com$/.test(url.hostname))
        return request.respond({ status: 200, contentType: 'image/png', body: PNG });
      if (url.hostname === 'x.com') return request.respond({ status: 204, body: '' });
      return request.abort();
    });
    await page.evaluateOnNewDocument(() => {
      window.__longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    });
    const cdp = await page.createCDPSession();
    await cdp.send('Performance.enable');

    const started = Date.now();
    await page.goto('https://x.com/home', { waitUntil: 'load' });
    const controls = () => page.evaluate((c) => document.querySelectorAll(c).length, CONTROL);
    const waitControls = async (count) => {
      if (!withExtension) return;
      await page.waitForFunction(
        (n, c) => document.querySelectorAll(c).length >= n,
        {
          timeout: 15000,
          polling: 'raf',
        },
        count,
        CONTROL,
      );
    };
    await waitControls(INITIAL);
    const initialMs = Date.now() - started;

    // Scroll through the timeline, appending a batch at each step, as a reader would.
    const scrollStarted = Date.now();
    for (let batch = 0; batch < BATCHES; batch++) {
      await page.evaluate(() => window.__appendBatch());
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await waitControls(INITIAL + (batch + 1) * BATCH);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
    }
    const scrollMs = Date.now() - scrollStarted;
    // Let trailing frames and idle work settle so they count consistently in both modes.
    await sleep(500);

    const { metrics } = await cdp.send('Performance.getMetrics');
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
    const longTasks = await page.evaluate(() => window.__longTasks);
    const result = {
      initialMs,
      scrollMs,
      controls: await controls(),
      longTaskCount: longTasks.length,
      longTaskTotalMs: Math.round(longTasks.reduce((a, b) => a + b, 0)),
    };
    for (const name of METRICS) {
      const value = byName[name] ?? null;
      // Durations are reported in seconds; store milliseconds. Heap in MB.
      result[name] =
        value === null
          ? null
          : name.endsWith('Duration')
            ? +(value * 1000).toFixed(1)
            : name === 'JSHeapUsedSize'
              ? +(value / 1048576).toFixed(2)
              : value;
    }
    if (withExtension && result.controls !== TOTAL)
      throw new Error(`expected ${TOTAL} save controls, found ${result.controls}`);
    return result;
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

function summarize(runs) {
  const keys = Object.keys(runs[0]);
  return Object.fromEntries(
    keys.map((key) => {
      const values = runs.map((r) => r[key]).filter((v) => typeof v === 'number');
      if (!values.length) return [key, null];
      const sorted = [...values].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      return [
        key,
        {
          median: +median.toFixed(2),
          min: sorted[0],
          max: sorted.at(-1),
          cvPercent: mean ? +((sd / mean) * 100).toFixed(1) : 0,
        },
      ];
    }),
  );
}

if (!fs.existsSync(path.join(EXT, 'manifest.json')))
  throw new Error(`No built extension at ${EXT}. Run npm run build first.`);
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
/** Without --features there are two modes, as always; with it, one extension mode per name. */
const MODES = FEATURE_MODES
  ? [
      { name: 'off', extension: false },
      ...FEATURE_MODES.map((name) => ({
        name: `on:${name}`,
        extension: true,
        features: featureSet(name),
      })),
    ]
  : [
      { name: 'off', extension: false },
      { name: 'on', extension: true, features: [] },
    ];
const results = Object.fromEntries(MODES.map((mode) => [mode.name, []]));
for (let i = 0; i < RUNS; i++) {
  for (const mode of MODES) {
    const result = await run(mode.extension, mode.features);
    results[mode.name].push(result);
    console.log(`run ${i + 1}/${RUNS} ${mode.name.padEnd(10)} ${JSON.stringify(result)}`);
  }
}

const summaries = Object.fromEntries(
  MODES.map((mode) => [mode.name, summarize(results[mode.name])]),
);
const off = summaries.off;
const medians = (name, base) =>
  Object.fromEntries(
    Object.keys(summaries[name])
      .filter((key) => summaries[name][key] && summaries[base][key])
      .map((key) => [key, +(summaries[name][key].median - summaries[base][key].median).toFixed(2)]),
  );
const onName = MODES[1].name;
const on = summaries[onName];
const delta = medians(onName, 'off');
const deltas = Object.fromEntries(
  MODES.slice(1).map((mode) => [
    mode.name,
    { vsOff: medians(mode.name, 'off'), vsDefault: medians(mode.name, onName) },
  ]),
);
const chrome = await (async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true });
  const version = await browser.version();
  await browser.close();
  return version;
})();

const report = {
  extension: { name: manifest.name, version: manifest.version },
  recordedAt: new Date().toISOString(),
  environment: {
    chrome,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpus: os.cpus()[0]?.model,
    node: process.version,
  },
  fixture: {
    shape: SHAPE,
    posts: TOTAL,
    initial: INITIAL,
    batch: BATCH,
    batches: BATCHES,
    photoEvery: 3,
  },
  ...(FEATURE_MODES
    ? {
        featureModes: Object.fromEntries(
          MODES.filter((m) => m.features).map((m) => [m.name, m.features.length]),
        ),
      }
    : {}),
  runsPerMode: RUNS,
  units: {
    initialMs: 'navigation start to load (+ all initial save controls when on)',
    scrollMs: 'append 9 batches and scroll (+ controls for each batch when on)',
    durations: 'ms (CDP Performance.getMetrics, whole page lifetime)',
    JSHeapUsedSize: 'MB (page main world; content script worlds share the heap)',
  },
  summary: FEATURE_MODES ? { ...summaries, deltas } : { off, on, deltaOfMedians: delta },
  runs: results,
};

const out = OUT
  ? path.resolve(OUT)
  : path.join(ROOT, 'perf', 'runs', `${report.recordedAt.replace(/[:.]/g, '-')}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
if (FEATURE_MODES) {
  const names = MODES.map((mode) => mode.name);
  console.log(`\nmedian (cv%)         ${names.map((n) => n.padEnd(17)).join('')}`);
  for (const key of Object.keys(summaries[onName])) {
    if (!summaries[onName][key]) continue;
    const cells = names.map((n) =>
      `${summaries[n][key].median} (${summaries[n][key].cvPercent}%)`.padEnd(17),
    );
    console.log(`${key.padEnd(21)}${cells.join('')}`);
  }
} else {
  console.log('\nmedian (cv%)         off              on               delta');
  for (const key of Object.keys(on)) {
    if (!on[key] || !off[key]) continue;
    const cell = (s) => `${s.median} (${s.cvPercent}%)`.padEnd(17);
    console.log(`${key.padEnd(21)}${cell(off[key])}${cell(on[key])}${delta[key]}`);
  }
}
console.log(`\nwrote ${path.relative(ROOT, out)}`);
