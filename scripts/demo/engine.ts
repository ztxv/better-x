/**
 * Entry point for the demo site's engine bundle (`demo-site/engine/better-x-engine.js`).
 *
 * The demo is a static page with no build step, so it cannot import the extension's TypeScript.
 * `scripts/demo/build-engine.mjs` bundles this file, and with it the real modules below, into one
 * plain script that exposes `window.BetterXEngine`. Only pure logic is exported: nothing here
 * touches `chrome.*`, storage or the network when it is called.
 *
 * `src/demo-engine.test.ts` rebuilds the bundle in memory and fails if the committed copy differs,
 * so the demo always runs the code the extension ships.
 */
export { FEATURES, featureRegistry } from '../../src/features';
export { CATEGORY_HINTS, CATEGORY_SHORT, CATEGORY_TITLES } from '../../src/features/types';
export { PRESETS as QUICK_SETUPS, presetPatch } from '../../src/features/presets';
export { PRESETS as THEMES, LIGHTS_OUT_SEED } from '../../src/themes/presets';
export { contrastWarnings, deriveTokens } from '../../src/themes/derive';
export { themeVars } from '../../src/themes/css';
export { extractPost } from '../../src/x/selectors';
export { PRODUCT_NAME } from '../../src/lib/brand';
