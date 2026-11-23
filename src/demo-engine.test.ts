// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { bundleEngine, ENGINE_OUT } from '../scripts/demo/build-engine.mjs';
import { FEATURES } from './features';
import { PRESETS } from './themes/presets';

const DEMO = resolve(__dirname, '../demo-site');
const lf = (text: string) => text.replace(/\r\n/g, '\n');

describe('demo site engine', () => {
  it('matches the extension source (run `npm run demo:engine` if this fails)', async () => {
    const committed = lf(readFileSync(ENGINE_OUT, 'utf8'));
    expect(committed === (await bundleEngine())).toBe(true);
  }, 30_000);

  it('loads with no browser-extension APIs and exposes the real catalog', () => {
    const sandbox: Record<string, unknown> = {};
    runInNewContext(`${readFileSync(ENGINE_OUT, 'utf8')};this.E = BetterXEngine;`, sandbox);
    const engine = sandbox.E as {
      FEATURES: Array<{ id: string }>;
      THEMES: Array<{ id: string }>;
      QUICK_SETUPS: Array<{ id: string }>;
      deriveTokens: unknown;
      extractPost: unknown;
    };
    expect(engine.FEATURES.map((f) => f.id)).toEqual(FEATURES.map((f) => f.id));
    expect(engine.THEMES.map((t) => t.id)).toEqual(PRESETS.map((t) => t.id));
    expect(engine.QUICK_SETUPS.map((p) => p.id)).toEqual(['clean', 'minimal', 'focus']);
    expect(typeof engine.deriveTokens).toBe('function');
    expect(typeof engine.extractPost).toBe('function');
  });

  it('is self-contained: no file reaches outside demo-site/', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(html|css|js)$/.test(name) && name !== 'better-x-engine.js') files.push(path);
      }
    };
    walk(DEMO);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const depth = relative(DEMO, file).split(sep).length - 1;
      const ups = [...text.matchAll(/(?:src|href)="((?:\.\.\/)+)/g)].map((m) => m[1]!.length / 3);
      for (const up of ups)
        expect(up, `${file} reaches outside demo-site/`).toBeLessThanOrEqual(depth);
    }
  });
});
