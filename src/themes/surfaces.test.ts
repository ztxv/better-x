import { describe, expect, it } from 'vitest';
import { buildThemeCss, themeRules, themeVars } from './css';
import { deriveTokens } from './derive';
import { LIGHTS_OUT_SEED, PRESETS } from './presets';
import { SURFACES, type Surface } from './surfaces';

const HASHED = /\.(?:r|css|j)-[a-z0-9]{4,}/;
const ALLOWED = new Set([
  'background-color',
  'border-color',
  'border-top-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'color',
  'fill',
  'stroke',
  'caret-color',
  'scrollbar-color',
  'box-shadow',
  'outline-color',
]);
const FORBIDDEN =
  /\b(display|visibility|opacity|transform|content|position|width|height|filter|margin|padding)\b|url\(|@import|expression\(/i;
const TEXT_ROLES = new Set(['text', 'muted', 'accent', 'text-hsl', 'muted-hsl']);
const SURFACE_ROLES = new Set(['bg', 'raised', 'hover', 'backdrop', 'border', 'scrim']);
const ALL = buildThemeCss(deriveTokens(LIGHTS_OUT_SEED), { chat: true });

describe('X surfaces (quarantined selector table)', () => {
  it('allows X-generated classes only in rnw-class and jetfuel entries, each with a note and source', () => {
    for (const surface of SURFACES) {
      expect(surface.note.length, surface.selectors[0]).toBeGreaterThan(0);
      expect(surface.from.length, surface.selectors[0]).toBeGreaterThan(0);
      for (const selector of surface.selectors)
        if (HASHED.test(selector)) expect(['rnw-class', 'jetfuel']).toContain(surface.kind);
    }
  });

  it('keeps inferred selectors to stable and inline-value entries', () => {
    for (const surface of SURFACES.filter((s) => s.from.includes('inferred')))
      expect(['stable', 'inline-value']).toContain(surface.kind);
  });

  it('changes colors only', () => {
    for (const surface of SURFACES)
      for (const property of surface.properties)
        expect(ALLOWED.has(property) || property.startsWith('--'), property).toBe(true);
    const declarations = ALL.match(/\{[^}]*\}/g)!.join('\n');
    expect(declarations).not.toMatch(FORBIDDEN);
  });

  it('never targets Better X’s own UI, media, or the verified badge', () => {
    for (const surface of SURFACES)
      for (const selector of surface.selectors) {
        expect(selector).not.toMatch(/\.bx-|data-bx-slot|#bx-|bx-features/);
        expect(selector).not.toMatch(/(^|[\s>+~,(])(img|video|canvas|picture)\b(?!\))/);
        expect(selector).not.toMatch(/icon-verified/);
      }
  });

  it('paints text roles on color properties and surface roles on backgrounds and borders only', () => {
    for (const surface of SURFACES) {
      if (surface.role === 'keep') {
        expect(surface.value).toBeDefined();
        continue;
      }
      for (const property of surface.properties) {
        if (property === 'color' || property === 'caret-color')
          expect(TEXT_ROLES.has(surface.role), `${property} ← ${surface.role}`).toBe(true);
        if (property.startsWith('background') || property.startsWith('border'))
          expect(SURFACE_ROLES.has(surface.role), `${property} ← ${surface.role}`).toBe(true);
      }
    }
  });

  it('puts the keep entries last', () => {
    const firstKeep = SURFACES.findIndex((s) => s.role === 'keep');
    expect(SURFACES.slice(firstKeep).every((s) => s.role === 'keep')).toBe(true);
  });

  it('with any one X-class entry gone, still never paints text in the background color', () => {
    const rnw = SURFACES.filter((s) => s.kind === 'rnw-class');
    for (const removed of rnw) {
      const rules = themeRules(
        { chat: true },
        SURFACES.filter((s: Surface) => s !== removed),
      );
      expect(rules).not.toMatch(/(^|[\s;{])color: var\(--bx-t-(bg|raised|hover|border)\)/);
    }
    for (const preset of PRESETS) {
      const tokens = deriveTokens(preset.seed);
      expect(tokens.text).not.toBe(tokens.bg);
      expect(tokens.muted).not.toBe(tokens.bg);
    }
  });
});

describe('buildThemeCss', () => {
  it('is balanced, deterministic and free of junk', () => {
    for (const preset of PRESETS) {
      const css = buildThemeCss(deriveTokens(preset.seed), { chat: true });
      expect(css).toBe(buildThemeCss(deriveTokens(preset.seed), { chat: true }));
      expect(css.split('{').length).toBe(css.split('}').length);
      expect(css).not.toMatch(/undefined|NaN|\[object|\$\{/);
    }
  });

  it('prefixes every selector with html[data-bx-theme]', () => {
    const selectors = ALL.split(/\{[^}]*\}/)
      // Selectors are joined with ",\n"; a bare comma can sit inside `rgba(0, 0, 0, 1)`.
      .flatMap((block) => block.split(',\n'))
      .map((s) => s.trim())
      .filter(Boolean);
    expect(selectors.length).toBeGreaterThan(20);
    for (const selector of selectors) expect(selector.startsWith('html[data-bx-theme]')).toBe(true);
  });

  it('writes only #rrggbb, rgba() and HSL components as color values', () => {
    const values = [...ALL.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]!.trim());
    for (const value of values)
      expect(value).toMatch(
        /^(#[0-9a-f]{6}|rgba\([\d., ]+\)|[\d.]+ [\d.]+% [\d.]+%|transparent|(var\(--bx-t-[a-z-]+\) ?)+)( !important)?$/,
      );
  });

  it('stays well under the rule budget', () => {
    const rules = themeRules({ chat: true })
      .split('\n')
      .filter((line) => line.includes('{'));
    expect(rules.length).toBeLessThanOrEqual(150);
  });

  it('builds Chat rules only when asked', () => {
    expect(themeRules({ chat: false })).not.toMatch(/--background|chat-drawer/);
    expect(themeRules({ chat: true })).toMatch(/--background|chat-drawer/);
  });

  it('cannot be made to emit anything but colors, whatever the tokens say', () => {
    const tokens = deriveTokens(LIGHTS_OUT_SEED);
    const evil = {
      ...tokens,
      bg: 'red;}body{display:none',
      text: '</style><script>',
      accent: 'url(https://evil)',
      muted: '#1234567',
      backdrop: 'rgba(0,0,0,1);}*{display:none',
    };
    const css = themeVars(evil);
    expect(css).not.toMatch(/display|script|url|evil|#1234567/);
    expect(css).toBe(themeVars(tokens));
  });

  it('matches the snapshot for every preset', () => {
    const vars = Object.fromEntries(
      PRESETS.map((preset) => [preset.id, themeVars(deriveTokens(preset.seed))]),
    );
    expect({ vars, rules: themeRules({ chat: false }) }).toMatchSnapshot();
  });
});
