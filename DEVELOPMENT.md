# Development notes

## Architecture

WXT builds the Manifest V3 background worker, X content script, and React side panel. WXT was chosen over manual Vite configuration because its named entrypoints generate the manifest and bundle content scripts without a custom build pipeline. The runtime UI uses plain CSS design tokens and Lucide icons; no component framework or styling runtime is required.

- `entrypoints/content.ts` watches X's dynamic timeline and injects an idempotent save button. It scans added or changed article branches after the initial page scan, rather than polling the full document.
- `src/x/selectors.ts` holds all X DOM selectors and visible-post extraction, including media, quotes, replies, and link cards. `src/lib/context.ts` sanitizes that context on save, import, and read. `src/x/url.ts` owns URL normalization and canonical post IDs.
- `entrypoints/background.ts` handles typed extension messages, checks that each comes from an extension page or (for a short allow-list) the X content script, and owns Chrome download events. `src/storage/db.ts` owns the IndexedDB connection and versioning; `src/storage/repository.ts` owns bookmark and collection CRUD.
- `src/media/` resolves media to files: `urls.ts` holds the pure URL rules and stable media keys, `syndication.ts` is the single adapter for X's post-metadata endpoint, and `resolver.ts` picks and verifies a file. `src/downloads/` holds download history (`repository.ts`), the lifecycle (`service.ts`), file naming, backup helpers, and shared wording.
- `src/lib/settings.ts` holds versioned, validated settings in `chrome.storage.local`, read and watched live by the panel, every X tab, and the worker.
- `src/content/popover.ts` places the X-page overlays (post-save chip, saved-post menu).
- `entrypoints/sidepanel/` mounts the React library UI. `src/sidepanel/App.tsx` provides browsing, editing, search, filtering, and import/export.
- `src/lib/validation.ts` checks imports and normalizes tags and URLs.

The content script and side panel share the same repository through background messages. Requests carry identities (post ID, media scope/index/key), never URLs or file names to fetch: the background re-reads the saved post and derives every URL itself. The X page asks only for saved IDs (`savedIds`), not the whole library. Bookmarks use the post ID as the IndexedDB key, so repeated saves of the same post do not create duplicates. Database upgrades belong in the `onupgradeneeded` block in `src/storage/db.ts` when a store or index changes. Version 2 added the `downloads` store (indexes `tweetId`, `chromeId`, `status`); bookmarks and collections are untouched. Saving is a single read-then-write transaction, so duplicate saves from two tabs never replace notes, tags, collection, or save date; a re-save only fills author details, media, or a quote that were missing. Schema 2 added optional post-context fields (`media`, `quote`, `replyTo`, `card`) to bookmark rows without a database upgrade: rows saved by schema 1 are normalized to empty context when read. Schema 3 added `PostMedia.sourceUrl` (original photo or direct MP4 when X exposed one). Exports are format version 3 and add a `downloads` array of completed history: no Chrome IDs, file URLs, statuses, or folders. Versions 1 and 2 still import (with empty context or history). On import, a bookmark that already exists locally is kept unchanged (notes, tags, collection all win), new collections and bookmarks are added, and history entries become `historical` with no local file. Invalid history entries are skipped without rejecting the file. Context is lenient: an unsafe or malformed field (for example, a non-`twimg.com` image) is dropped without rejecting its bookmark.

## DOM assumptions

X currently serves two post layouts, and extraction supports both:

- **Test-ID layout** (signed-in X at the time of writing): `article`, `[data-testid="tweetText"]`, `[data-testid="User-Name"]`, `time` inside the status link, `[data-testid="card.wrapper"]`, and an action `[role="group"]` with `[data-testid="reply"]`. Quotes are `[role="link"]` blocks holding another author; replies may show "Replying to @handle".
- **Newer layout** (served to signed-out visitors on x.com as of 2026-10-02): no test IDs and no `time`. Quotes are `article` elements nested in a `[role="link"]` block, link cards are `t.co` links holding a `card_img` image with a separate "From domain" line, and the action row is the last row whose children each hold an icon control.

Every lookup is scoped to the saved post's own content, so quoted text and media are never mixed into the author's text. Replies are detected from the "Replying to" label or from X's thread connector line joining the post to the one directly above it. Post dates fall back to the time encoded in the post ID. Missing metadata is allowed; a valid status URL and ID are required. X can change this markup; update `src/x/selectors.ts` and repeat the browser smoke test if saving or context disappears.

The injected control uses the Lucide `Layers2` mark and its own `sfx-` CSS selectors. It is appended to the action row and sized from X's own last visible icon (normally Share); the content script then measures both icon centers and corrects any remaining vertical offset, again after window resizes, so it stays aligned in timeline and detail layouts, at any X font size, and at any zoom without changing the row height. It does not depend on X's generated class names. The toolbar state refreshes when the library revision marker changes. The side panel follows the operating system theme by default and also offers manual light/dark choices.

## Downloads

### Feasibility (verified 2026-10-03, without a signed-in X account)

- Photos: `https://pbs.twimg.com/media/{id}?format={fmt}&name=orig` returns the original (for example 218,553 bytes against 33,403 for the default rendition). Requesting a different format returns 404, so the served format is kept.
- GIFs: X serves MP4s. `tweet_video_thumb/{id}` maps to `https://video.twimg.com/tweet_video/{id}.mp4` (checked on a real asset: `200 video/mp4`).
- Videos: the x.com player plays a `blob:` media-source stream, so the page never exposes a file, and the poster is just an image. Progressive MP4 variants exist on `video.twimg.com` and download without authentication (`200 video/mp4`, valid `ftyp`). Their URLs are only in post metadata. X's public endpoint `cdn.syndication.twimg.com/tweet-result?id=…&token=…` (used by X's embedded-post widget) returns them as `mediaDetails[].video_info.variants` for public posts; an empty `token` returns `{}`, and unknown or unavailable posts return 404 or a tombstone. Recorded responses are in `src/media/fixtures/`.
- Not used: X's private GraphQL API (needs signed-in tokens and changing query IDs), third-party downloader services, HLS assembly. A `.m3u8` is never renamed to `.mp4`.

