# Better X

A private, local-first Chrome extension for saving posts from X into an organized library, and downloading their photos, GIFs, and videos. Better X grew out of Saved for X 0.2.0, and also lets you clean up and adjust X itself from its side panel.

Save a post in one click. Browse, search, tag, and organize it in a side panel. Download its media at original quality. Everything stays in your browser: no account, no server, no X API.

> **Not affiliated with X Corp.** "X" and "Twitter" are trademarks of their respective owners.

## Screenshots

<p align="center">
  <img src="docs/screenshots/library.png" alt="The Better X library in the side panel, showing a saved post" width="320">
  &nbsp;
  <img src="docs/screenshots/settings.png" alt="The Better X settings panel" width="320">
</p>

<!-- TODO: add a screenshot of the Save and Download buttons on a post on x.com -->

## Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Install](#install)
- [Moving from Saved for X](#moving-from-saved-for-x)
- [Using it](#using-it)
- [Media downloads](#media-downloads)
- [Privacy and permissions](#privacy-and-permissions)
- [Settings](#settings)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [License](#license)

## Features

**Saving**

- One-click save control in every post's action row, sized and aligned to X's own icons (any layout, zoom, or font size).
- Captures the post as you see it: text, author, date, photos/videos/GIFs, the quoted post, what it replies to, and link or Article previews.
- Separate from X's native bookmarks. Nothing is sent to X.

**Library**

- Side panel with full-text search, author filter, date sort, collections, tags, and private notes.
- Bulk select to move, tag, or delete, with ten-second undo.
- JSON export and validated import, including backups from Saved for X. Existing bookmarks are never overwritten by an import.

**Downloads**

- A subtle **Saved · Download** offer appears after you save a post with media. Nothing downloads unless you click it.
- Download from the saved-post menu on X, or from any card in the library.
- Original-resolution photos, GIFs (as the MP4 files X hosts), and videos where X publishes a downloadable MP4.
- Multi-image posts open a chooser with previews and **Download all**. Quoted-post media is listed separately and never downloaded silently.
- A built-in **Downloaded** collection lists posts with at least one completed download, without moving them out of their own collection.

**Customize X**

- A **Customize** tab beside the Library with 76 settings in eight groups: navigation, home and feed, posts, account insights, smart filtering, sidebar, appearance, and ads / Grok / Premium. Search them, filter by group, open and close groups. Every setting starts off.
- Changes apply to every open X tab at once, without reloading, and turning a setting off puts back what it changed. Nothing is removed from X's page; it is hidden with style rules, so nothing needs undoing.
- What it covers: hide Ads, Grok, Premium upsells and suggested accounts; trim the menu (Explore, Communities, Lists, Messages, Notifications, Bookmarks, Jobs, Premium...); hide view, reply, repost, like and bookmark counts, follower counts, verification badges and X's own action buttons (Better X's Save stays); hide reposts, the Home composer and "Show new posts"; keep only search in the sidebar or hide it; follow Following instead of For You.
- Sliders for timeline width, sidebar width, menu spacing, menu text size and post text size.
- **Twitter branding** (Appearance): the classic blue bird as the tab icon (with the dot when you have notifications) and “Twitter” instead of “X” in the tab title, as in “Home / Twitter”. Switching either off puts X's own back.
- **Quick setups**: Clean, Minimal and Focus apply a whole combination in one click, with Undo.
- **Move your setup**: Settings → Data & backup exports your switches, sliders and theme to a small JSON file and imports it elsewhere (merge or replace), with no account. It is separate from the Library backup.
- Selectors come from Control Panel for Twitter and are checked against X-shaped test pages, not live x.com, so an X redesign can make a setting do nothing; it will not hide ordinary posts. See [docs/CONTROL-PANEL-INVENTORY.md](docs/CONTROL-PANEL-INVENTORY.md) for what is and is not covered.

**Themes for X**

- A **Themes** tab recolors x.com itself: X's own **Lights out**, twelve presets (Dim, Graphite, Midnight, Nord, Dracula, Catppuccin Mocha, Rosé Pine, Tokyo Night, Gruvbox, Solarized Dark, Forest, Ember) and **Custom** (background, text and accent, plus raised, hover, border and secondary text under Advanced, with a live preview and readability warnings). One click switches every open X tab, with Undo.
- A theme applies while X is set to Lights out and steps aside completely in X's Default (light) mode. Secondary text and links are kept readable (4.5:1) whatever colors you pick. Photos, videos and Better X's own buttons are never recolored.
- X's class names for its surfaces live in one table (`src/themes/surfaces.ts`), checked against X's own stylesheet with a console probe (`scripts/theme/probe.js`); a change on X's side leaves a patch of X's black, never unreadable text.

**Account insights and Smart filtering**

- **Account insights** (off by default): small badges after a post's @handle built from what X itself shows on a profile's “About this account” page: a flag for the country or region the account is **based in**, an Apple / Android / Web mark for how the account is **connected**, and a note when X says the location may not be accurate. Click or point at a badge for a small card (based in, connected via, joined, username changes, affiliation), with only the facts X sent.
- These are three different things and Better X keeps them apart: _based in_ is X's estimate for the account (not nationality, not where a post was written); _connected via_ is the account's platform (not the app used for one post); a location note is X's, and not proof of a VPN or of anything.
- Lookups ask x.com with your own session, the way X's own page does, are cached locally, shared between lookups of the same account, spaced out, and paused when X says to wait. By default nothing is looked up until you point at or click a badge's globe; you can choose manual, on pointer rest, or automatic for posts on screen. No third-party service, account or telemetry is involved.
- **Smart filtering** (off by default): choose countries or regions, and posts from accounts X places there are **collapsed** (with a Show post button), hidden, or highlighted. A quoted post is judged by its own author, apart from the post quoting it. **Always Show** accounts, your own posts, and the post you opened are never touched; accounts X has not answered for are never filtered. It changes only what you see.
- **Hide X Money** and **Hide Articles** remove those two menu entries and nothing else.

**Open it your way**

- Settings → **Open Better X as**: the toolbar icon opens the side panel (default) a compact popup (480, 580 or 600 px tall: Chrome allows no taller popup), or a **floating window** you can move and resize to any size, which remembers its size and position. All three are the same app; the popup has a button to open the side panel.
- Settings → **Side panel on X**: **Overlay** (default) draws the panel inside the X tab, over its right edge, so X stays exactly where it is. **Native** is Chrome's side panel, which narrows the page so X re-centers and the timeline jumps. Resize it by dragging its left edge (320 to 560 px; remembered), close it with its Close button or Esc, and toggle it with the toolbar icon, **Alt+Shift+B**, or an optional tab on X's right edge. It stays open while you click, scroll and move around X, and if you leave it open it is open on X next time and in other X tabs. Other sites still get Chrome's side panel.

**Appearance**

- Light, dark, or automatic theme, and five accent colors, applied live on X and in the library.
- Choose what happens after saving (offer a download, show a confirmation, or stay quiet) and which actions the saved-post menu shows.

## Plugins, themes and photo dragging (1.2.0)

**Plugins** (the Plugins tab): larger additions, each a card with a description, a gear for its settings and a switch. A switch takes effect in every open X tab at once and removes everything the plugin added when turned off.

**SpotifyControls** shows a player above X's account switcher: cover, title, artists, album, a seekable progress bar, and shuffle / previous / play-pause / next / repeat. Setup (once, about two minutes), all shown in the plugin's settings:

1. Open <https://developer.spotify.com/dashboard>, create an app (any name, tick **Web API**).
2. In the app's settings add the **Redirect URI** the plugin shows you (`https://<extension id>.chromiumapp.org/spotify`), exactly.
3. Paste the app's **Client ID** into the plugin (never the secret: it is not used) and press **Connect Spotify**.

Limits that come from Spotify, not Better X: playback controls need **Spotify Premium** (without it the player shows what is playing and no buttons); a new Spotify app is in development mode and works only for accounts listed under its User Management (yours by default); the player controls whatever device is already playing and cannot start playback when no Spotify app is active. An unpacked extension's id depends on the folder it is loaded from, so if you move the folder, add the new Redirect URI to your Spotify app.

**Your own themes** (the Themes tab): pick any preset or Custom, edit Background, Text, Accent and (under Advanced) Raised, Hover, Border and Secondary text with a color picker or a hex code, live on X. The accent replaces X's blue on links, tabs, buttons, switches, hover circles and the focus ring, with hover and pressed shades derived from it; keep X's own color (Settings → Display) on Blue, since X's pink and green double as its like and repost colors. **New theme** / **Save as new theme** keeps a palette under a name; named themes can be renamed, duplicated, exported to a JSON file, imported, and deleted. Themes apply while X is in Lights out (dark) and step aside, with a notice, when X is in Default (light).

**Drag to navigate photos** (Customize → Posts): in X's expanded photo viewer, drag a photo left for the next one or right for the previous one. Off by default like every customization.

## What's new in 1.3.0

- **Drag photos in the timeline.** Under **Drag to navigate photos** there is now **Also drag photos in the timeline**: drag a post's photos left or right where they are in your feed, without opening the viewer. A short drag snaps back; a plain click still opens the photo. It can only be switched on while **Drag to navigate photos** is on.
- **Mention and notification colors.** In the theme editor (Custom or one of your own themes), the new **Mentions and notifications** section sets the color of @mentions, #hashtags and links in posts and bios, the unread badge on Notifications and Messages, and the number inside it. Each follows the accent until you pick a color, and **Follow the accent** puts it back.
- **Match Better X to my X theme.** A switch at the top of the Themes tab paints Better X's own panel, popup and the overlay on X with the X theme that is on (presets, Custom and your own themes; X's Lights out when none is chosen). It overrides Better X's own light/dark and accent while on.
- **Hide “Who to follow” no longer leaves an empty box.** The whole card, border included, is hidden, also when X puts empty spacer or placeholder elements inside it.
- **Spotify connects from the background.** Chrome's sign-in window would not open from the panel when it is shown inside x.com (the overlay) or, on some Chrome builds, from the side panel, which showed “Spotify’s sign-in page could not be loaded”. The background worker now opens it, falls back to a normal tab when Chrome's window still cannot open, and the error names Chrome's own reason.

## Install

Requires Node.js 20.19+ and Chrome 116+.

```bash
git clone https://github.com/ztxv/better-x.git
cd better-x
npm ci
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `.output/chrome-mv3`.
3. Pin the extension for one-click access to the library, then refresh any open X tab.

After each rebuild, click **Reload** on the extension card and refresh X. The version shown on the card is the one in `wxt.config.ts`.

For live development, run `npm run dev`; WXT prints the output directory to load.

## Moving from Saved for X

Better X is a separate extension with its own library; it does not read Saved for X's data on its own. Move your library with a backup file:

1. In **Saved for X**, open **Settings → Export JSON** and keep the downloaded file.
2. In **Better X**, open **Settings → Import JSON** and choose that file.

Better X imports every Saved for X backup version (1, 2, and 3) as well as its own backups. What comes across:

- bookmarks with their text, author, media previews, quoted post, reply, and link card (as far as that Saved for X version recorded them);
- collections, tags, and notes;
- completed download history, shown as **Downloaded previously**.

What does not come across:

- Saved for X's settings (theme, accent, download and menu options): set them again in Better X.
- Downloaded files: they stay where they are, in `Downloads/Saved-for-X`. Better X saves new downloads to `Downloads/Better-X`.
- Anything automatic: nothing is copied from Saved for X's browser storage or database, and Saved for X keeps its own library until you remove it.

Importing the same backup twice adds nothing new, and a post already in Better X keeps its Better X notes, tags, and collection.

## Using it

1. On x.com, click the stack icon in a post's action row. The post is saved immediately and the icon fills in.
2. For posts with media, a small chip offers **Download** for a few seconds. Hovering or focusing it keeps it open.
3. Click a saved post's icon again for its menu: **Download**, **Open bookmark library**, **Remove bookmark**.
4. Click the toolbar icon to open the library. Use **Edit bookmark** for collections, tags, and notes.
5. Open **Settings** (top right of the library) for appearance, downloads, menu options, and data tools.

Keyboard: the icon and menus are ordinary buttons. Tab from the icon enters an open chip or menu, arrow keys move between actions, and Escape closes it and returns focus to the icon.

## Media downloads

Files are saved with Chrome's own downloader to `Downloads/Better-X/{handle}_{postId}_{n}.{ext}`. The extension never deletes a downloaded file.

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

| Permission                                                                 | Why                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                                  | Settings, and a small change marker that keeps open tabs and the library in sync.                                                                                                                               |
| `sidePanel`                                                                | Open the library from the toolbar icon.                                                                                                                                                                         |
| `activeTab`                                                                | Read the address of the tab you click the toolbar icon on (or press the shortcut in), only at that moment, so the panel overlay can tell an X tab from another site. No install warning, no standing access.    |
| `downloads`                                                                | Save the media you choose and follow those downloads to completion. Other downloads are never read or recorded.                                                                                                 |
| `x.com`, `twitter.com` (content script)                                    | Add the save control and read only the post you choose to save. With Account insights or country filtering on, it asks x.com (same origin, your own session) for an account's public “About this account” data. |
| `pbs.twimg.com`, `video.twimg.com`, `cdn.syndication.twimg.com`            | Verify a chosen file and find a public post's video. Contacted only when you click Download.                                                                                                                    |
| `identity`                                                                 | Open Spotify's own sign-in window when you connect the Spotify plugin. Unused otherwise.                                                                                                                        |
| `*.chromiumapp.org`                                                        | Only to notice a Spotify sign-in tab reaching its redirect address (used when Chrome's own sign-in window cannot open). Nothing is fetched from it.                                                             |
| `api.spotify.com`, `accounts.spotify.com`, `*.scdn.co`, `*.spotifycdn.com` | The Spotify plugin only: what is playing, playback commands, sign-in, and cover art. Contacted only while that plugin is on and connected.                                                                      |

The Spotify plugin is the one place a sign-in is kept: its tokens stay in this browser's extension storage, are used only by the background worker to talk to Spotify, are never sent to X or put in any backup, and are removed by Disconnect. There is no client secret.

No browsing history, no all-site access, no analytics, no remote code. Better X never stores or sends a cookie, token or header: account lookups read X's `ct0` page token for the one request and keep nothing. The cached account facts (public data X showed on profiles) stay on this device, are not part of any backup, and can be cleared in Customize → Account insights.

## Settings

| Setting               | Default                | Effect                                                       |
| --------------------- | ---------------------- | ------------------------------------------------------------ |
| Theme                 | Auto                   | Library theme. Menus on X follow X's own display setting.    |
| Accent color          | Blue                   | Icon, focus rings, and highlights, on X and in the library.  |
| Show download options | On                     | Hides download actions when off. History is kept.            |
| After saving          | Saved + Download       | Offer a download, confirm only, or stay quiet.               |
| Ask where to save     | Off                    | Chrome's own "Ask where to save" setting may still prompt.   |
| Saved-post menu       | Download, Open library | **Remove bookmark** is always available.                     |
| Open Better X as      | Side panel             | Side panel, popup, or floating window.                       |
| Side panel on X       | Overlay                | Overlay keeps X centered; Native shifts X (side panel mode). |
| Tab on X's right edge | Off                    | Overlay only: a small tab that opens the overlay.            |

Reset customization never touches your data. The Customize tab's own settings (the switches, sliders and country filter choices) are separate: they are kept by that reset, and **Turn everything off** at the bottom of the tab clears them.

## Architecture

Built with [WXT](https://wxt.dev) (Manifest V3), React 19, and TypeScript in strict mode.

```
entrypoints/
  background.ts      Message router, download events (service worker)
  content.ts         Content-script entry on X: starts the runtime, then Saved
  sidepanel/         Library UI entry
src/
  runtime/           Shared X runtime: scopes, post stream, action row, routes, layout
  saved/             Save control, post-save chip, saved-post menu, downloads (on X)
  features/          The 65 customization features by category, their registry, CSS helpers and quick setups
  x/                 X DOM extraction and URL rules (all selectors live here)
  media/             URL rules, metadata adapter, media resolution
  downloads/         History store, lifecycle service, file naming, wording
  storage/           IndexedDB connection and bookmark repository
  lib/               Settings, validation, sanitizers, messaging
  sidepanel/         React components and styles
  content/           Overlay placement and styles for the X page; the in-page panel overlay
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

- **Unit tests (Vitest):** DOM extraction including avatar regressions, URL rules, the metadata adapter against recorded responses, media resolution outcomes, the download lifecycle with a scripted `chrome.downloads`, repository atomicity, settings (including migration from versions 1 and 2), backup round-trips, opening a version 1 database, the feature registry and catalog (ids, ranges, selector rules), slider values, quick setups, the sidebar marker, and the Customize view (search, groups, sliders, keyboard, motion limits).
- **End-to-end (`npm run smoke`):** loads the unpacked build in installed Chrome against an X-shaped page, then saves and downloads real media from X's CDNs. Covers photos, GIFs, a blob-player video, partial batches, quoted media, keyboard use, placement, two tabs saving at once, live settings, dark theme, reduced motion, and stopping the worker mid-download. A second run (`scripts/smoke/catalog.mjs`) checks every customization on a 65-feature X-shaped page: what each hides, what it must leave alone, route, layout and sidebar changes, and that all of them together leave Save alone. Another reloads the extension under an open tab and checks everything is taken off the page.

The smoke test does not use a signed-in X account. Verify against real x.com after changes to selectors or media handling.

## Known limitations

- The library stores links, metadata, and thumbnail URLs, not offline copies. Thumbnails stop loading if X removes the media.
- Video downloads depend on an undocumented X endpoint and do not cover protected or withheld posts.
- Only downloads started by this extension are tracked.
- One collection per bookmark; tags can be multiple.
- No sync between browsers. Use JSON export and import to move a library.
- X's markup changes over time and may require selector updates.
- Account insights read X's internal `AboutAccountQuery`. It could not be tried against live x.com from here (X refuses automated browsers); if X changes the query id, headers or response, the badges and the country filter stop working and nothing is shown or filtered. See docs/MANUAL-CHECKLIST.md.
- Flags are Unicode flag glyphs: Windows shows two letters (for example “DE”) instead of a flag.
- The post's own client (“Twitter for iPhone”) is not shown; see docs/ARCHITECTURE.md.
- The panel overlay covers the right edge of X (on a narrow window, part of the timeline). That is the trade for X not moving; use Native to have X make room instead. If the toolbar icon is clicked on a tab that left X for another site while the overlay owned it, and the click is what woke Better X's background worker, that one click does nothing (Chrome only opens a side panel inside the click); the next one opens it. The overlay has not been tried on live x.com from here.

## Roadmap

- **Chat themes:** theming X's Chat, which lives in shadow DOM where page styles cannot reach (built partly, switch hidden for now).
- **More X customization:** the settings that need X's internals (feature flags, React state, network responses), such as separated reposts, sorting, restoring the post source and counts. Listed in [docs/CONTROL-PANEL-INVENTORY.md](docs/CONTROL-PANEL-INVENTORY.md); design in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Indexed search for very large libraries.
- Optional sync, opt-in only.

## License

[MIT](LICENSE). You can use, modify, and redistribute the project, including for commercial use, under the terms in `LICENSE`. Third-party credits are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
