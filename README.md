# Saved for X

A private, local-first Chrome extension for saving posts from X into an organized library, and downloading their photos, GIFs, and videos.

Save a post in one click. Browse, search, tag, and organize it in a side panel. Download its media at original quality. Everything stays in your browser: no account, no server, no X API.

> **Not affiliated with X Corp.** "X" and "Twitter" are trademarks of their respective owners.

## Contents

- [Features](#features)
- [Install](#install)
- [Using it](#using-it)
- [Media downloads](#media-downloads)
- [Privacy and permissions](#privacy-and-permissions)
- [Settings](#settings)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

## Features

**Saving**

- One-click save control in every post's action row, sized and aligned to X's own icons (any layout, zoom, or font size).
- Captures the post as you see it: text, author, date, photos/videos/GIFs, the quoted post, what it replies to, and link or Article previews.
- Separate from X's native bookmarks. Nothing is sent to X.

**Library**

- Side panel with full-text search, author filter, date sort, collections, tags, and private notes.
- Bulk select to move, tag, or delete, with ten-second undo.
- JSON export and validated import. Existing bookmarks are never overwritten by an import.

**Downloads**

- A subtle **Saved · Download** offer appears after you save a post with media. Nothing downloads unless you click it.
- Download from the saved-post menu on X, or from any card in the library.
- Original-resolution photos, GIFs (as the MP4 files X hosts), and videos where X publishes a downloadable MP4.
- Multi-image posts open a chooser with previews and **Download all**. Quoted-post media is listed separately and never downloaded silently.
- A built-in **Downloaded** collection lists posts with at least one completed download, without moving them out of their own collection.

**Customization**

- Light, dark, or automatic theme, and five accent colors, applied live on X and in the library.
- Choose what happens after saving (offer a download, show a confirmation, or stay quiet) and which actions the saved-post menu shows.

## Install

Requires Node.js 20.19+ and Chrome 116+.

```bash
git clone <repository-url>
cd x-bookmarker
npm ci
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `.output/chrome-mv3`.
3. Pin the extension for one-click access to the library, then refresh any open X tab.

After each rebuild, click **Reload** on the extension card and refresh X. The version shown on the card is the one in `wxt.config.ts`.

For live development, run `npm run dev`; WXT prints the output directory to load.

## Using it

1. On x.com, click the stack icon in a post's action row. The post is saved immediately and the icon fills in.
2. For posts with media, a small chip offers **Download** for a few seconds. Hovering or focusing it keeps it open.
3. Click a saved post's icon again for its menu: **Download**, **Open bookmark library**, **Remove bookmark**.
4. Click the toolbar icon to open the library. Use **Edit bookmark** for collections, tags, and notes.
5. Open **Settings** (top right of the library) for appearance, downloads, menu options, and data tools.

Keyboard: the icon and menus are ordinary buttons. Tab from the icon enters an open chip or menu, arrow keys move between actions, and Escape closes it and returns focus to the icon.

## Media downloads

Files are saved with Chrome's own downloader to `Downloads/Saved-for-X/{handle}_{postId}_{n}.{ext}`. The extension never deletes a downloaded file.

| Media                                                         | Supported                    | How                                                                |
| ------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Photos                                                        | Yes                          | Original resolution, in the format X serves.                       |
| GIFs                                                          | Yes                          | Saved as the MP4 X actually hosts.                                 |
| Videos, public posts                                          | Yes, when X publishes an MP4 | Looked up on demand from X's public post-metadata endpoint.        |
| Videos, protected / deleted / age-restricted / withheld posts | No                           | Shows "Video unavailable to download" and a link to open the post. |
| Stream-only videos                                            | No                           | A preview image or playlist is never saved as a video.             |

A post enters **Downloaded** only when Chrome reports a download as complete. Partial batches show as "2 of 4 downloaded" with a retry for the rest. Removing a bookmark keeps its download history, and the library distinguishes **File available locally** from **Downloaded previously**.

The video lookup uses an undocumented X endpoint, so it can change without notice. If it does, videos report as unavailable instead of failing silently; photos and GIFs are unaffected. Details and the evidence behind these choices are in [DEVELOPMENT.md](DEVELOPMENT.md#downloads).

## Privacy and permissions

All data lives in your browser. Exports contain metadata only, never media files or local file paths.

| Permission                                                      | Why                                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `storage`                                                       | Settings, and a small change marker that keeps open tabs and the library in sync.                               |
| `sidePanel`                                                     | Open the library from the toolbar icon.                                                                         |
| `downloads`                                                     | Save the media you choose and follow those downloads to completion. Other downloads are never read or recorded. |
| `x.com`, `twitter.com` (content script)                         | Add the save control and read only the post you choose to save.                                                 |
| `pbs.twimg.com`, `video.twimg.com`, `cdn.syndication.twimg.com` | Verify a chosen file and find a public post's video. Contacted only when you click Download.                    |

No browsing history, no all-site access, no credentials, no analytics, no remote code.

## Settings

| Setting               | Default                | Effect                                                      |
| --------------------- | ---------------------- | ----------------------------------------------------------- |
| Theme                 | Auto                   | Library theme. Menus on X follow X's own display setting.   |
| Accent color          | Blue                   | Icon, focus rings, and highlights, on X and in the library. |
| Show download options | On                     | Hides download actions when off. History is kept.           |
| After saving          | Saved + Download       | Offer a download, confirm only, or stay quiet.              |
| Ask where to save     | Off                    | Chrome's own "Ask where to save" setting may still prompt.  |
| Saved-post menu       | Download, Open library | **Remove bookmark** is always available.                    |

Reset customization never touches your data.

## Architecture

Built with [WXT](https://wxt.dev) (Manifest V3), React 19, and TypeScript in strict mode.

```
entrypoints/
  background.ts      Message router, download events (service worker)
  content.ts         Save control, post-save chip, saved-post menu (on X)
  sidepanel/         Library UI entry
src/
  x/                 X DOM extraction and URL rules (all selectors live here)
  media/             URL rules, metadata adapter, media resolution
  downloads/         History store, lifecycle service, file naming, wording
  storage/           IndexedDB connection and bookmark repository
  lib/               Settings, validation, sanitizers, messaging
  sidepanel/         React components and styles
  content/           Overlay placement and styles for the X page
```

Key decisions:

- **Local-first.** IndexedDB holds bookmarks and download history; `chrome.storage.local` holds settings.
- **Identity, not URLs, across the message boundary.** The page asks to download "media 2 of post N". The background re-reads the saved post and derives every URL itself, so there is no generic "fetch this URL" handler.
- **Downloads are owned by the background worker.** Intent is stored before Chrome is asked, Chrome's ID is bound and reconciled, terminal states are idempotent, and nothing restarts automatically after a worker restart.
- **Atomic writes.** Saves and download state changes are single transactions, so two tabs acting at once cannot overwrite notes, tags, or history.
- **Selectors are isolated.** X changes its markup; everything that depends on it is in `src/x/selectors.ts`.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full design, DOM assumptions, and the download lifecycle.

## Development

```bash
npm run dev       # WXT dev build with reload
npm run check     # type-check
npm test          # unit tests
npm run build     # production build to .output/chrome-mv3
npm run smoke     # real-Chrome end-to-end test (network required)
npm run format    # Prettier
```

## Testing

- **Unit tests (Vitest):** DOM extraction including avatar regressions, URL rules, the metadata adapter against recorded responses, media resolution outcomes, the download lifecycle with a scripted `chrome.downloads`, repository atomicity, settings, backup round-trips, and opening a version 1 database.
- **End-to-end (`npm run smoke`):** loads the unpacked build in installed Chrome against an X-shaped page, then saves and downloads real media from X's CDNs. Covers photos, GIFs, a blob-player video, partial batches, quoted media, keyboard use, placement, two tabs saving at once, live settings, dark theme, reduced motion, and stopping the worker mid-download.

The smoke test does not use a signed-in X account. Verify against real x.com after changes to selectors or media handling.

## Known limitations

- The library stores links, metadata, and thumbnail URLs, not offline copies. Thumbnails stop loading if X removes the media.
- Video downloads depend on an undocumented X endpoint and do not cover protected or withheld posts.
- Only downloads started by this extension are tracked.
- One collection per bookmark; tags can be multiple.
- No sync between browsers. Use JSON export and import to move a library.
- X's markup changes over time and may require selector updates.

## Roadmap

- **Page cleanup (planned, separate from saving):** optional controls to hide promoted posts, Who to follow, Premium upsells, and Grok and Messages entry points. Designed as its own settings area so the bookmarking and download features stay independent.
- Indexed search for very large libraries.
- Optional sync, opt-in only.
