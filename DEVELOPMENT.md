# Development notes

## Architecture

WXT builds the Manifest V3 background worker, X content script, and React side panel. WXT was chosen over manual Vite configuration because its named entrypoints generate the manifest and bundle content scripts without a custom build pipeline. The runtime UI uses plain CSS design tokens and Lucide icons; no component framework or styling runtime is required.

- `entrypoints/content.ts` watches X's dynamic timeline and injects an idempotent save button. It scans added or changed article branches after the initial page scan, rather than polling the full document.
- `src/x/selectors.ts` holds all X DOM selectors and visible-post extraction, including media, quotes, replies, and link cards. `src/lib/context.ts` sanitizes that context on save, import, and read. `src/x/url.ts` owns URL normalization and canonical post IDs.
- `entrypoints/background.ts` handles typed extension messages. `src/storage/repository.ts` owns IndexedDB CRUD and database versioning.
- `entrypoints/sidepanel/` mounts the React library UI. `src/sidepanel/App.tsx` provides browsing, editing, search, filtering, and import/export.
- `src/lib/validation.ts` checks imports and normalizes tags and URLs.

The content script and side panel share the same repository through background messages. Bookmarks use the post ID as the IndexedDB key, so repeated saves of the same post do not create duplicates. Database upgrades belong in the `onupgradeneeded` block when a store or index changes. Schema 2 added optional post-context fields (`media`, `quote`, `replyTo`, `card`) to bookmark rows without a database upgrade: rows saved by schema 1 are normalized to empty context when read. Exports are format version 2; version 1 files still import with empty context. Context is lenient: an unsafe or malformed field (for example, a non-`twimg.com` image) is dropped without rejecting its bookmark.

## DOM assumptions

X currently serves two post layouts, and extraction supports both:

- **Test-ID layout** (signed-in X at the time of writing): `article`, `[data-testid="tweetText"]`, `[data-testid="User-Name"]`, `time` inside the status link, `[data-testid="card.wrapper"]`, and an action `[role="group"]` with `[data-testid="reply"]`. Quotes are `[role="link"]` blocks holding another author; replies may show "Replying to @handle".
- **Newer layout** (served to signed-out visitors on x.com as of 2026-10-02): no test IDs and no `time`. Quotes are `article` elements nested in a `[role="link"]` block, link cards are `t.co` links holding a `card_img` image with a separate "From domain" line, and the action row is the last row whose children each hold an icon control.

Every lookup is scoped to the saved post's own content, so quoted text and media are never mixed into the author's text. Replies are detected from the "Replying to" label or from X's thread connector line joining the post to the one directly above it. Post dates fall back to the time encoded in the post ID. Missing metadata is allowed; a valid status URL and ID are required. X can change this markup; update `src/x/selectors.ts` and repeat the browser smoke test if saving or context disappears.

The injected control uses the Lucide `Layers2` mark and its own `sfx-` CSS selectors. It is appended to the action row and sized from X's own last visible icon (normally Share); the content script then measures both icon centers and corrects any remaining vertical offset, again after window resizes, so it stays aligned in timeline and detail layouts, at any X font size, and at any zoom without changing the row height. It does not depend on X's generated class names. The toolbar state refreshes when the library revision marker changes. The side panel follows the operating system theme by default and also offers manual light/dark choices.

## Run and verify

```bash
npm ci
npm run check
npm test
npm run build
```

Load `.output/chrome-mv3` through `chrome://extensions` → Developer mode → Load unpacked. Open `x.com`, save a visible post, and click the extension icon. For changes to content or background code in a production build, click **Reload** on the extension card and refresh the X tab.

A browser smoke test can also use an isolated Chromium profile and an X-shaped HTML fixture at an `x.com` URL. The fixture should contain `article`, a status link with `time`, `[data-testid="tweetText"]`, and an action group with a reply control. This checks the content script without an X account.

## Current limits

- The library stores a link, visible metadata, and thumbnail URLs on X's CDN, not an offline snapshot. Thumbnails stop loading if X removes the media.
- Reply context is only captured when X shows it at save time. Posts saved before schema 2 have no context.
- One collection per bookmark; tags can be multiple.
- The current search scans local bookmarks in memory. A dedicated full-text index may help very large libraries.
- X DOM changes may require selector maintenance. Browser tests against real X pages should be repeated before publishing.
- There is no cloud sync or migration of X's native bookmark list.

## Future work

Add a small content-script organization popover, optional favorites, and indexed search after the core save flow is stable. Cloud sync should remain opt-in and should not replace local storage.
