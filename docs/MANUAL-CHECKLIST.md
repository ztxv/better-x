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

## Customize (Hide Ads, Hide Grok, Hide For You)

Not yet verified on live X: the automated tests use an X-shaped fixture, and X refuses automated browsers. These features depend on X's current markup (see "Fragility" in `docs/ARCHITECTURE.md`), so run this on real, signed-in x.com after any change to them and whenever X changes. In the side panel, open **Customize**. All three switches start off. Leave an X tab open while you flip each one: it should change without a reload.

- [ ] **Hide Ads:** on Home, scroll until a post is marked _Ad_ or _Promoted_. With the switch on, it disappears (note whether the timeline jumps or leaves a blank gap where it was); with it off, it is back. Ordinary posts are never hidden. Also look at the Trends in the sidebar for a promoted trend, and open the **More** menu for an **Ads** link.
- [ ] **Hide Grok:** with it on, the Grok entry is gone from the side navigation (and from the menus and the bottom bar when the window is narrow), along with the Grok button on posts, "Ask Grok" links, suggested follow-up prompts under a post, the Grok summary at the top of a search, and the Grok promo in the sidebar. A post that merely mentions Grok is still there. With it off, everything is back. (The "Grok actions" button is only matched in English.)
- [ ] **Hide For You:** with it on, Home switches to **Following** and the **For you** tab disappears; opening a profile and coming back, or pressing the Home button again, leaves you on Following. With the switch off, **For you** reappears and you are not moved off whichever feed you are on. Try it with pinned lists (their tabs stay), in the narrow layout (open the side panel), and on a profile, search and list page, where nothing should change.
- [ ] **Together:** turn all three on, save a post, download its media, and use the keyboard Tab/Enter flow on the save control. Saving and downloading work as usual.
- [ ] **Persistence:** close and reopen the side panel, and restart Chrome: the switches keep their state. Reload the extension from the extensions page with an X tab open: the open tab's changes disappear on its next navigation or scroll, and a refresh brings them back.

## Customize: the interface

- [ ] **Search:** type `sidebar`, `counts`, `ads`. The list narrows as you type, the summary says how many were found, groups with matches open by themselves, and a word that matches nothing shows "No settings match" with a way back. Escape and the clear button empty the search.
- [ ] **Groups and chips:** open and close each group (the arrow turns, nothing jumps); choose a chip to see one group; counts on chips and groups match the switches that are on. Close and reopen the panel: the open groups are as you left them.
- [ ] **Library and Customize keep their state:** type in both searches, switch tabs back and forth; each keeps its text. Library bookmarks, collections and downloads still work.
- [ ] **Keyboard:** Tab reaches search, chips, group headers, switches and sliders in order; Space flips a switch; arrow keys, Home, End and Page Up/Down move a slider; `/` focuses the search when nothing is being typed.
- [ ] **Sliders:** drag one on an open X tab and watch X follow. Off, the slider is greyed and reads "Turn on to adjust."; the reset arrow returns it to its default.
- [ ] **Quick setups:** Clean, Minimal and Focus each turn on a combination and replace what was on before; **Undo** puts back exactly the previous switches and numbers. Saved and download settings are not changed (check Settings).
- [ ] **Turn everything off** asks first, then clears every switch and slider; the open X tabs go back to normal at once.
- [ ] **Motion:** transitions are short. With the operating system's "reduce motion" on, groups open instantly.
- [ ] **Two windows or tabs:** change a setting; every open X tab follows, and the panel in another window shows it.

## Customize: what each group should do on real X

Everything below is CSS written from Control Panel for Twitter's selectors and checked only on X-shaped fixtures. For each, turn it on, look, turn it off, look. Note any case where it hides nothing, hides too much, or leaves a gap. Do it in the wide layout first, then open the side panel (narrow layout) and repeat the ones marked **N**.

**Navigation** (menu items disappear from the side navigation, the **More** menu, and the bottom bar when narrow; the pages themselves still open)

