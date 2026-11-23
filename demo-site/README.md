# Better X demo site

A static page that shows what Better X does. Live at
**[better-x-theta.vercel.app](https://better-x-theta.vercel.app/)**. It has no build step and no dependencies. It runs
the extension's real feature catalog, quick setups, theme engine and post extractor against a
**simulated**, X-shaped timeline (`mock/timeline.html`) next to a working replica of the panel.

## Deploy to Vercel

**Drag and drop:** go to [vercel.com/drop](https://vercel.com/drop) and drop this whole
`demo-site` folder. `index.html` is at the top level and nothing needs building.

**From Git:** import the repository in Vercel, set **Root Directory** to `demo-site`, keep
**Framework Preset** on **Other**, and leave the build command empty. Every push then redeploys it.

## Run it locally

Any static server works. From the repository root:

```sh
npm run demo:serve
```

Opening `index.html` straight from disk won't work, because the page talks to the simulated
timeline in an iframe, and browsers isolate `file://` pages from each other.

## Keep it in sync

`engine/better-x-engine.js` is **generated** from the extension's TypeScript source by
`scripts/demo/build-engine.mjs` (entry point: `scripts/demo/engine.ts`). After you change
anything under `src/` that the demo uses, rebuild it:

```sh
npm run demo:engine
```

`npm test` includes `src/demo-engine.test.ts`, which rebuilds the bundle in memory and fails if
the committed copy is out of date. It also fails if any file here references something outside
`demo-site/`.

## What's real and what's simulated

| Real (from the extension's source)                                        | Simulated                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Every setting's title, description, group and CSS (`src/features/`)       | The timeline, its accounts, posts, ads and trends (all made up) |
| How settings combine into one stylesheet (same logic as `features/host.ts`) | Hide For You and the Twitter tab title (two small shims)        |
| Quick setups and Undo (`presetPatch`)                                     | The library: saved posts live in the page, not IndexedDB        |
| Theme tokens and contrast warnings (`deriveTokens`, `contrastWarnings`)    | Theme colors mapped onto the mock page's own CSS variables      |
| Post extraction when you click Save (`extractPost`)                       | Downloads, account insights, filtering and plugins (not shown)  |

Settings that only do something through live x.com behavior (account insights, country
filtering, photo dragging, the tab icon) are listed with an "x.com only" tag and can't be turned on.
