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
- [ ] **Settings backup.** Settings → Data & backup → Export customization settings, change a few switches, then Import that file: the preview counts make sense, Merge and Replace behave as described, and open X tabs update. A Library backup file is refused here, and the Library buttons still work.
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
