# Saved for X

A local-first Chrome extension for saving posts from X into a searchable, organized library. Save a post in one click, then manage it in a clean side panel.

## What it does

- Adds a distinct blue stack save control to posts on `x.com` and `twitter.com`, aligned with X's own action icons.
- Stores a canonical post URL, post ID, text, author, and date, plus the context visible when you save: photo/video/GIF thumbnails, the quoted post (author, text, media), what the post replies to, and link or X Article previews.
- Opens a Chrome side panel with search, author filtering, date sorting, collections, tags, and private notes.
- Offers a subtle **Download** after you save a post with media, and in the saved-post and library menus: original-resolution photos, GIFs (as MP4, which is what X stores), and videos when X publishes a downloadable MP4 for the post (see [Media downloads](#media-downloads)).
- Lists posts you downloaded in a built-in **Downloaded** collection, without moving them out of their own collection.
- Supports light and dark appearance, five accent colors, download and menu preferences, JSON export, and validated JSON import that keeps existing bookmarks.
- Keeps bookmark data in your browser. There is no account, server, or X API integration.

## Install for development

Requires Node.js 20.19+ and Chrome 116+.

```bash
npm ci
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3` from this project. Pin the extension if you want one-click access to the side panel. Reload the extension after each production build.

For live development, run `npm run dev` and load WXT's generated Chrome output. WXT prints the output path in its terminal.

## Use

1. Open X on desktop and click the blue stack icon added to a post's action row. It saves immediately and fills; X's own bookmark remains separate. For a post with media, a small **Saved · Download** chip appears beside the icon for a few seconds (it waits while you hover or focus it). Nothing downloads unless you click it.
2. Click the extension icon to open the library.
3. Use **Edit bookmark** to add a collection, tags, or a private note.
4. Use **Select bookmarks** to select individual posts or all current results, then move them to a collection, add a tag, or delete them together. Changing a search or filter clears the selection.
5. Deleting from the library is immediate, with a ten-second **Undo** action.
6. Open **Settings and data** for appearance (theme, accent), downloads (show download options, what happens after saving, ask where to save), and which actions the saved-post menu shows. **Reset customization** never touches your data. The **Data** section exports or imports a JSON library, clears all bookmarks, or clears download history; each clear asks first and offers a ten-second Undo.

Clicking a saved post's extension control opens a small menu: **Download image / video / media…**, **Open bookmark library**, and **Remove bookmark**. Several media items open a chooser with previews and **Download all**; quoted media is listed separately and only downloaded when you choose it. In the library, a card's **⋯** menu offers the same download, and the bookmark's main area opens the original post in a new tab.

## Media downloads

Files save through Chrome's own downloader to `Downloads/Saved-for-X/{handle}_{postId}_{n}.{ext}`. A post appears in **Downloaded** only when Chrome reports a download as complete; partial batches show "2 of 4 downloaded". Removing a bookmark, clearing history, or clearing bookmarks never deletes files, and a removed bookmark stays in Downloaded (marked _Not in bookmarks_, with **Save bookmark**). The library shows **File available locally** while Chrome still finds the file, and **Downloaded previously** for files moved or deleted, or history imported from another browser.

| Media                                                           | Supported                    | How                                                                                                |
| --------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Photos                                                          | Yes                          | Original resolution (`name=orig`) in the format X serves.                                          |
| GIFs                                                            | Yes                          | Saved as the MP4 file X actually hosts.                                                            |
| Videos on public posts                                          | Yes, when X publishes an MP4 | Looked up on demand from X's public post-metadata endpoint, the one X's embedded-post widget uses. |
| Videos on protected, deleted, age-restricted, or withheld posts | No                           | Shows **Video unavailable to download** with **Open post on X**.                                   |
| Stream-only videos (no MP4 offered)                             | No                           | Never saves the poster image or a playlist as a video.                                             |

The video lookup is an undocumented X endpoint: it can change without notice, and the extension then reports videos as unavailable rather than guessing. Photos and GIFs do not depend on it.

## Privacy and permissions

| Access                                                          | Why it is needed                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                                                       | Broadcast a tiny revision marker when the local library changes so open X tabs and the side panel refresh their state.                                 |
| `sidePanel`                                                     | Open the library from the toolbar icon.                                                                                                                |
| `x.com` and `twitter.com` content script matches                | Add save controls and read only the visible post that you choose to save.                                                                              |
| `downloads`                                                     | Save media you choose with Chrome's downloader, and follow those downloads to completion. Other downloads are never read or recorded.                  |
| `pbs.twimg.com`, `video.twimg.com`, `cdn.syndication.twimg.com` | Check that a chosen photo or video file exists and find its real type, and look up a public post's video file. Only contacted when you click Download. |

Bookmarks, collections, tags, notes, and download history are stored in the extension's IndexedDB database. `chrome.storage.local` contains settings and revision markers. Export files are created locally and contain metadata only, never media files or local file paths. The extension does not request browsing history, all-site access, X credentials, or cloud access.

## Quality checks

```bash
npm run check
npm test
npm run build
npm run smoke   # real Chrome + network; see DEVELOPMENT.md
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, DOM assumptions, and future work.

## Interface assets

The stack mark uses the installed Lucide `Layers2` icon (`src/brand/mark.svg`), shared by the injected control, side panel, and toolbar assets. Its default color is X's current brand blue, `#1d9bf0` (X's `--x-fg-brand` / `--color-blue-500` token, `hsl(204 88% 53%)`, read from x.com's stylesheet on 2026-10-02). Small accent text on light surfaces uses X's own light-theme accent foreground, `blue-700` (`#006fd6`), for 4.5:1 contrast. The panel uses `lucide-react`. Interaction feedback uses CSS transitions and animations, respecting `prefers-reduced-motion`; no animation dependency is required.
