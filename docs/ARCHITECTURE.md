# Better X architecture decisions

Durable engineering decisions for Better X. Each entry states the decision and why. Change an entry only with a recorded reason; add new entries at the end of the relevant section.

Better X is a Chrome extension that combines a private post library (saving, collections, tags, notes, search, media downloads) with customization of X itself (cleanup, feed and post behavior, navigation, appearance).

## Foundation

**Based on Saved for X 0.2.0, not rewritten.** This repository starts at Saved for X commit `b6199ac` with its full history. Its repositories, download lifecycle, media resolver, overlays, extraction, and tests are working and tested; they change only for a concrete architectural reason. The 0.2.0 build is the equivalence reference for Stage 0 (see "Baselines").

**Chrome only, Manifest V3.** No Firefox or Safari abstractions unless something requires them. Modern Chrome APIs are allowed: `sidePanel`, MAIN-world content scripts, `document_start`.

**New extension identity.** Better X is a separate extension, not an update of Saved for X. Internal names (IndexedDB name, storage keys, download folder, CSS prefix, package name, feature IDs) may change freely; nothing is kept for browser-storage continuity.

**Saved for X users migrate by export → import.** Better X must import Saved for X export files (`format: "saved-for-x"`) versions 1, 2, and 3, with the existing rules: local data wins, imported download history becomes `historical`, invalid history entries are skipped.

## Structure

**Saved and Downloads remain large modules.** The library/save control and the download system are imperative subsystems with their own UI and background services. They join the shared lifecycle and settings schema, but are not split into per-toggle features.

**Customization uses declarative feature definitions.** Each customization feature declares, as data: ID, section, title, description, settings with defaults and validators, dependencies, supported layouts (viewport width class and X markup variant), stability (`stable` / `beta` / `experimental`), required X capabilities, optional CSS, runtime hooks, and optional setup returning a disposer. A feature that throws during setup is marked failed and disabled; others keep running. The side panel renders Customize from the same definitions the content script runs.

**A shared X runtime owns page integration.** One runtime in the isolated content script owns:

- page observation and its lifecycle (global / page / modal scopes, disposed on route change);
- routes and SPA navigation;
- layout detection (wide vs narrow X layouts, test-ID vs newer markup);
- post discovery, including recycled post elements;
- timeline processing and post classification;
- action-row integration (ordered slots; the save control is one slot);
- popup and menu routing for X's own popups;
- styles (`html` data attributes, generated stylesheets, React Native stylesheet access).

Saved and customization features consume these services; neither keeps its own copy.

**Features do not create unmanaged observers.** Feature modules must not create ad hoc `MutationObserver`s, polling loops, or global listeners. All observation is owned and disposed by the shared runtime, and features receive events through runtime hooks. This is not a rule of "exactly one observer": the runtime may use a small number of focused observers (for example the document, `#layers`, `<title>`, the app wrapper) where that is cleaner or more efficient.

**X internals live behind a MAIN-world capability layer.** React props, X's Redux store, verified-badge props, router history, feature switches, XHR rewriting, and internal GraphQL are reached only from a MAIN-world module that exposes named capabilities through a narrow, batched message protocol. Capabilities are probed at startup; a failing capability disables only the features that require it and is reported in diagnostics. Fragile access paths live in one place each. Messages from the page world are untrusted: they never trigger settings writes, downloads, or library changes without validation in the isolated world.

## Product defaults

**Conservative defaults plus presets.** Base defaults change little about X. First run offers Minimal, Clean (recommended), Focus, and Custom (normal X). A preset is a partial settings object applied over defaults through the same feature system; presets have no separate implementations.

**Full Twitter branding restoration is optional later.** Logo, favicon, title, and Tweet/Retweet wording are not in the initial stages. Nothing should prevent adding them.

## Third-party code

**Control Panel for Twitter is reference and source material.** It is MIT-licensed (Copyright (c) 2019, Jonny Buchanan). Its X-specific techniques (selectors, routes, timeline processing, popup handling, React/Redux access, XHR rewriting, feature switches) may be adapted, but its monolithic structure is not copied. Copied or substantially adapted code must keep MIT attribution: a header comment on the file naming the source and license, and an entry in `THIRD_PARTY_NOTICES.md` (created with the first adapted code). Its bundled `dedent()` carries a separate MIT notice (Victor, tiny-dedent) if used.

## Baselines

**Functional baseline (Stage 0, 2026-10-04).** On the bootstrapped 0.2.0 source: `npm run check` passes, `npm test` 8 files / 60 tests pass, `npm run format:check` passes, `npm run smoke` 66 checks pass (65 in `run.mjs`, 1 in `restart.mjs`), and `npm run build` output is byte-identical to the shipped Saved for X 0.2.0 build.

**Performance baseline is a measurement, not a contract.** `npm run perf` loads the same offline X-shaped timeline with and without the built extension, alternating modes across repeated fresh-browser runs, and records medians and spread. The 0.2.0 result is `perf/baseline-0.2.0.json`; method and limits are in `perf/README.md`. Later stages compare against it, and a change is worth investigating when it falls outside the baseline's own run-to-run spread. There are no fixed pass/fail thresholds, and the harness never gates the functional checks.
