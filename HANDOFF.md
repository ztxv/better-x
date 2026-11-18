# Handoff: Better X 1.3.0 (themes, photo dragging, plugins + Spotify)

Branch `claude/trusting-shannon-r2gdbq`. The 1.2.0 work below is committed and pushed. The 1.3.0 session (next section) is committed locally for the owner to check before pushing. Delete this file when the work is merged.

## 1.3.0 session (owner feedback after trying 1.2.0)

| Asked                                                                    | Done                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Hide “Who to follow” left an empty bordered box                          | Card climb skips empty siblings; plus a section-level CSS rule like Today's News (`src/features/sidebar-cards.ts`, `sidebar.ts`) |
| Spotify: “sign-in page could not be loaded” with a valid Client ID       | Sign-in runs in the worker (`spotifyConnect`), tab fallback, Chrome's reason shown (`src/spotify/auth.ts`)                       |
| Theme colors for mentions, notification badge and its number             | `SeedExtras` + three surfaces + editor section “Mentions and notifications”                                                      |
| Setting to match Better X to the chosen X theme                          | `xTheme.matchPanel`, `src/themes/panel.ts`, switch at the top of Themes; works for presets, Custom and saved themes              |
| Drag photos in the timeline, as a toggle under “Drag to navigate photos” | `posts.dragTimelinePhotos` with the new `requires` feature field (indented sub-toggle)                                           |
| Plugins tab                                                              | Already a tab next to Customize and Themes; no change                                                                            |

Checks on Windows: `tsc` clean; `npm test` 804 passed; build OK; real Chrome smokes `drag-timeline` 16/16 (new), `theme` 22/22 (2 new), `drag` 22/22, `plugins` 17/17, `catalog` 116/116. Not verified: live X markup for the timeline carousel and the unread badge, and real Spotify sign-in. See "1.3.0 changes" in `docs/MANUAL-CHECKLIST.md` and the 1.3.0 entries in `docs/ARCHITECTURE.md`. Vitest on Windows needs an upper-case drive letter (`DEVELOPMENT.md`).

## What was asked

Three features on the existing extension: (1) fully customizable X themes, (2) "Drag to navigate photos", (3) a Vencord-style plugin system with a Spotify player above X's account switcher.

## State: all three are implemented and pass every check that can run without a real X / Spotify account

| Check                                                            | Result                                    |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `npm run check`                                                  | clean                                     |
| `npm test`                                                       | 783 passed (was 736)                      |
| `npm run build`                                                  | builds                                    |
| `scripts/smoke/drag.mjs` (real Chrome, new)                      | 22/22                                     |
| `scripts/smoke/plugins.mjs` (real Chrome, Spotify scripted, new) | 17/17                                     |
| existing smokes `theme`, `catalog`, `overlay`, `insights`        | 20/20, 116/116, 35/35, 55/55              |
| `scripts/smoke/run.mjs` and the others in `npm run smoke`        | not run (need X's CDNs / were not needed) |

In a root container the older smoke scripts need `--no-sandbox` added to their launch args; the two new ones already pass it. Use `CHROME_PATH=/opt/pw-browsers/chromium`.

## Where things are

- Themes: `src/lib/settings.ts` (v8, `xTheme.saved`), `src/themes/file.ts` (theme JSON files), `src/themes/derive.ts` (`resolveTheme`), `src/sidepanel/Themes.tsx`, `ThemeEditor.tsx`, backups in `src/lib/settings-backup.ts`.
- Drag: `src/features/drag-photos.ts` (feature id `posts.dragPhotos`), registered in `src/features/index.ts`.
- Plugins: `src/plugins/` (`catalog.ts`, `state.ts`, `host.ts`, `content.ts`, `spotify/`), panel UI `src/sidepanel/Plugins.tsx` and `SpotifySettings.tsx`.
- Spotify: `src/spotify/` (`auth.ts` PKCE, `api.ts` parsing, `service.ts` worker client, `types.ts`), messages `spotifyState` / `spotifyCommand` in `entrypoints/background.ts`, manifest in `wxt.config.ts`.
- Decisions and reasons: the three 1.2.0 entries at the end of "Structure" in `docs/ARCHITECTURE.md`.

## Follow-up session (Opus 5.5)

- **Accent now reaches X.** The palette defined `--bx-t-accent` but no rule used it, so the accent only changed the preview. Added accent surfaces (computed RNW classes for X's blue, verified by re-deriving known live classes; inline styles; focus ring) with derived hover/pressed/ring/tint, a white-label contrast warning, and real-Chrome checks (theme smoke 20/20). See "The accent reaches X" in `docs/ARCHITECTURE.md`.
- **Spotify race fixed.** A refresh during an in-flight poll was dropped (connect/disconnect showed the old state for up to 20 s) and the worker's reset kept the stale in-flight read. Requests are now sequenced; smoke covers it (17/17; the old code fails the new checks).
- Smoke/perf scripts pass `--no-sandbox` only when run as root. In this container: catalog 116, insights 55, overlay 35, reload 4, theme 20, drag 22, plugins 17 all pass; `run`/`restart` fail only on real media downloads (no network to X's CDNs); `launch` crashes on a headless popup step identically on the pre-branch code.
- Manual live-X checklist for all three features: `docs/MANUAL-CHECKLIST.md`.

## Not verified (needs the owner's browser)

1. **Live X selectors.** The photo viewer's arrows (`[data-testid="Carousel-NavLeft/Right"]`, fallback `aria-label` "Previous/Next slide"), its slide markup (`ul[role="list"]`, `[data-testid="swipe-to-dismiss"]`), and the account switcher (`[data-testid="SideNav_AccountSwitcher_Button"]`) come from knowledge of X's markup, tested on fixtures only. If dragging or the player does nothing on live X, inspect those elements and adjust the constants at the top of `drag-photos.ts` / `plugins/spotify/index.ts`.
2. **Real Spotify.** The OAuth round trip (`launchWebAuthFlow`), token exchange and real API responses have not run against Spotify. Likely first things to check if it fails: the Redirect URI matches exactly; the account is on the app's User Management list; whether `/v1/me` still returns `product` for development-mode apps (if not, Premium is detected on the first refused command instead, which is handled).
3. **Player spacing in X's real menu**, wide and collapsed (the collapsed layout uses a container query at 170 px).

## Reasonable next steps (none are blockers)

- Run the manual pass above on live X and fix selectors if needed.
- Plugin state (`bx.plugins`) is not in settings backups; add it if wanted (never the tokens).
- Themes only apply in X's dark mode (existing design: all surface rules are written against Lights out). Light-mode theming would need a second surface table.
- Optional: volume control, a "transfer playback here" action, drag in the timeline if X ever ships inline carousels on desktop.
- `docs/MANUAL-CHECKLIST.md` has no entries for the three features yet.
