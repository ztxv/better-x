# Better X architecture decisions

Durable engineering decisions for Better X. Each entry states the decision and why. Change an entry only with a recorded reason; add new entries at the end of the relevant section.

Better X is a Chrome extension that combines a private post library (saving, collections, tags, notes, search, media downloads) with customization of X itself (cleanup, feed and post behavior, navigation, appearance).

## Foundation

**Based on Saved for X 0.2.0, not rewritten.** This repository starts at Saved for X commit `b6199ac` with its full history. Its repositories, download lifecycle, media resolver, overlays, extraction, and tests are working and tested; they change only for a concrete architectural reason. The 0.2.0 build is the equivalence reference for Stage 0 (see "Baselines").

**Chrome only, Manifest V3.** No Firefox or Safari abstractions unless something requires them. Modern Chrome APIs are allowed: `sidePanel`, MAIN-world content scripts, `document_start`.

**New extension identity.** Better X is a separate extension, not an update of Saved for X. Internal names (IndexedDB name, storage keys, download folder, CSS prefix, package name, feature IDs) may change freely; nothing is kept for browser-storage continuity. Since Stage 1A: IndexedDB `better-x`, `chrome.storage` keys `bx.*`, download folder `Better-X`, extension-owned CSS and DOM names prefixed `bx-`.

**Saved for X users migrate by export → import.** Better X must import Saved for X export files (`format: "saved-for-x"`) versions 1, 2, and 3, with the existing rules: local data wins, imported download history becomes `historical`, invalid history entries are skipped. Better X's own backups are `format: "better-x"`, version 1, which keeps the Saved for X version 3 structure; `src/lib/backup.ts` holds the importable formats and the upgrade from older versions (Stage 1B).

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

**The lifecycle foundation is `src/runtime/` (Stage 2A.1).** `Scope` owns cleanup: disposers, listeners (`listen`), animation frames (`requestFrame`), child scopes, and an `AbortSignal`. Disposal runs everything once, most recent first, and a cleanup that throws does not stop the rest. `observe(scope, target, options, callback)` creates a MutationObserver that disconnects with its scope. `waitFor(selector | predicate, { signal, timeout, root })` resolves on the first match using a short-lived observer (no polling) that is released when it settles. The content script owns one root scope, disposed through WXT's `ctx.onInvalidated`. WXT announces invalidation only when a newer copy of the script starts, so the scope also asks `ctx.isValid` (`Scope.alive()`) each time `observe` delivers, which is how an extension reload under an open tab is noticed; the global, page and modal scopes of the stages ahead are children of it. Still outside the scope: listeners and timers inside the large Saved and Downloads closure that are already tied to an overlay's own cleanup (closed on disposal), and in-flight save/download promises, which can still finish after disposal.

