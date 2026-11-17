# Handoff: Better X 1.2.0 (themes, photo dragging, plugins + Spotify)

Branch `claude/trusting-shannon-r2gdbq`. Everything below is committed and pushed. Delete this file when the work is merged.

## What was asked

Three features on the existing extension: (1) fully customizable X themes, (2) "Drag to navigate photos", (3) a Vencord-style plugin system with a Spotify player above X's account switcher.

## State: all three are implemented and pass every check that can run without a real X / Spotify account

| Check                                                            | Result                                    |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `npm run check`                                                  | clean                                     |
| `npm test`                                                       | 778 passed (was 736)                      |
| `npm run build`                                                  | builds                                    |
| `scripts/smoke/drag.mjs` (real Chrome, new)                      | 22/22                                     |
| `scripts/smoke/plugins.mjs` (real Chrome, Spotify scripted, new) | 16/16                                     |
| existing smokes `theme`, `catalog`, `overlay`, `insights`        | 17/17, 116/116, 35/35, 55/55              |
| `scripts/smoke/run.mjs` and the others in `npm run smoke`        | not run (need X's CDNs / were not needed) |

In a root container the older smoke scripts need `--no-sandbox` added to their launch args; the two new ones already pass it. Use `CHROME_PATH=/opt/pw-browsers/chromium`.

## Where things are

- Themes: `src/lib/settings.ts` (v8, `xTheme.saved`), `src/themes/file.ts` (theme JSON files), `src/themes/derive.ts` (`resolveTheme`), `src/sidepanel/Themes.tsx`, `ThemeEditor.tsx`, backups in `src/lib/settings-backup.ts`.
- Drag: `src/features/drag-photos.ts` (feature id `posts.dragPhotos`), registered in `src/features/index.ts`.
- Plugins: `src/plugins/` (`catalog.ts`, `state.ts`, `host.ts`, `content.ts`, `spotify/`), panel UI `src/sidepanel/Plugins.tsx` and `SpotifySettings.tsx`.
- Spotify: `src/spotify/` (`auth.ts` PKCE, `api.ts` parsing, `service.ts` worker client, `types.ts`), messages `spotifyState` / `spotifyCommand` in `entrypoints/background.ts`, manifest in `wxt.config.ts`.
- Decisions and reasons: the three 1.2.0 entries at the end of "Structure" in `docs/ARCHITECTURE.md`.

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
