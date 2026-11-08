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

## Integration sprint comparison (2026-10-08)

The Saved UI moved into `src/saved/`, with the shared `PostStream` and `ActionRow` under it. Same session, alternating the build from just before the sprint (`cf0bb1b`) with the final build, three rounds of 5 runs per mode. On − off delta of medians, one value per round:

| Metric                   | Before sprint    | After sprint     |
| ------------------------ | ---------------- | ---------------- |
| ScriptDuration (ms)      | 14.1, 14.1, 14.2 | 14.4, 14.4, 14.5 |
| TaskDuration (ms)        | 45.8, 46.1, 44.1 | 47.6, 46.8, 45.9 |
| RecalcStyleDuration (ms) | 8.7, 8.7, 8.4    | 8.6, 8.6, 8.5    |
| LayoutDuration (ms)      | 1.1, 1.5, 0.7    | 1.9, 0.9, 0.6    |
| JSHeapUsedSize (MB)      | 1.15, 1.13, 1.13 | 1.19, 1.19, 1.19 |
| scrollMs                 | 155, 144, 156    | 154, 155, 156    |
| DOM nodes, controls      | 1403, 200        | 1403, 200        |
| Long tasks               | 0                | 0                |

Script time is about 0.3 ms (2%) higher; everything else is inside the round-to-round spread. A plain `npm run perf` the same evening read cv 20–60% (the machine was busy), so only the interleaved comparison above is used.

**A regression was found and fixed on the way.** The first comparison showed ScriptDuration about 1.5–2 ms (10–14%) higher, in all rounds and with the order of the builds swapped, so it was not noise. Bisecting the sprint's commits put about 0.6 ms in `PostStream` and about 1.2 ms in `ActionRow`, and none in the pure extraction. Call counts (V8 precise coverage) were identical to the old build (400 identity reads, 200 controls, 200 alignments for the 200-post page), and a 20-post page showed only +0.3 ms, so the cost scaled with posts but not with how many times anything ran: it was in what each call did. Changing the lookup selector, snapshotting listener lists, and pruning only departed posts each made no measurable difference; replacing the `dataset` reads and writes in the mount path (about six DOM calls per control, to find an insert position) with JavaScript-side bookkeeping removed it. DOM `dataset` access is expensive enough to matter in per-post code.

Heap readings moved between 0.8 and 1.25 MB across variants with no code reason; the JS heap is measured before any garbage collection, so differences under about 0.4 MB here say nothing about retention.

## Customization MVP comparison (2026-10-08)

The feature registry and host, the three features, and the settings schema change. Same session, alternating the build from just before (`e29e4bf`) with the final build, three rounds of 5 runs per mode, every feature off (the default). On − off delta of medians, one value per round:

| Metric                   | Before           | After            |
| ------------------------ | ---------------- | ---------------- |
| ScriptDuration (ms)      | 14.4, 15.3, 15.7 | 15.4, 15.1, 15.2 |
| TaskDuration (ms)        | 42.0, 49.7, 49.7 | 47.4, 47.4, 46.9 |
| RecalcStyleDuration (ms) | 8.1, 8.9, 8.7    | 8.9, 8.8, 8.3    |
| LayoutDuration (ms)      | 0.8, 0.8, 1.6    | 1.4, 1.1, 1.5    |
| JSHeapUsedSize (MB)      | 1.19, 1.15, 1.18 | 1.20, 1.20, 1.20 |
| scrollMs                 | 135, 141, 135    | 140, 144, 140    |
| DOM nodes                | 1403             | 1404             |
| Long tasks               | 0                | 0                |

Script, task, recalculation and layout are inside the old build's own spread. Scroll time reads about 4 ms (3%) higher in all three rounds, which is at the edge of the spread and was not chased further. The one extra node is the feature host's `<style>` element, created detached and attached only while a feature with CSS is on.