- [ ] **Hide Explore** removes Explore only while X shows its sidebar; with the sidebar gone (narrow window) Explore comes back, so search is never lost. **N**
- [ ] **Communities, Lists, Messages, Bookmarks, Jobs, Premium, Business, Connect, Spaces, History, Creator Studio and subscriptions:** each hides its own entry and nothing next to it. Notifications hides only the nav entry, never the tabs on the Notifications page. Creator Studio also hides Monetization and Subscriptions under Settings.
- [ ] **Hide notification counts** removes the unread dots on Notifications, Messages and your avatar, and not the entries. **N**
- [ ] **Hide the Post button, account switcher details, Messages drawer:** the Post button goes (nav and floating); the account button keeps its menu but loses avatar and name; the chat panel at the bottom right goes.

**Home and feed**

- [ ] **Show new posts, Home composer, Manage timelines:** each disappears on Home only (check a profile, where they should be untouched). Posting still works from the Post button.
- [ ] **Timeline prompts, Who to follow in the timeline, suggestions on profiles, Explore page contents:** the modules go; real posts around them do not. Open Explore: only search is left.
- [ ] **Reposts on Home / on profiles:** reposts go; a pinned post on a profile stays.
- [ ] **Like and repost notifications:** open Notifications; those rows go, follows and mentions stay.

**Posts**

- [ ] **Views, reply, repost, like and bookmark counts, follower counts, post totals:** the number goes and the button stays. Look at a timeline post, a post's own page, the media viewer, a profile and a hover card.
- [ ] **X's bookmark button, share button, View post engagements, Sort replies:** each button goes; Better X's **Save** button is always still there and still works.
- [ ] **Simplify post actions:** X's reply/repost/like/share/views row is gone, and only Save is left; nothing else on the post is hidden.
- [ ] **Verification badges and Plain post text:** badges (all kinds) go; bold and italic in post text become regular.

**Sidebar** (wide layout, window wide enough that X shows the sidebar)

- [ ] **Hide the sidebar, keep only search, What's happening, Today's News, Who to follow, Premium card, footer links:** each removes its own section. Note any leftover gap or border where a section was. Who to follow stays on a post's own page ("Relevant people"). Search results and communities keep the extra section when "keep only search" is on.

**Appearance**

- [ ] **Timeline width** (Home, lists, communities only), **Sidebar width, Menu spacing, Menu text size, Post text size:** drag and compare with X's own sizes (600, 350, 20, 15). Look for overlap or a squeezed sidebar at the extremes, with the sidebar on and off.
- [ ] **System font** and **Lighter menu text:** text changes everywhere / in X's popup menus, and nothing is clipped.

**Ads, Grok and Premium**

- [ ] **Hide Ads** (also promoted notifications), **Grok image editing, posts sharing Grok chats, Premium upsells, creator subscriptions, Verified Followers tab:** each removes only its own surface; look at your own profile, Settings, the composer, a post's menu and a followers list.

**Together**

- [ ] Turn on a Quick setup, then use Saved: save, remove, download, open the Library. Reload the extension from the extensions page with an X tab open: the open tab goes back to normal on its next navigation or scroll.

## Quality-of-life fixes (sidebar card, badge, settings backup, popup)

Not verified on live X: the automated checks use X-shaped fixtures.

- [ ] **Hide “Who to follow” leaves no gap.** Turn it on with the sidebar showing. The whole card goes: no empty bordered box, no blank band, and the card below moves up. Trends, Today's News, search and other cards stay. Turn it off: the card is back at once. Also check on a post's own page (“Relevant people” stays) and after X re-renders the sidebar (scroll, switch tabs, wait for trends to refresh). If a box or gap remains, open DevTools on that card and note which element has the border: it is what `climbToCard` in `src/features/sidebar-cards.ts` must reach. Do the same for **Hide the Premium card**.
- [ ] **Downloaded badge.** Library → Downloaded, with a post that was imported from history: “Downloaded previously” sits inside its pill with even padding, at the narrowest side panel and in the popup.
- [ ] **Settings backup.** Settings → Data & backup → Export customization settings, change a few switches and preferences (density, After saving, the saved-post menu), then Import that file: the preview counts make sense, Merge and Replace behave as described, and open X tabs update. A Library backup file is refused here, and the Library buttons still work.
- [ ] **Popup mode.** Settings → Open Better X as → Popup. Click the toolbar icon: a compact window opens (no side panel). It closes when you click elsewhere. Library and Customize both work, scroll with many posts, and match the side panel. **Open in side panel** (header) opens the panel. Switch back to Side panel from inside the popup, and the icon opens the panel again. Restart Chrome in each mode: the icon still does what you chose.

