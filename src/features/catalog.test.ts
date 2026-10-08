import { describe, expect, it } from 'vitest';
import { FEATURES, featureRegistry } from './index';
import { CATEGORY_TITLES, type FeatureDef } from './types';

/** The css a feature produces at the default number (sliders) or as written (toggles). */
const cssOf = (def: FeatureDef) => (def.kind === 'slider' ? def.css(def.defaultValue) : def.css);

/** Splits a selector list on its top-level commas, so `:is(a, b)` stays whole. */
function selectorsOf(css: string, declaration?: RegExp): string[] {
  const out: string[] = [];
  for (const block of css.split('}')) {
    const head = block
      .split('{')[0]
      ?.replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    if (!head) continue;
    if (declaration && !declaration.test(block.split('{')[1] ?? '')) continue;
    let depth = 0;
    let current = '';
    for (const char of head) {
      if (char === '(' || char === '[') depth++;
      if (char === ')' || char === ']') depth--;
      if (char === ',' && depth === 0) {
        out.push(current.trim());
        current = '';
      } else current += char;
    }
    out.push(current.trim());
  }
  return out;
}

describe('feature catalog', () => {
  it('registers cleanly: unique well-formed ids, each in its own category', () => {
    expect(() => featureRegistry.list()).not.toThrow();
    expect(new Set(FEATURES.map((def) => def.id)).size).toBe(FEATURES.length);
    for (const def of FEATURES) {
      expect(def.id.startsWith(`${def.category}.`)).toBe(true);
      expect(Object.keys(CATEGORY_TITLES)).toContain(def.category);
    }
  });

  it('keeps the ids that shipped earlier, because stored settings refer to them', () => {
    const ids = FEATURES.map((def) => def.id);
    for (const shipped of ['cleanup.hideAds', 'cleanup.hideGrok', 'feed.hideForYou'])
      expect(ids).toContain(shipped);
  });

  it('gives every feature a title and a description a person can read', () => {
    for (const def of FEATURES) {
      expect(def.title.length, def.id).toBeGreaterThan(3);
      expect(def.description.length, def.id).toBeGreaterThan(15);
      expect(def.description.endsWith('.'), def.id).toBe(true);
    }
    expect(new Set(FEATURES.map((def) => def.title)).size).toBe(FEATURES.length);
  });

  it('starts every feature switched off: customization is opt-in', () => {
    for (const def of FEATURES) expect(def.defaultEnabled, def.id).toBe(false);
  });

  it('makes every feature do something: css, activation, or both', () => {
    for (const def of FEATURES) {
      const hasCss = Boolean(cssOf(def));
      expect(hasCss || Boolean(def.activate), def.id).toBe(true);
    }
  });

  it('writes css with balanced braces and no leftover template text', () => {
    for (const def of FEATURES) {
      const css = cssOf(def) ?? '';
      expect((css.match(/{/g) ?? []).length, def.id).toBe((css.match(/}/g) ?? []).length);
      expect(css, def.id).not.toMatch(/undefined|NaN|\[object|\$\{/);
    }
  });

  it('never leans on X’s generated class names, which change with every deploy', () => {
    for (const def of FEATURES)
      for (const selector of selectorsOf(cssOf(def) ?? ''))
        expect(selector, `${def.id}: ${selector}`).not.toMatch(/\.(?:r|css|j)-[a-z0-9]{4,}/);
  });

  it('only hides by something specific, so a selector miss hides nothing', () => {
    // Every selector that hides needs an attribute (a test ID, an href, a role ...) or an id; a
    // bare tag or a bare structural selector could hide ordinary content if X's markup shifted.
    for (const def of FEATURES)
      for (const selector of selectorsOf(cssOf(def) ?? '', /display:\s*none|visibility:\s*hidden/))
        expect(selector, `${def.id}: ${selector}`).toMatch(/\[|#/);
  });

  it('never targets Better X’s own controls', () => {
    for (const def of FEATURES) {
      const css = cssOf(def) ?? '';
      expect(css, def.id).not.toMatch(/\.bx-|bx-features|data-bx-saved/);
    }
  });

  it('builds the same css for the same number, and different css for a different one', () => {
    for (const def of FEATURES) {
      if (def.kind !== 'slider') continue;
      expect(def.css(def.defaultValue), def.id).toBe(def.css(def.defaultValue));
      expect(def.css(def.min), def.id).not.toBe(def.css(def.max));
      for (const value of [def.min, def.defaultValue, def.max]) {
        const css = def.css(value);
        expect(css, def.id).toContain(`${value}px`);
      }
    }
  });

  it('has sliders only where a number means something', () => {
    const sliders = FEATURES.filter((def) => def.kind === 'slider').map((def) => def.id);
    expect(sliders.sort()).toEqual([
      'appearance.navSpacing',
      'appearance.navTextSize',
      'appearance.postTextSize',
      'appearance.sidebarWidth',
      'appearance.timelineWidth',
    ]);
  });
});

describe('real-Chrome scenarios cover the catalog', () => {
  it('has a scenario for every feature (but the two with their own checks), and no stranger', async () => {
    // @ts-expect-error the smoke spec is a plain module with no types
    const { SCENARIOS, COVERED_ELSEWHERE } = await import('../../scripts/smoke/catalog-spec.mjs');
    const named = new Set<string>(
      SCENARIOS.map((scenario: { feature: string }) => scenario.feature),
    );
    for (const def of FEATURES)
      expect(named.has(def.id) || COVERED_ELSEWHERE.has(def.id), def.id).toBe(true);
    for (const id of named) expect(featureRegistry.get(id), id).toBeDefined();
  });

  it('describes each slider with the same limits the feature has', async () => {
    // @ts-expect-error the smoke spec is a plain module with no types
    const { SCENARIOS } = await import('../../scripts/smoke/catalog-spec.mjs');
    for (const scenario of SCENARIOS as Array<{
      feature: string;
      slider?: { min: number; max: number; def: number };
    }>) {
      if (!scenario.slider) continue;
      const def = featureRegistry.get(scenario.feature)!;
      expect(def.kind, scenario.feature).toBe('slider');
      if (def.kind !== 'slider') continue;
      expect([scenario.slider.min, scenario.slider.max, scenario.slider.def]).toEqual([
        def.min,
        def.max,
        def.defaultValue,
      ]);
    }
  });

  it('gives every hiding scenario at least one thing it must leave alone', async () => {
    // @ts-expect-error the smoke spec is a plain module with no types
    const { SCENARIOS } = await import('../../scripts/smoke/catalog-spec.mjs');
    for (const scenario of SCENARIOS as Array<{
      feature: string;
      name: string;
      hides?: string[];
      keeps?: string[];
      slider?: unknown;
      style?: unknown;
    }>) {
      if (scenario.slider || scenario.style) continue;
      expect(scenario.keeps?.length, `${scenario.feature} — ${scenario.name}`).toBeGreaterThan(0);
    }
  });
});