**With all three features on** (the same build, features on versus off, three rounds; the perf fixture has no promoted posts, Grok surfaces or Home tabs, so this measures the cost of the rules and hooks being present, not of hiding anything): script 15.5–16.4 ms against 15.0–15.5, task time equal within noise (46.5–49.9 against 49.2–53.0), recalculation 8.5–8.7 against 8.8–9.1, heap +0.02 MB, scroll 137–147 against 137–144, one more node (the attached stylesheet). The CSS-only features add no observers and no per-post work; the style rules (`:has(...)`) did not show up as extra recalculation here, but a real timeline with many promoted posts was not measured.

**Found and fixed on the way.** A first measurement with all three on showed Hide For You adding about 2 ms of script time: on a Home page with no tabs it ran two document-wide selector queries on every batch of posts, and its wait for the tabs ran the same queries on every mutation. It now checks only that the tab list it already knew is still attached, finds tabs by walking the page's few `nav` elements, and confirms each click with one timer. A plain `npm run perf` the same evening read within 10% of these figures with cv up to 19%, so only the interleaved comparisons are used.

## Customization expansion (2026-10-08)

64 features (61 new), sliders, settings version 3, the sidebar marker, and the new Customize view. Two questions: did the default state (every feature off) get slower, and what does switching features on cost? The machine was moderately busy (load average about 4, WindowServer at 40–50%); the coefficients of variation below stay under about 3% except where noted, so the comparisons are usable, but they are not the quiet-machine figures of the earlier sections.

`scripts/perf/run.mjs` gained `--shape x` and `--features`. `--shape x` serves the same 200 posts inside X's shell: timeline cells (`cellInnerDiv`), tweet test IDs, X-shaped action rows with counts, the primary nav, menus and the sidebar. The plain fixture has none of those, so a customization rule has nothing to match there and would measure nothing. `--features default,typical,all` adds extension modes with those customizations on (`typical` is the Minimal quick setup, 31 features; `all` is all 64; `cat:<category>` and `ids:<id>+<id>` work too). Modes alternate per run, as always.

### Default state: before and after

The build from just before the sprint (`29c7d9c`) against the final build, every feature off, three rounds of 5 runs per build, alternating. On − off delta of medians, one value per round:

| Metric (plain fixture)   | Before           | After            |
| ------------------------ | ---------------- | ---------------- |
| ScriptDuration (ms)      | 14.7, 14.1, 14.1 | 14.5, 14.9, 14.8 |
| TaskDuration (ms)        | 46.8, 43.4, 44.7 | 43.1, 46.2, 43.3 |
| RecalcStyleDuration (ms) | 8.8, 8.1, 8.5    | 7.7, 8.2, 8.3    |
| LayoutDuration (ms)      | 0.2, 1.0, 1.6    | 0.9, 1.1, -0.8   |
| scrollMs                 | 152, 148, 154    | 152, 154, 156    |
| DOM nodes, long tasks    | 1404, 0          | 1404, 0          |

| Metric (X-shaped)        | Before           | After            |
| ------------------------ | ---------------- | ---------------- |
| ScriptDuration (ms)      | 14.8, 14.8, 14.8 | 15.9, 15.6, 15.8 |
| TaskDuration (ms)        | 53.4, 52.3, 51.1 | 56.7, 52.2, 54.3 |
| RecalcStyleDuration (ms) | 7.8, 8.4, 8.7    | 9.2, 8.6, 9.1    |
| LayoutDuration (ms)      | 5.3, 5.4, 5.0    | 5.8, 4.9, 5.1    |
| JSHeapUsedSize (MB)      | 1.15, 1.14, 1.15 | 1.27, 1.27, 1.28 |
| scrollMs                 | 135, 136, 132    | 136, 134, 135    |
| DOM nodes, long tasks    | 1404, 0          | 1404, 0          |

On the plain fixture the default state is inside the old build's own spread. On the X-shaped page script time is about 1 ms (7%) higher in all three rounds and the heap about 0.12 MB higher. The content script grew from 47 KB to 67 KB, mostly the catalog's CSS, titles and descriptions, and a V8 CPU profile (5 runs each) puts the content script's own execution at 16.95 ms before and 17.28 ms after, so the difference is mostly compiling and evaluating a larger script rather than anything running per post. Not reduced further: splitting the titles and descriptions out of the content script would need two registries for about 0.5 ms.