## Account insights and Smart filtering

**Not verified on live x.com.** The automated checks answer X's `AboutAccountQuery` with bodies shaped like ones recorded from x.com by another extension's test suite (X blocks automated browsers). Whether the real request still works for your session, and whether the badge lands in the right place in your layout, only you can confirm. Do these on a normal signed-in x.com tab after reloading the extension.

- [ ] **Account lookup works at all.** Customize → Account insights: turn on **Show country flags**, pick **Automatically for posts on screen**. Scroll Home. Flags should appear beside @handles within a few seconds. Open DevTools → Network, filter `AboutAccountQuery`: requests should be spaced (about two a second at most), one per account, same-origin to x.com, status 200. If every request is 400/404, X changed the query: `ABOUT_QUERY_ID` in `src/x/about-transport.ts` needs the new id. If 401/403, check you are signed in. Nothing is sent to any other host.
- [ ] **Country badge on a real post.** The flag sits right after the @handle, on the same line as the dot and time, with no wrapping, in the wide layout and a narrow window. It does not touch the verification check, the name link, or the Save button. Check a repost and a reply too. If it is missing or misplaced, note the markup of the name row (`data-testid="User-Name"`) so `badgeSlot` in `src/insights/badges.ts` can follow it.
- [ ] **Connection-source badge.** Turn on **Show connection-source badges**: an Apple, Android or Web mark appears for accounts X reports one for. Hover it: the tooltip says it is the account's platform, not the app used for that post. Compare with the account's own `/about` page (x.com/handle/about): “Account based in” and “Connected via” should match the flag and mark.
- [ ] **Account details.** Turn on **Show account details**. Click a badge (or rest the pointer on it): a card shows Based in, Connected via, Joined, Username changes, and a location-accuracy row only when X reports one; no row has a made-up value. Escape closes it and returns focus to the badge; scrolling the post away closes it; **Refresh** asks X again for that account only. Check near the right and bottom edges.
- [ ] **Location warning.** Turn on **Show location warnings**. An account X flags as possibly inaccurate shows a small triangle whose tooltip says it is a note from X and not proof of anything.
- [ ] **Lookup modes.** Hover mode (default): a faint globe appears beside names, nothing is requested until you rest the pointer on one. Manual: only a click. Check the Network tab each time.
- [ ] **Country filter on the Home timeline.** Smart filtering → turn on **Filter posts by account country**, add a country you can see in your feed. Posts from accounts based there collapse to “Post hidden by Better X · Country: …” with **Show post**. Scroll far down and back up (X recycles post elements): the right posts are collapsed, and no ordinary post is. Accounts X has not answered for are never collapsed.
- [ ] **Quoted-post collapse and reveal.** Find (or wait for) a post whose quoted post is by an account in the selected country, while the quoting author is elsewhere. Only the quote collapses (“Quoted post hidden by Better X”), the post and its action row stay, **Show quoted post** reveals it. Then the reverse (quoting author in the country, quote elsewhere): the post collapses, the quote is not blamed.
- [ ] **Modes.** Switch Collapse / Hide / Highlight: the open tab follows without a reload. **Apply to** Posts / Quoted posts each work on their own.
- [ ] **Always Show.** Add an account that is in the selected country: its posts are not touched, in both posts and quotes. Your own posts on your profile are never collapsed. Opening a collapsed post's own page shows that post.
- [ ] **Turning filtering off** (the switch, or **Clear all**) restores every post and quote at once, including ones you scrolled past.
- [ ] **Saving filtered posts.** Save a post that has a collapsed quote: in the Library the quoted post's author and text are there. Save and Download still work on revealed posts.
- [ ] **Clear account cache** (Account insights panel) empties the cache; badges reappear as the posts on screen are looked up again.
- [ ] **Hide X Money / Hide Articles.** Navigation → each hides only its own menu entry, in the wide side nav, the narrow layout's menu and the More menu. If an entry stays, note its link address (hover it) and its label so the lists in `src/features/nav-items.ts` can include it. Articles on profiles (the Articles tab) and article posts stay. Premium, Creator Studio and the other entries stay.
- [ ] **Settings backup.** Export customization settings, change the country list, import the file with Merge: the lists gain the file's entries; with Replace: they become the file's. An older (version 1) file still imports and leaves the filter alone.

