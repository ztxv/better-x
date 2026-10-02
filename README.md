# Saved for X

A local-first Chrome extension for saving posts from X into a searchable, organized library. Save a post in one click, then manage it in a clean side panel.

## What it does

- Adds a small save control to posts on `x.com` and `twitter.com`.
- Stores a canonical post URL, post ID, text, author, and date when available.
- Opens a Chrome side panel with search, author filtering, date sorting, collections, tags, and private notes.
- Supports light and dark appearance, JSON export, and validated JSON import that keeps existing bookmarks.
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

1. Open X on desktop and click the bookmark outline added to a post's action row.
2. Click the extension icon to open the library.
3. Use **Edit bookmark** to add a collection, tags, or a private note.
4. Open **Settings and data** to export or import a JSON library.

Clicking a saved post's extension control opens a small menu to open the library or remove the bookmark. The bookmark's main area in the side panel opens the original post in a new tab.

## Privacy and permissions

| Access                                           | Why it is needed                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `storage`                                        | Broadcast a tiny revision marker when the local library changes so open X tabs and the side panel refresh their state. |
| `sidePanel`                                      | Open the library from the toolbar icon.                                                                                |
| `x.com` and `twitter.com` content script matches | Add save controls and read only the visible post that you choose to save.                                              |

Bookmarks, collections, tags, and notes are stored in the extension's IndexedDB database. `chrome.storage.local` contains only the revision marker. Export files are created locally. The extension does not request browsing history, all-site access, X credentials, or cloud access.

## Quality checks

```bash
npm run check
npm test
npm run build
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, DOM assumptions, and future work.