**A regression was found and fixed on the way.** The first comparison showed plain-fixture script time about 1.1 ms higher (16.1, 16.0, 16.8 against 15.0, 14.7, 15.2). The sidebar marker waited for X's primary column with a document-wide observer that ran a document-wide `querySelector` on every mutation, and the plain fixture has no primary column, so the wait never ended (200 control insertions and 200 post insertions each ran it). It now observes nothing until the column exists and instead looks again at the first post, on a route change and on a layout change; a page that never has a column (a login flow) pays nothing.

### With customizations on

X-shaped page, 200 posts, 5 runs per mode, alternating (median, cv):

| Metric                   | No extension | Default (all off) | Typical (31 on) | All (64 on)  |
| ------------------------ | ------------ | ----------------- | --------------- | ------------ |
| ScriptDuration (ms)      | 0.4          | 16.1 (0.6%)       | 15.7 (1.5%)     | 15.2 (1.3%)  |
| TaskDuration (ms)        | 69.7         | 122.6 (1.2%)      | 136.4 (1.7%)    | 117.0 (1.3%) |
| RecalcStyleDuration (ms) | 11.1         | 19.1 (1.1%)       | 38.7 (2.5%)     | 45.6 (1.7%)  |
| LayoutDuration (ms)      | 11.8         | 17.2 (1.2%)       | 15.7 (1.1%)     | 10.7 (1.3%)  |
| JSHeapUsedSize (MB)      | 1.44         | 2.72 (7%)         | 2.31 (0.0%)     | 2.32 (0.4%)  |
| DOM nodes                | 13709        | 15113             | 15114           | 15114        |
| Long tasks               | 0            | 0                 | 0               | 0            |
| scrollMs                 | 302          | 437               | 438             | 443          |