### What cannot be known without live X

- The `AboutAccountQuery` id, and that X still answers it for this session without extra headers.
- Where `User-Name` puts the @handle in every layout (the badge goes after the handle link's cell).
- The exact `href`s and labels of the X Money and Articles menu entries.
- Posting client (“Twitter for iPhone”): not built; see docs/ARCHITECTURE.md.

## Themes

**Not verified on live x.com.** The automated checks (`scripts/smoke/theme.mjs`) prove the rules on an X-shaped page whose classes and inline colors come from `src/themes/surfaces.ts`, which is seeded from Dim Mode for Twitter / X and Control Panel for Twitter, not from X itself. Do these on a normal signed-in x.com tab after reloading the extension.

**Probe first.** On x.com in **Lights out**, open DevTools → Console, paste all of `scripts/theme/probe.js` and press Enter. It saves one JSON report to your Downloads folder (`better-x-probe-….json`, also on the clipboard) and changes nothing. Do not copy it out of the console: Chrome shortens long console lines. Run it once with no theme, once with a theme on (it then also lists what was missed), on Home, a post, a profile, Messages and an open modal. Send the files back: `surfaces.ts` changes only from them.

**Before the Themes tab exists**, choose a theme from the extension's service worker console (chrome://extensions → Better X → service worker → Console):

```js
const { 'bx.settings': s = {} } = await chrome.storage.local.get('bx.settings');
await chrome.storage.local.set({ 'bx.settings': { ...s, xTheme: { ...s.xTheme, active: 'dim' } } });
// Other ids: graphite midnight nord dracula mocha rosepine tokyo gruvbox solarized forest ember custom; null = off.
```

- [ ] **Lights out.** X Settings → Display → Background: Lights out. The page, columns, sticky header (still translucent), cards, menus, borders and dividers, handles and timestamps take the theme. No text is unreadable; nothing is hidden or moved.
- [ ] **Default.** Switch X to Default: the theme steps aside completely (no dark patches, no dark text on white). Back to Lights out: it returns, without a reload.
- [ ] **High contrast.** X Settings → Accessibility → Increase color contrast on and off, in Lights out.
- [ ] **Media untouched.** Photos, videos, GIFs, avatars, link-card images and Premium promo images look exactly as without a theme. Image crop selection and icon hover circles stay see-through.
- [ ] **Better X's own controls.** Save button, Saved chip, menus, account badges and the country filter's placeholders work and are readable.
- [ ] **Two tabs.** Two x.com tabs open: change the theme from the service worker: both follow at once.
- [ ] **First paint.** Reload x.com with a theme on: no flash of black before the theme (one frame at most).
- [ ] **Extension reload.** Reload Better X at chrome://extensions with an x.com tab open: the old theme does not stick; after a page reload the theme is back.
- [ ] **Chat (experimental, later).** With `xTheme.chat` on, Messages / the chat drawer take the theme.

## Panel overlay

Not verified on live X: `scripts/smoke/overlay.mjs` checks an X-shaped page served under X's frame policy, with real toolbar clicks. Setup: Settings → Open Better X as → **Side panel**, and Side panel on X → **Overlay** (the default; check that a fresh install starts there). Before you start, note where the timeline sits (for example the left edge of the first post against something on screen).

- [ ] **Opens and closes.** On x.com/home, click the toolbar icon: the panel slides in from the right, flush with the window's right edge, full height, with a thin left border and shadow. Click it again: it slides out. Do it twice more in a row. Close it once with the panel's **Close** button and once with **Esc** (click inside the panel first). Esc pressed on X itself (focus in X's search, or no focus) does nothing to the panel.
- [ ] **The timeline does not move.** With it open, closed, and while resizing, the timeline, the left nav and the right column stay exactly where they were: no jump, no reflow, no change of X's narrow/wide layout. Compare with Native mode, where the timeline shifts left.
- [ ] **Non-modal.** While it is open: like a post, open a post, scroll the timeline with the wheel over X, type in X's search, open X's menus and the composer. Everything works and nothing closes the panel. Scrolling over the panel scrolls only the panel.
- [ ] **Inside the panel.** Real mouse clicks work everywhere in it (Library, Customize, Themes, Settings, dialogs, the item menu); Esc inside a dialog closes only the dialog; the search box clears on Esc before the panel closes.
- [ ] **Resize.** Drag its left edge: it follows the pointer, stops at 320 and 560 px, and X does not move. Reload X: the width is kept. With the edge focused (Tab to it), the arrow keys resize it.
- [ ] **Narrow and ultrawide.** At about 800 px wide (X's narrow layout) and on a very wide window: it opens flush right at the stored width and X does not move. On a narrow window it covers part of the timeline (expected).
- [ ] **SPA navigation.** With it open, go Home → Explore → a profile → a post → back: it stays open the whole time, and the Library inside keeps working.
- [ ] **Remembered.** Leave it open and close the X tab; open x.com again: it is open. Open a second X tab: open there too. Close it in one tab: the other closes. Resize in one: the other follows.
- [ ] **Shortcut.** Alt+Shift+B toggles it on X and opens Chrome's side panel on other sites, like the icon (chrome://extensions/shortcuts shows it and can change it).
- [ ] **Other sites.** On another site the icon opens Chrome's side panel as before. With Chrome's panel open on that site, switch to an X tab: Chrome's panel is not shown there (so X is not narrowed) and comes back on the other tab.
- [ ] **Leaving X.** In an X tab, follow a link to another site in the same tab and click the icon: Chrome's side panel opens (if Better X was idle for a while, the first click may do nothing and the second opens it; note which).
- [ ] **Edge tab.** Turn on "Show a tab on X's right edge": a small blue tab at mid-height on X's right edge, hidden while the panel is open; clicking it opens the panel. It covers nothing of X's you need.
- [ ] **Save menu.** On a saved post's menu, **Open bookmark library** opens the overlay (not Chrome's panel).
- [ ] **Theme.** Library theme Light, Dark and Auto (switch the OS theme): the panel and its border match; X's own theme and Better X's X themes are unaffected.
- [ ] **Reduced motion.** With the OS's reduce-motion setting on, it appears and disappears without sliding.
- [ ] **Extension reload.** Open the overlay, reload Better X at chrome://extensions: the overlay goes away from the open X tab (nothing stuck on screen). Reload the X tab: it is back, open. Clicking the icon in the stale tab before reloading it opens Chrome's panel or does nothing; it never errors.
- [ ] **Back to Native.** Switch Side panel on X back to Native with an X tab open: the overlay disappears, and the icon on that X tab opens Chrome's side panel again.
- [ ] **X's CSP.** DevTools console on x.com shows no Content Security Policy error for `chrome-extension://…/sidepanel.html`.

## Named themes (1.2.0)

Not verified on live X: `src/sidepanel/themes.test.tsx` and `src/themes/file.test.ts` check the panel and the files; `scripts/smoke/theme.mjs` checks painting on an X-shaped page. Set X to **Lights out** (Settings → Display) first.

- [ ] **New theme.** Themes → **New theme**: a card "My theme" appears, is selected, and the editor opens with a Name box. X keeps the colors it had (a new theme starts from the theme that was on).
- [ ] **Live edit.** Change Background, Accent and (under Advanced) Raised, Border, Secondary text with the picker and by typing a hex code: X changes as you go, in every open X tab, with no reload.
- [ ] **Accent everywhere.** With X's own color on **Blue** (X Settings → Display), pick an unusual accent (e.g. `#ff5fa2`). It should show on: links, @mentions and #hashtags in posts, "Show more", the selected Home tab's underline, the "Show N posts" pill, switches and checkboxes in X's settings, a focused search box's border, the blue circle behind reply/share on hover, a primary button's hover and pressed shades, and the keyboard focus ring (Tab through the page). Likes (pink), reposts (green), error red, the verified badge, photos and videos keep their own colors. Note anything still blue: that is a class or inline color the table does not know yet (`src/themes/surfaces.ts`).
- [ ] **Light accent warning.** Pick a pale yellow accent: the editor warns that white button labels will be hard to read; nothing is blocked.
- [ ] **Contrast warning.** Set Text close to Background: a warning appears, nothing is blocked.
- [ ] **Rename, duplicate, delete.** Rename it (Enter or click away), **Duplicate** (a "… copy" is selected), **Delete** asks "Really delete?" first; after deleting, X goes back to its own colors.
- [ ] **Persistence and navigation.** Reload X and restart the browser: the chosen theme is still on. Navigate Home → Explore → a profile → a post → back, open the composer and a photo: the theme stays on everything X loads.
- [ ] **Export / import.** **Export** saves `better-x-theme-<name>.json`; **Import theme** of that file adds it as a new card. Importing a settings backup or a random JSON file is refused with a message.
- [ ] **Light mode.** Switch X to Default: the theme steps aside and the Themes tab says it is paused; switch back to Lights out and it returns.
- [ ] **Backups.** Settings → export a settings backup, import it in another browser profile: the named themes come along.

## Drag to navigate photos (1.2.0)

Not verified on live X: `scripts/smoke/drag.mjs` drives a real mouse on an X-shaped photo viewer. If nothing moves on live X, the viewer's arrow buttons or slide markup differ from what `src/features/drag-photos.ts` expects (constants at the top). Turn on Customize → Posts → **Drag to navigate photos**.

- [ ] **Both directions.** Open a post with 3–4 photos, click one to open the viewer. Hold the mouse on the photo and drag left: the photo follows the pointer; release past a short distance: the next photo. Drag right: the previous one.
- [ ] **Boundaries.** On the first photo a drag right only stretches a little and snaps back; same for a drag left on the last.
- [ ] **Clicks still work.** A plain click on the photo does what it did before (whatever X does on click). A short drag (under ~5 % of the width) snaps back without changing photo or clicking.
- [ ] **No ghost, no selection.** No translucent image copy follows the pointer; no text gets selected while dragging.
- [ ] **Arrows and keys.** X's own arrow buttons and the ← → keys still work, and Esc still closes the viewer.
- [ ] **Release outside.** Drag and release over the post on the right, or outside the window: the drag ends, nothing sticks. Alt+Tab mid-drag: it snaps back.
- [ ] **Leave alone.** A video in the viewer is not dragged; the post text beside it still selects; scrolling the reply column still works; vertical mouse movement on the photo is not taken over.
- [ ] **New posts.** Close the viewer, open another post's photos, then another: dragging works each time and changes exactly one photo per drag (no doubled handlers).
- [ ] **Reduced motion.** With the OS reduce-motion setting on, the photo changes without the settle animation.
- [ ] **Off.** Turn the setting off with the viewer open: dragging does nothing new, the browser's image drag is back, everything else is as before.

## 1.3.0 changes

Not verified on live X or real Spotify. Real-Chrome fixture checks: `scripts/smoke/drag-timeline.mjs`, `scripts/smoke/theme.mjs`, `scripts/smoke/catalog.mjs`.

- [ ] **Who to follow.** Customize → Sidebar → **Hide “Who to follow”** on Home: the card is gone completely, no empty bordered box. On a post's own page "Relevant people" still shows. Search, Today's News and trends stay.
- [ ] **Timeline drag.** Customize → Posts: **Also drag photos in the timeline** is greyed out until **Drag to navigate photos** is on. With both on, on a post with 2–4 photos in the timeline: drag the photos left/right; they follow the mouse and glide to the next/previous photo; a short drag snaps back; a plain click still opens the viewer; no ghost image; vertical page scrolling is unaffected; a single-photo post is unaffected. If nothing moves, inspect the photo row: `findCarousel` expects an ancestor of `[data-testid="tweetPhoto"]` inside the post that scrolls sideways.
- [ ] **Mention and badge colors.** Themes → Custom (or your own theme) → **Mentions and notifications**: set Mentions and links, Notification badge and Badge number; check @mentions and #hashtags in posts and a bio, and the unread count on Notifications/Messages in the left menu. **Follow the accent** puts each back. Other links (for example "Show more") keep the accent.
- [ ] **Match Better X.** Themes → **Match Better X to my X theme**: the panel, popup and overlay take the theme's colors; switching theme updates them; off restores Better X's own look.
- [ ] **Spotify player clicks.** Press play/pause, next, the progress bar and empty parts of the player: X's account switcher never opens. Click the cover: it opens large (sharp, not the small thumbnail) with title, artists, progress and working controls; Esc, the × and a click outside close it.
- [ ] **Spotify connect.** In the overlay on X and in the side panel, **Connect Spotify** opens Spotify's sign-in (a window, or a normal tab as fallback). After approving, the tab closes and the panel says Connected. If it fails, the message now includes Chrome's reason.

## Plugins and SpotifyControls (1.2.0)

Not verified against real Spotify or live X: `scripts/smoke/plugins.mjs` scripts Spotify's API. You need a Spotify app (README → Plugins).

- [ ] **Plugins tab.** A card for SpotifyControls with description, gear and switch. The switch is off on a fresh install and nothing is added to X.
- [ ] **Setup states.** Switch it on: the settings open, and X shows a player above your account button saying setup is needed, with **Set up** (which opens the Plugins tab). Paste a bad Client ID: an inline error. Paste the real one: X says "Not connected".
- [ ] **Connect.** Add the Redirect URI shown to your Spotify app, press **Connect Spotify**, approve: the panel says "Connected as <you> (Premium/Free)". Close the Spotify window instead: a clear message, nothing stuck.
- [ ] **Placement.** The player sits directly above the account button in X's left menu, the width of the menu, and stays there across navigation and window resizes. In X's collapsed icon-only menu only the cover and play/pause remain.
- [ ] **Now playing.** With music playing on any device: cover, title (links to open.spotify.com), artists, album, a moving progress bar with times. Pause on your phone: within ~10 s the player shows paused. Skip on your phone: the new track shows.
- [ ] **Controls (Premium).** Play/pause, next, previous, shuffle (highlights), repeat (all → one → off), click the bar and use ← → on it to seek. Each acts on the playing device.
- [ ] **No Premium.** On a Free account: the track shows, no buttons, and a line says controls need Premium.
- [ ] **Nothing playing.** Stop all Spotify apps: "Nothing is playing", no fake song, no buttons. Pressing play with no active device is never offered; if a device goes away mid-use, the message says so.
- [ ] **Theme.** The card follows the Better X theme (and X's Default/Lights out when no theme is on).
- [ ] **Off.** Switch the plugin off: the player disappears from every X tab at once; DevTools → Network shows no more Spotify requests.
- [ ] **Disconnect.** Disconnect in the settings: X says "Not connected" at once. Removing access at spotify.com/account/apps does the same within a poll.
- [ ] **Privacy.** DevTools on x.com: no `Authorization` header or token in the page; Spotify requests come only from the extension's service worker.
