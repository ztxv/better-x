# Performance baseline

`npm run perf` builds the extension and runs `scripts/perf/run.mjs`. Pass `--runs N` (default 5) or `--out file.json` to the script directly; without `--out`, results go to `perf/runs/` (git-ignored).

## Method

- Fixture: an X-shaped page served at `https://x.com/home` through request interception, built from the smoke-test post markup. 20 posts load first, then 9 batches of 20 are appended while the page scrolls, for 200 posts; every third post has a photo. Fully offline: `twimg.com` images are a local 1x1 PNG and every other request is aborted.
- Each run launches a fresh headless Chrome with a fresh profile. Modes alternate (off, on, off, on, …) so machine drift affects both. "On" loads `.output/chrome-mv3`; "off" loads nothing.
- With the extension, each step waits until every post has its save control, and a run fails if any control is missing.
- Metrics: CDP `Performance.getMetrics` at the end of the run (`ScriptDuration`, `TaskDuration`, `RecalcStyleDuration`, `LayoutDuration` in ms over the page lifetime; `JSHeapUsedSize` in MB; DOM `Nodes`), long tasks from a `PerformanceObserver`, and wall-clock `initialMs` / `scrollMs`. Content scripts run on the page's main thread and heap, so their cost is included.
- Reported per metric: median, min, max, and coefficient of variation; plus on − off delta of medians.

## Baseline: Saved for X 0.2.0 (2026-10-04)

Chrome 154 headless, macOS (Apple M4), 5 runs per mode (`baseline-0.2.0.json`). The last column is the delta from a second, independent session.

| Metric (median)          | Off  | On             | Delta | Delta, repeat session |
| ------------------------ | ---- | -------------- | ----- | --------------------- |
| ScriptDuration (ms)      | 0.2  | 12.9 (cv 1.2%) | 12.7  | 12.4                  |
| TaskDuration (ms)        | 52.5 | 97.4 (cv 2.3%) | 44.9  | 43.1                  |
| RecalcStyleDuration (ms) | 5.0  | 13.6 (cv 2.7%) | 8.6   | 8.6                   |
| LayoutDuration (ms)      | 11.4 | 12.9 (cv 1.6%) | 1.5   | 1.9                   |
| JSHeapUsedSize (MB)      | 1.37 | 2.37           | 1.00  | 1.02                  |
| DOM nodes                | 8648 | 10051          | 1403  | 1403                  |
| Long tasks               | 0    | 0              | 0     | 0                     |
| scrollMs                 | 301  | 443            | 142   | 147                   |
| initialMs                | 27   | 32             | 5     | 7                     |

## Limits

- The fixture is not real X: no React, no virtualized timeline, no X stylesheets. It measures the extension's own work on a known page; real-X behavior is covered by `docs/MANUAL-CHECKLIST.md`.
- `initialMs` is noisy (cv up to about 15%) because it is only a few milliseconds; use it for large changes only. Off-mode `ScriptDuration` is near zero, so its cv is meaningless.
- `scrollMs` in "on" mode includes the harness polling for controls each frame, so it is an upper bound, not pure extension time.
- No long tasks occur at this fixture size, so the long-task metrics only show regressions that cross the 50 ms threshold.
- Numbers depend on the machine, Chrome version, and current load, and shift between sessions on the same machine (Stage 1A measured the unchanged 0.2.0 build about 15% higher in script and task time than Stage 0 did). For a real comparison, measure the reference build in the same session, alternating with the new build: `node scripts/perf/run.mjs ../saved-for-x` measures the shipped 0.2.0 build (the harness recognizes both its `.sfx-control` and Better X's `.bx-control`).

## Stage 1A comparison (2026-10-05)

Same session, alternating builds, two rounds of 5 runs per mode. On − off delta of medians:

| Metric                   | 0.2.0 build | Better X 1A |
| ------------------------ | ----------- | ----------- |
| ScriptDuration (ms)      | 14.1, 14.6  | 14.4, 14.9  |
| TaskDuration (ms)        | 49.8, 51.6  | 46.4, 48.3  |
| RecalcStyleDuration (ms) | 8.6, 9.2    | 8.6, 9.6    |
| LayoutDuration (ms)      | 0.9, 1.8    | 1.4, 1.5    |
| JSHeapUsedSize (MB)      | 1.02, 1.02  | 1.02, 1.01  |
| DOM nodes                | 1403        | 1403        |

No difference beyond run-to-run spread: the rebrand changed names only.