**Routes and layout are runtime services (Stage 2A.2).** `src/x/routes.ts` is a pure classifier from pathname and query to a `Route` (`id`, a `key` that is its logical identity, `modal`, and parameters); it never reads the DOM or the page title, and canonical post-URL parsing stays in `src/x/url.ts`. The key ignores hash, trailing slashes and tracking parameters but includes what changes the content (search text and filter, profile tab, a post's quotes/likes list). The composer and photo/video viewers are `modal`: they are routes, but not pages. `src/runtime/route.ts` follows navigation, notifies on a change of logical route, and owns `pageScope`, a child of the root scope that is disposed and replaced when the _page_ changes and left alone while a modal opens and closes over it. `src/runtime/layout.ts` reports `wide` or `narrow` from the flex direction of the element after `#layers` (a column is narrow, the same signal Control Panel for Twitter uses), re-read when that element's `class` changes, so opening the browser side panel is noticed without any route change; it rebinds if X replaces the wrapper and waits (additions only) if it is not rendered yet. Both are mirrored on `<html>` as `data-bx-route` and `data-bx-layout`, which the smoke test reads and later stages can style against.

_Navigation signal, from a spike (Chrome 154, isolated world)._ `window.navigation` is available to the content script, and its `currententrychange` fires for `pushState`, `replaceState`, back and forward, including a `pushState` that changes neither the DOM nor the title. `popstate` fires only for back/forward and hash changes, never for `pushState`, and the page title and DOM mutations are not reliable (a push can change neither). So the service listens to `currententrychange` alone: no polling, no history patching in the page world (Stage 7A), no title observer, no safety net on DOM batches. The extension requires Chrome 116, which has the Navigation API. The service takes its environment as a parameter and also works from `check()` alone, which is how it is tested. Not verified against a signed-in X session.

_Markup shape (test-ID vs newer layout) is deliberately not detected yet._ The extractor already tolerates both per article, with test-ID hooks first and shared structure as fallback. A page-level answer would have to be inferred from whichever posts happen to be loaded (none, on many pages, and a mix is possible), which is a heuristic that needs observation of real signed-out X pages that automation cannot currently reach (X returns 403 to automated Chrome). It should be added with the first feature that needs it, together with evidence, as a separate property from wide/narrow.

**Posts and the action row are runtime services; Saved is their first consumer (integration sprint).** `src/runtime/posts.ts` (`PostStream`) is the one place posts are discovered. It sits on the single managed document observer (`src/runtime/articles.ts`), so a consumer adds no observer and no scan. It reports each post whose element appeared (`new`), was reused by X for another post (`recycled`) or changed inside (`changed`: X renders a post in stages, so listeners must be idempotent), once per frame per element, skipping quoted posts; a listener can ask for a replay of the posts already on the page. `src/runtime/action-row.ts` (`ActionRow`) mounts `ActionSlot`s (id, order, `create`, `update`) into each post's action row: one element per slot per post element, re-targeted on recycling, recreated if X re-renders the row, ordered by `order`, ids unique, removed on unregister or scope end. The icon alignment that matches the row's native icons lives there and applies to every slot. `startRuntime()` composes these with routes and layout, and `src/saved/` (control, chip, menu, downloads, overlay, state sharing one `SavedContext`) is built on them. Anything that later adds an action registers a slot; anything that later reads posts subscribes to the stream; neither creates an observer. Post classification and timeline filtering are not part of the stream yet and should arrive with the first feature that needs them.

_Cleanup still outstanding._ Overlay-internal listeners are released only through `closeOverlay`; in-flight download progress callbacks end with their overlay but their requests run to completion; `requestAnimationFrame` and `setTimeout` calls inside the overlay code are still raw (released by the overlay's own cleanup); and the side panel and background have no lifecycle model, which they do not need.

**X internals live behind a MAIN-world capability layer.** React props, X's Redux store, verified-badge props, router history, feature switches, XHR rewriting, and internal GraphQL are reached only from a MAIN-world module that exposes named capabilities through a narrow, batched message protocol. Capabilities are probed at startup; a failing capability disables only the features that require it and is reported in diagnostics. Fragile access paths live in one place each. Messages from the page world are untrusted: they never trigger settings writes, downloads, or library changes without validation in the isolated world.

## Product defaults

**Conservative defaults plus presets.** Base defaults change little about X. First run offers Minimal, Clean (recommended), Focus, and Custom (normal X). A preset is a partial settings object applied over defaults through the same feature system; presets have no separate implementations.

**Full Twitter branding restoration is optional later.** Logo, favicon, title, and Tweet/Retweet wording are not in the initial stages. Nothing should prevent adding them.

## Third-party code

**Control Panel for Twitter is reference and source material.** It is MIT-licensed (Copyright (c) 2019, Jonny Buchanan). Its X-specific techniques (selectors, routes, timeline processing, popup handling, React/Redux access, XHR rewriting, feature switches) may be adapted, but its monolithic structure is not copied. Copied or substantially adapted code must keep MIT attribution: a header comment on the file naming the source and license, and an entry in `THIRD_PARTY_NOTICES.md` (created with the first adapted code). Its bundled `dedent()` carries a separate MIT notice (Victor, tiny-dedent) if used.

## Baselines

**Functional baseline (Stage 0, 2026-10-04).** On the bootstrapped 0.2.0 source: `npm run check` passes, `npm test` 8 files / 60 tests pass, `npm run format:check` passes, `npm run smoke` 66 checks pass (65 in `run.mjs`, 1 in `restart.mjs`), and `npm run build` output is byte-identical to the shipped Saved for X 0.2.0 build.

**Performance baseline is a measurement, not a contract.** `npm run perf` loads the same offline X-shaped timeline with and without the built extension, alternating modes across repeated fresh-browser runs, and records medians and spread. The 0.2.0 result is `perf/baseline-0.2.0.json`; method and limits are in `perf/README.md`. Later stages compare against it, and a change is worth investigating when it falls outside the baseline's own run-to-run spread. There are no fixed pass/fail thresholds, and the harness never gates the functional checks.
