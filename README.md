# Saved for X

A local-first Chrome extension for saving posts from X into a searchable, organized library. Save a post in one click, then manage it in a clean side panel.

## What it does

- Adds a distinct blue stack save control to posts on `x.com` and `twitter.com`, aligned with X's own action icons.
- Stores a canonical post URL, post ID, text, author, and date, plus the context visible when you save: photo/video/GIF thumbnails, the quoted post (author, text, media), what the post replies to, and link or X Article previews.
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

1. Open X on desktop and click the blue stack icon added to a post's action row. It fills when saved; X's own bookmark remains separate.
2. Click the extension icon to open the library.
3. Use **Edit bookmark** to add a collection, tags, or a private note.
4. Use **Select bookmarks** to select individual posts or all current results, then move them to a collection, add a tag, or delete them together. Changing a search or filter clears the selection.
5. Deleting from the library is immediate, with a ten-second **Undo** action.
6. Open **Settings and data** to export or import a JSON library, or to **Clear all bookmarks**. Clearing asks for confirmation, states how many bookmarks will be deleted, keeps collections and appearance settings, and offers a backup export first and a ten-second Undo afterwards.

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

## Interface assets

The stack mark uses the installed Lucide `Layers2` icon (`src/brand/mark.svg`), shared by the injected control, side panel, and toolbar assets. Its color is X's current brand blue, `#1d9bf0` (X's `--x-fg-brand` / `--color-blue-500` token, `hsl(204 88% 53%)`, read from x.com's stylesheet on 2026-10-02). Small accent text on light surfaces uses X's own light-theme accent foreground, `blue-700` (`#006fd6`), for 4.5:1 contrast. The panel uses `lucide-react`. Interaction feedback uses CSS transitions and animations, respecting `prefers-reduced-motion`; no animation dependency is required.
