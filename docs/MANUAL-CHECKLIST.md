# Manual real-X checklist

Run on real x.com, signed in, after changes to selectors, content scripts, overlays, or media handling, and before every release. The smoke test and performance fixture are not real X.

Setup: `npm run build`, load `.output/chrome-mv3` unpacked (or click **Reload** on the extension card), then refresh any open X tabs. Use public posts you choose at test time. Do not record account names, post links, or screenshots with personal information in the repository.

Record the date, extension version, Chrome version, and any failures in the PR or release notes.

- [ ] The extension card and toolbar tooltip read **Better X** / **Open Better X**, and the side panel header reads **Better X**.

## Saving

- [ ] **Save a post:** click the save control in a text-only post's action row. The icon fills in, the "Saved" chip appears, and the control lines up with X's own icons.
- [ ] **Remove a saved post:** click a saved post's control, choose **Remove bookmark**. The icon empties and the post leaves the library.
- [ ] **Save a post with photos:** save a multi-photo post. The library card shows the photos and text, without media from any quoted post.
- [ ] **Saved menu:** click a saved post's control. The menu opens next to it, arrow keys move between actions, Escape closes it and returns focus, and it closes when the post scrolls away.

## Downloads

- [ ] **GIF:** save a GIF post, click **Download** in the chip. One `.mp4` lands in `Downloads/Better-X/` and the post appears in **Downloaded**.
- [ ] **Video:** save a public video post and download it. An `.mp4` is saved (never a poster image or playlist). A video that cannot be downloaded shows "Video unavailable to download" with **Open post on X**.
- [ ] **Photos:** download from a multi-photo post. The chooser lists each photo and **Download all** saves originals.

## Library

- [ ] **Open the library** from the toolbar icon and from **Open bookmark library** in the saved menu.
- [ ] **Search** by text and by author; results update as you type, and clearing restores the list.
- [ ] Edit a bookmark's collection, tags, and note; the change persists after closing and reopening the panel.

## Theme and layout

- [ ] **Light and dark X:** switch X's display background (Default and Lights out). The save control, chip, and menu follow X's theme, not the OS theme.
- [ ] **Wide layout:** full-width window with X's sidebar visible. Controls align in the home timeline, a focused post, and a reply thread.
- [ ] **Narrow layout:** narrow the window (or open the side panel) until X drops the sidebar and then switches to its narrow layout. Controls stay aligned, overlays stay on screen, and saving still works.
- [ ] Browser zoom at 80% and 125%: the control stays aligned.

## Navigation and layout (routes, side panel)

Not yet verified on live X: the automated tests use a fixture, and X refuses automated browsers. Do these on real, signed-in x.com with the extension loaded. To watch the runtime, open DevTools, select the **Elements** panel and look at the `<html>` element: it carries `data-bx-route` (for example `home`, `post`, `profile`, `search`, `compose`) and `data-bx-layout` (`wide` or `narrow`).

- [ ] **Route changes:** go Home, open a profile, open a post (click it, do not reload), open Search. `data-bx-route` follows each click with no reload (`home`, `profile`, `post`, `search`).
- [ ] **Back and forward:** use the browser's Back and Forward buttons through those pages. `data-bx-route` follows, and the save control is still present on every post.
- [ ] **Modals:** open the composer (the **Post** button) and a photo in a post. `data-bx-route` becomes `compose` / `media`; closing returns it. The timeline behind does not lose its save controls.
- [ ] **Side panel / narrow layout:** with a timeline open, click the Better X toolbar icon so the side panel opens. If X switches to its narrow (bottom-navigation) layout, `data-bx-layout` changes to `narrow` with no route change; close the panel and it returns to `wide`. The save controls stay aligned in both.
- [ ] **Saving after navigation:** navigate between three or four pages without reloading, then save a post on the last one. The control saves, the chip appears, and the control stays aligned; remove it again from the saved menu.
- [ ] **Scrolling a long timeline** (hundreds of posts): exactly one save control per post, none missing and none doubled, including on posts that X recycled as you scrolled.
- [ ] **Extension reload:** click **Reload** on the extension card with an X tab open. The old controls disappear on the tab's next navigation or scroll (no dead buttons stay behind); refreshing the tab brings the new ones.
