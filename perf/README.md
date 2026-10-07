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

## Stage 2A.1 comparison (2026-10-05)

The shared runtime lifecycle and a managed content observer, with no intended behavior change. Same session, alternating the build from just before the stage with the Stage 2A.1 build, four rounds of 5 runs per mode. On − off delta of medians, one value per round:

| Metric                   | Before 2A.1            | Stage 2A.1             |
| ------------------------ | ---------------------- | ---------------------- |
| ScriptDuration (ms)      | 12.8, 12.6, 12.5, 12.5 | 13.4, 12.8, 13.2, 13.0 |
| TaskDuration (ms)        | 39.3, 42.3, 37.5, 40.0 | 41.9, 41.2, 41.4, 41.0 |
| RecalcStyleDuration (ms) | 8.5, 8.4, 8.2, 8.2     | 8.6, 8.4, 8.6, 8.5     |
| LayoutDuration (ms)      | -1.3, 1.8, -1.7, -0.9  | -0.6, 0.6, -0.2, 0.4   |
| JSHeapUsedSize (MB)      | 1.01, 1.02, 1.01, 1.02 | 1.10, 1.10, 1.12, 1.10 |
| scrollMs                 | 146, 144, 145, 147     | 151, 142, 151, 149     |
| DOM nodes, long tasks    | 1403, 0                | 1403, 0                |

Script and task time are inside the reference's own round-to-round spread (script about +0.4 ms on 12.5, task within its spread). JS heap is consistently about 0.09 MB higher at the end of the run, which is outside the heap's own spread (cv under 0.5%); after a forced GC the retained difference is 0.02 MB (0.55 vs 0.57), so most of it is allocation not yet collected, not retained memory. Removing the `ctx.isValid` check from the observer did not change the heap difference. Treated as small and not pursued further; compare against this table, not the 0.2.0 baseline, for later stages.

## Stage 2A.2 comparison (2026-10-07)

Route service, layout service and the two `<html>` attributes, with no intended behavior change. Same session, alternating the build from just before the stage (`4ef57e2`) with the Stage 2A.2 build, three rounds of 5 runs per mode. On − off delta of medians, one value per round:

| Metric              | Before 2A.2      | Stage 2A.2       |
| ------------------- | ---------------- | ---------------- |
| JSHeapUsedSize (MB) | 1.10, 1.11, 1.10 | 1.13, 1.13, 1.13 |
| scrollMs            | 133, 147, 137    | 141, 138, 136    |
| DOM nodes, controls | 1403, 200        | 1403, 200        |
| Long tasks          | 0                | 0                |
| ScriptDuration (ms) | 20.4, 15.1, 18.4 | 18.0, 13.9, 18.0 |
| TaskDuration (ms)   | 49.9, 34.3, 58.8 | 55.6, 47.2, 55.0 |
| RecalcStyleDuration | 10.0, 9.7, 11.4  | 10.5, 8.3, 10.1  |
| LayoutDuration (ms) | 1.8, 1.9, 0.9    | 0.1, 2.0, 2.0    |

**The duration rows are not a valid measurement.** The machine was degraded for the whole session (Wi-Fi daemon at 75% CPU, smoke runs taking ten times as long as usual), and the on-mode coefficients of variation were 7–36% for the duration metrics instead of the usual 1–3%; a plain `npm run perf` read 20.9 ms script and 117 ms task against about 13 and 94 on a quiet machine. The two builds' ranges overlap completely, so they show no difference, but they could not show a small one either. Only the low-noise rows say anything: heap is about 0.03 MB higher (cv under 1.2%), DOM nodes, controls and long tasks are identical, and scroll time is unchanged. The duration comparison should be repeated on a quiet machine before relying on it.

What the stage adds at run time, which bounds the possible cost: one `currententrychange` listener, one `class`-attribute observer on the app wrapper (fires only when X changes its classes), one child-list observer on the wrapper's parent (not subtree), and, only while `#layers + div` has not yet rendered, a child-list/subtree observer whose callback is a single `getElementById` (the perf fixture has no `#layers`, so it never stops waiting there; on X it ends within the first renders).