Customization is CSS only, so script time does not move (the small drops are noise). The cost is style recalculation: about 20 ms across the page's whole life for the typical setup and about 27 ms for everything, against 19 ms for the extension's default state, or roughly 0.1 ms per post. Task time rises 14 ms for the typical setup; with everything on it falls, because hiding the sidebar, counts and rows removes more layout (−6.5 ms) than the rules cost. No long tasks in any configuration. The JS heap readings are before any garbage collection and say nothing below about 0.4 MB (the default mode's cv is 7%). The extra DOM node is the feature stylesheet; the plain-fixture default state has none.

By category (3 runs, recalculation, change from the default state): navigation +1.2 ms, home and feed +17.4, posts −0.8, sidebar +3.7, appearance +2.9, ads/Grok/Premium +7.5. Any one stylesheet costs about 1 ms (the extra `<style>` recalculates once); a `:has()` rule costs from about 1.5 ms (written the cheap way) to about 5.5 ms (written the costly way).

**What made rules expensive, and the rules that follow from it.** The first all-on measurement was +78 ms of recalculation (typical +41). Bisecting by category, then by feature, then with a micro-benchmark that appends 400 posts and 400 controls with one rule present (baseline 9.4–10.1 ms), found one cause: a `:has()` whose subject is a bare `div` makes Chrome re-test every ancestor `div` of anything inserted anywhere on the page, because it cannot tell which ancestors the rule is about. Every post X adds and every control Better X adds triggers it.

| Rule shape                                                                     | Before (ms) | After (ms) |
| ------------------------------------------------------------------------------ | ----------- | ---------- |
| `cell > div:has(prompt)` → `cell:has(prompt) > div`                            | +7.5        | +1.9       |
| Suggested modules (three `:has`, `:not`)                                       | +11.6       | +1.5       |
| Reposts (`:has` and `:not(:has)`)                                              | +6.5        | +1.5       |
| Sidebar Who to follow: `div:has(aside … UserCell)` → anchored on `aside[role]` | +8.1        | −0.4       |
| Sidebar, same with `:has(> aside)` (child combinator)                          | n/a         | +0.8       |
| Home composer: `div:has([data-testid^=…])` → `div:has(.DraftEditor-root)`      | +6.5        | +1.2       |

The rules that follow, all applied: put `:has()` on the timeline cell, which has a test ID, never on its inner `div` (`cellWhere` in `src/features/css.ts`); anchor on an element with a role or test ID; use a child combinator inside `:has(> …)`, which stays cheap; and make the `:has` argument something rare (a class, a tag) rather than `[data-testid]`, which every inserted node has. Route scoping (`html[data-bx-route="home"] …`) costs nothing on other routes, since the rule cannot match there. One rule keeps the old shape because no cheaper form was found that is still correct: `feed.hideManageTimelines` identifies a button by an icon path inside a bare `div` (+5.2 ms). Remaining per-feature costs over the default state, 3 runs: Premium upsells +3.4, Hide Ads +3.1, view counts +3.9, suggested modules +2.5, reposts +1.8, inline prompts +1.6, Grok posts +1.7, Who to follow +0.3, composer +1.2, simplify actions −5.9 (it hides rows, so less layout).

A plain `npm run perf` is not used for any of the above; the figures are from alternating runs in one session.

## Quality-of-life sprint (2026-10-08)

Sidebar card marking, the settings backup, the popup entry and the launch-mode worker code, against the build just before (`8065108`), all features off, three rounds of 5 runs alternating. The machine was busier than in the earlier sections (cv up to 8%). On − off delta of medians:

| Metric (plain / X-shaped)   | Before           | After            |
| --------------------------- | ---------------- | ---------------- |
| ScriptDuration (ms), plain  | 16.5, 17.0, 16.2 | 16.1, 16.7, 16.2 |
| ScriptDuration (ms), X      | 17.1, 16.6, 16.6 | 16.9, 16.6, 17.0 |
| TaskDuration (ms), X        | 61.0, 60.1, 56.0 | 58.6, 57.5, 58.0 |
| RecalcStyleDuration (ms), X | 9.8, 9.3, 9.2    | 9.5, 9.2, 9.1    |
| scrollMs, X                 | 143, 147, 145    | 143, 145, 148    |
| DOM nodes, long tasks       | 1404, 0          | 1404, 0          |

No measurable change. Nothing new runs on X unless a feature asks: the sidebar service observes the sidebar column only while "Hide Who to follow" or "Hide the Premium card" is on, the backup and popup code never load in the content script, and the worker's launch-mode code runs only at start and when the setting changes. A plain `npm run perf` read script 16.3 ms, task 49.4 ms (cv under 3%).

## Account insights and Smart filtering (2026-10-09)

The harness changed for this sprint, so these figures are **not comparable with the sections above**: the X-shaped fixture's name block is now drawn the way X draws it (the `@handle` is its own link, so badges have a place to go), `x.com` also answers `AboutAccountQuery` locally, and `--settle` sets the idle time before reading. Everything below was measured in this one session, X-shaped, 200 posts in 10 batches, accounts `user0`…`user16`, lookups in the automatic (on-screen) mode, which is the heaviest.

**1. Shipped but off, against the build just before (`3f6e1ab`)**: three rounds of 4 runs, old then new.

| Metric (median of three rounds) | Before     | After      |
| ------------------------------- | ---------- | ---------- |
| ScriptDuration (ms)             | 16.05      | 17.4       |
| TaskDuration (ms)               | 127.4      | 129.9      |
| RecalcStyleDuration (ms)        | 20.3       | 20.2       |
| LayoutDuration (ms)             | 18.1       | 18.2       |
| DOM nodes, long tasks           | 17024, 0   | 17024, 0   |
| scrollMs / initialMs            | 438 / 42.5 | 444.5 / 44 |

About +1.3 ms of script and +2.5 ms of task time (about 2%), consistent in each round and with a run-to-run spread of 1–3%. It is the larger content script being parsed and the account tracker registering one listener; nothing observes or styles anything until a feature is on. Bundle: 480.4 kB → 581.8 kB in total (content script 113.8 kB, including the Apple and Android marks only: the Simple Icons barrel is tree-shaken).

**2. Features on, 5 runs per mode** (medians; `off` is no extension):

| Mode                                                | Script ms | Task ms | Style ms | Layout ms | Nodes  | Heap MB | Lookups | Badges / collapsed |
| --------------------------------------------------- | --------- | ------- | -------- | --------- | ------ | ------- | ------- | ------------------ |
| off (no extension)                                  | 0.4       | 71.6    | 11.4     | 13.0      | 15,620 | 1.5     | 0       | 0                  |
| default (all features off)                          | 17.0      | 128.1   | 20.2     | 18.1      | 17,024 | 2.4     | 0       | 0                  |
| **badges, warm cache** (flag, mark, card, warnings) | 22.0      | 150.1   | 21.2     | 21.3      | 19,144 | 2.7     | 0       | 200                |
| **badges, cold cache**                              | 34.2      | 225.7   | 22.7     | 24.9      | 18,006 | 2.8     | 7       | 83                 |
| **country filter, warm cache** (Germany + India)    | 22.6      | 139.0   | 20.6     | 20.0      | 17,706 | 2.7     | 0       | 70 collapsed       |
| **country filter, cold cache**                      | 31.0      | 176.6   | 21.7     | 21.2      | 17,291 | 2.9     | 7       | 24 collapsed       |
| badges + filter, warm cache                         | 26.7      | 150.2   | 21.2     | 22.7      | 19,922 | 3.3     | 0       | 200 + 70           |

Reading it:

- Only posts that were on screen are looked up: the fixture has 17 accounts and 7 were requested, because the harness scrolls straight to the end of each batch. Each account is requested once however many posts it has (200 posts, 7 requests). With a warm cache there are no requests at all.
- A warm cache costs about +5 ms of script and +22 ms of main-thread task time over the whole 200-post session, and 2,100 DOM nodes for 200 badges (about 10 each). The filter alone costs about +5.6 ms of script.
- A cold cache costs about +17 ms of script and +97 ms of task time, once per account, spread over the 7 staggered answers (no long task; the longest is a few milliseconds). Seven fetches alone cost about 10 ms of task time with no extension (measured separately); the rest is staggered paint and layout as badges arrive one answer at a time, against one batch with a warm cache. A longer idle time (`--settle 4000`) did not change the default figure, so this is not idle time.
- No long tasks in any mode, and `scrollMs` is unchanged within spread.
- Memory: about +0.3 MB (warm) to +0.5 MB (cold) of JS heap for the service and cache of 17 accounts; the cache is capped at 3,000 entries (about 250 B each when stored).
- Request pacing is the service's: two at a time, 500 ms apart, newest on-screen post first, dropped if the post scrolled away, paused by X's own rate-limit answers.

## X themes (1.1.0 work, 2026-11-08)

`node scripts/perf/run.mjs --shape x --theme dim --runs 5` on Windows 10 / Chrome (this machine, not the earlier baseline machine, so compare within the table only). Every mode loads the 200-post X-shaped page in X's dark mode (`data-theme="dark"`); `on` is the extension with no theme, `theme:dim` the same with Dim on. Medians, [min–max] over 5 runs:

| Metric    | off (no extension)  | on (no theme)       | theme:dim           |
| --------- | ------------------- | ------------------- | ------------------- |
| Style ms  | 23.1 [20.6–27.5]    | 42.7 [41.6–49.6]    | 48.1 [45.5–49.8]    |
| Layout ms | 46.3 [44.3–48.6]    | 62.5 [57.7–66.8]    | 63.4 [58.5–66.3]    |
| Script ms | 0.9 [0.8–0.9]       | 37.4 [36.8–44.2]    | 37.3 [36.6–39.4]    |
| Task ms   | 211.4 [196.9–216.5] | 391.2 [340.7–399.3] | 349.5 [337.3–368.8] |
| scrollMs  | 344 [341–361]       | 391 [382–455]       | 409 [394–420]       |
| initialMs | 80 [74–84]          | 176 [126–180]       | 139 [132–143]       |

Reading it: the theme adds no script (it runs once per settings change, not per post) and its ranges overlap the no-theme ranges on every metric. The one consistent shift is style, about +5 ms in medians over the whole 200-post session, which is what ~30 grouped rules under `html[data-bx-theme]` cost, including the `[style*="…"]` attribute matches. Inside the spread, so not investigated further; re-measure when the probe changes the selector table.