The endpoint is the one maintenance risk: it is undocumented, unauthenticated, and could be rate-limited, changed, or withdrawn. It is called only when you click Download, once per post, from the background worker, and every field is validated. If it fails, videos report **Video unavailable to download** (or a network error) with **Open post on X**; photos and GIFs are unaffected. A direct MP4 seen on the page when the post was saved is kept as a fallback. To replace the source later, change only `src/media/syndication.ts`.

### Lifecycle

`DownloadService` (background) stores a `resolving` record before anything else, resolves and probes the file (`HEAD`, real content type and extension), moves the record to `starting` with the resolved URL, calls `chrome.downloads.download` (`conflictAction: 'uniquify'`, optional `saveAs`), binds the returned Chrome ID (`inProgress`), then immediately reads the item with `downloads.search` in case Chrome finished before the ID was stored. `downloads.onChanged` is registered synchronously at worker start. Every transition is an atomic read-modify-write; terminal states are idempotent and a completed record is never downgraded. A pending item cannot be started twice; a retry replaces earlier failed attempts for that item.

On worker start and whenever the library opens, active records are reconciled: a bound download is read back from Chrome (or marked `interrupted`/unknown if Chrome no longer lists it); a `starting` record without an ID is matched by URL and start time; anything else is marked interrupted. Nothing is restarted automatically. Cancelling calls `downloads.cancel`; nothing ever calls `downloads.removeFile`.

Only completed (or imported `historical`) records put a post in **Downloaded**. The view is derived from history, never from `collectionId`, so a user collection named "Downloaded" is unrelated. Clearing history keeps in-progress records. Records keep a sanitized snapshot of the post so a removed bookmark still shows in Downloaded without returning to All Bookmarks.

`downloads` is a required permission rather than optional: `chrome.permissions.request` needs a user gesture in an extension page, and the Download click happens in the X content script. If the API is unavailable the UI reports a permission error. The three host permissions are needed because the background's checks are cross-origin fetches.

## Settings and theming

Settings (`theme`, `accent`, `downloadsEnabled`, `afterSave`, `menuActions`, `saveAs`) live under one `settings` key. Each field falls back to its default when invalid. The panel's old `localStorage` theme is migrated once, only when no shared settings exist. The panel maps the accent to `--brand`, `--accent-light/dark`, and `--accent-soft-light/dark`; every accent keeps small text at 4.5:1 or better (tested). On X, the content script sets only `--sfx-accent` in its own `<style>`, and tints are mixed from it with `color-mix`. X-page overlays follow X's own theme (read from the page background), not the OS theme.

The X-page overlays are ordinary popovers (not ARIA menus): native buttons in Tab order, Arrow keys between actions, Escape closes and returns focus to the control, and Tab from the control enters an open overlay (leaving it returns to the control). They are measured after rendering, flip above or below, clamp to the viewport, follow their control on scroll, and close when the control leaves the screen or X reuses the post element for another post. The chip dismisses after 3 seconds idle (8 seconds when saved from the keyboard), never while hovered or focused, and when its post scrolls away.

## Run and verify

```bash
npm ci
npm run check
npm test
npm run build
```

Load `.output/chrome-mv3` through `chrome://extensions` → Developer mode → Load unpacked. Open `x.com`, save a visible post, and click the extension icon. For changes to content or background code in a production build, click **Reload** on the extension card and refresh the X tab.

`npm run smoke` builds, then runs `scripts/smoke/run.mjs` and `scripts/smoke/restart.mjs` with the installed Chrome (`CHROME_PATH` to override) and the unpacked build. It serves an X-shaped fixture at `https://x.com/home` through request interception (no X account), and downloads real media from X's CDNs, so it needs network access. Files and the throwaway profile go to `.smoke/`. It covers text-only, photo, GIF, a real video behind a `blob:` player, a partial two-photo batch, quoted media, an undescribable video, menu order and keyboard use, placement and flipping, recycled posts, two tabs saving at once, live settings, the library views and dialog, dark theme, reduced motion, and stopping the worker mid-download.

Unit tests (`npm test`) cover extraction (including the avatar regressions), URL rules, the metadata adapter with recorded responses, resolution outcomes, the download lifecycle with a scripted `chrome.downloads`, repository atomicity, settings, backup round-trips, and opening a version 1 database.

## Current limits

- The library stores a link, visible metadata, and thumbnail URLs on X's CDN, not an offline snapshot. Thumbnails stop loading if X removes the media. Downloaded files are ordinary files in your Downloads folder; the library does not hold copies.
- Video downloads depend on X's undocumented public post-metadata endpoint (see Downloads). Videos on protected, deleted, age-restricted, or withheld posts are not downloadable.
- Only downloads started by this extension are tracked. Older bookmarks saved before media loaded fill in their media the next time you click their saved icon on X.
- Reply context is only captured when X shows it at save time. Posts saved before schema 2 have no context.
- One collection per bookmark; tags can be multiple.
- The current search scans local bookmarks in memory. A dedicated full-text index may help very large libraries.
- X DOM changes may require selector maintenance. Browser tests against real X pages should be repeated before publishing.
- There is no cloud sync or migration of X's native bookmark list.

## Future work

Add a small content-script organization popover, optional favorites, and indexed search after the core save flow is stable. Cloud sync should remain opt-in and should not replace local storage.
