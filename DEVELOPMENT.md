# Development notes

## Architecture

WXT builds the Manifest V3 background worker, X content script, and React side panel. WXT was chosen over manual Vite configuration because its named entrypoints generate the manifest and bundle content scripts without a custom build pipeline. The runtime UI uses plain CSS design tokens and Lucide icons; no component framework or styling runtime is required.

- `entrypoints/content.ts` watches X's dynamic timeline and injects an idempotent save button. It scans added or changed article branches after the initial page scan, rather than polling the full document.
- `src/x/selectors.ts` holds all X DOM selectors and visible-post extraction. `src/x/url.ts` owns URL normalization and canonical post IDs.
- `entrypoints/background.ts` handles typed extension messages. `src/storage/repository.ts` owns IndexedDB CRUD and database versioning.
- `entrypoints/sidepanel/` mounts the React library UI. `src/sidepanel/App.tsx` provides browsing, editing, search, filtering, and import/export.
- `src/lib/validation.ts` checks imports and normalizes tags and URLs.

The content script and side panel share the same repository through background messages. Bookmarks use the post ID as the IndexedDB key, so repeated saves of the same post do not create duplicates. Database upgrades belong in the `onupgradeneeded` block when the schema version increases.

## DOM assumptions

X currently exposes posts as `article`, post text via `[data-testid="tweetText"]`, timestamps inside status links, author metadata via `[data-testid="User-Name"]`, and an action group with `[data-testid="reply"]`. X can change these semantic hooks; update `src/x/selectors.ts` and repeat the browser smoke test if saving disappears. Missing metadata is allowed; a valid status URL and ID are required.

The injected control uses the Lucide bookmark path and its own `sfx-` CSS selectors. It does not depend on X's generated class names. The toolbar state refreshes when the library revision marker changes. The side panel follows the operating system theme by default and also offers manual light/dark choices.

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

- The library stores a link and visible metadata, not an offline snapshot of the post.
- One collection per bookmark; tags can be multiple.
- The current search scans local bookmarks in memory. A dedicated full-text index may help very large libraries.
- X DOM changes may require selector maintenance. Browser tests against real X pages should be repeated before publishing.
- There is no cloud sync or migration of X's native bookmark list.

## Future work

Add a small content-script organization popover, optional favorites, better media previews, and indexed search after the core save flow is stable. Cloud sync should remain opt-in and should not replace local storage.
