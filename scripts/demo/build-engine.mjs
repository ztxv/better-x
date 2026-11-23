/**
 * Bundles the extension's pure logic into `demo-site/engine/better-x-engine.js`, a plain script
 * the static demo site loads (it has no build step). Run after changing anything under `src/`
 * that the demo uses:
 *
 *   npm run demo:engine
 *
 * `bundleEngine()` is also what `src/demo-engine.test.ts` calls to check the committed copy.
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ENGINE_OUT = resolve(root, 'demo-site/engine/better-x-engine.js');

const BANNER = `/*
 * Better X demo engine. GENERATED FILE: do not edit by hand.
 * Built from scripts/demo/engine.ts (the extension's own src/ modules) by
 * scripts/demo/build-engine.mjs. Re-run \`npm run demo:engine\` after changing src/.
 * Better X is MIT licensed; see LICENSE and THIRD_PARTY_NOTICES.md in the repository.
 */`;

export async function bundleEngine() {
  const result = await build({
    entryPoints: [resolve(root, 'scripts/demo/engine.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'BetterXEngine',
    platform: 'browser',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    banner: { js: BANNER },
    define: { __BUILD_DATE__: '"demo"' },
    logLevel: 'silent',
  });
  // Line endings are normalized so the drift check means the same thing on every OS.
  return result.outputFiles[0].text.replace(/\r\n/g, '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = await bundleEngine();
  writeFileSync(ENGINE_OUT, code);
  console.log(`Wrote ${ENGINE_OUT} (${(code.length / 1024).toFixed(1)} KB)`);
}
