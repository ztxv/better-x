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
const TEXT_ROLES = new Set(['text', 'muted', 'accent', 'accent-text', 'text-hsl', 'muted-hsl']);
const SURFACE_ROLES = new Set([
  'bg',
  'raised',
  'hover',
  'backdrop',
  'border',
  'scrim',
  'accent-fill',
  'accent-hover',
  'accent-active',
  'accent-tint',
]);
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
        // The badge may only be named to exclude it.
        expect(selector.replace(/:not\(\[data-testid="icon-verified"\]\)/g, '')).not.toMatch(
          /icon-verified/,
        );
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
    // Declarations only: selectors such as `[style*="; color: …"]` hold colons and semicolons too.
    const blocks = [...ALL.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]!).join('\n');
    const values = [...blocks.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]!.trim());
    for (const value of values)
      expect(value).toMatch(
        /^(#[0-9a-f]{6}|rgba\([\d., ]+\)|[\d.]+ [\d.]+% [\d.]+%|transparent|(var\(--bx-t-[a-z-]+\) ?)+|var\(--bx-t-ring\) 0px 0px 0px 2px)( !important)?$/,
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

/**
 * React Native Web's class name for one declaration: murmurhash2 (seed 1) in base 36 over the
 * camelCase property and the color as `rgba(r,g,b,a)` with two decimals. A copy of its algorithm,
 * used only to check the table.
 */
function rnwClass(property: string, rgba: [number, number, number, number]): string {
  const str = property + `rgba(${rgba.slice(0, 3).join(',')},${rgba[3].toFixed(2)})`;
  const mul = (x: number) =>
    (x & 0xffff) * 0x5bd1e995 + ((((x >>> 16) * 0x5bd1e995) & 0xffff) << 16);
  let length = str.length;
  let h = 1 ^ length;
  let i = 0;
  while (length >= 4) {
    let k =
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(i + 1) & 0xff) << 8) |
      ((str.charCodeAt(i + 2) & 0xff) << 16) |
      ((str.charCodeAt(i + 3) & 0xff) << 24);
    k = mul(k);
    k ^= k >>> 24;
    h = mul(h) ^ mul(k);
    length -= 4;
    i += 4;
  }
  if (length === 3) h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
  if (length >= 2) h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
  if (length >= 1) h = mul(h ^ (str.charCodeAt(i) & 0xff));
  h ^= h >>> 13;
  h = mul(h);
  h ^= h >>> 15;
  return `r-${(h >>> 0).toString(36)}`;
}

describe('accent classes (computed with React Native Web’s hash)', () => {
  it('the hash reproduces classes read from live X, so it can be trusted for the rest', () => {
    expect(rnwClass('backgroundColor', [0, 0, 0, 1])).toBe('r-kemksi');
    expect(rnwClass('backgroundColor', [0, 0, 0, 0.65])).toBe('r-5zmot');
    expect(rnwClass('color', [113, 118, 123, 1])).toBe('r-1bwzh9t');
    expect(rnwClass('borderColor', [47, 51, 54, 1])).toBe('r-1kqtdi0');
    expect(rnwClass('borderTopColor', [47, 51, 54, 1])).toBe('r-2sztyj');
    expect(rnwClass('borderBottomColor', [47, 51, 54, 1])).toBe('r-1igl3o0');
  });

  it('paints each of X’s blue declarations with the matching accent token', () => {
    const blue = [29, 155, 240] as const;
    const expected: Array<[string, [number, number, number, number], string, string]> = [
      ['color', [...blue, 1], 'accent-text', 'color'],
      ['backgroundColor', [...blue, 1], 'accent-fill', 'background-color'],
      ['borderColor', [...blue, 1], 'accent-fill', 'border-color'],
      ['borderBottomColor', [...blue, 1], 'accent-fill', 'border-bottom-color'],
      ['borderTopColor', [...blue, 1], 'accent-fill', 'border-top-color'],
      ['backgroundColor', [26, 140, 216, 1], 'accent-hover', 'background-color'],
      ['backgroundColor', [23, 124, 192, 1], 'accent-active', 'background-color'],
      ['backgroundColor', [...blue, 0.1], 'accent-tint', 'background-color'],
      ['backgroundColor', [...blue, 0.2], 'accent-tint', 'background-color'],
    ];
    for (const [property, rgba, role, css] of expected) {
      const cls = rnwClass(property, rgba);
      const surface = SURFACES.find((s) =>
        s.selectors.some((selector) => selector.startsWith(`.${cls}`)),
      );
      expect(surface, `${property} ${rgba.join(',')} → .${cls}`).toBeDefined();
      expect(surface!.role).toBe(role);
      expect(surface!.properties).toContain(css);
    }
  });

  it('leaves X’s like pink, repost green and error red alone', () => {
    const status = [
      [249, 24, 128],
      [0, 186, 124],
      [244, 33, 46],
    ] as const;
    const selectors = SURFACES.flatMap((s) => s.selectors).join(' ');
    for (const rgb of status) {
      for (const property of ['color', 'backgroundColor', 'borderColor'])
        expect(selectors).not.toContain(rnwClass(property, [...rgb, 1]));
      expect(selectors).not.toContain(rgb.join(', '));
    }
  });

  it('writes the derived accent states into the palette', () => {
    const vars = themeVars(deriveTokens({ ...LIGHTS_OUT_SEED, accent: '#1d9bf0' }));
    // Exactly X's own hover, pressed and focus colors for its blue.
    expect(vars).toContain('--bx-t-accent-hover: #1a8cd8;');
    expect(vars).toContain('--bx-t-accent-active: #177cc0;');
    expect(vars).toContain('--bx-t-ring: #8ecdf8;');
    expect(vars).toContain('--bx-t-accent-tint: rgba(29, 155, 240, 0.1);');
    expect(themeVars(deriveTokens({ ...LIGHTS_OUT_SEED, accent: '#ff00aa' }))).toContain(
      '--bx-t-accent-fill: #ff00aa;',
    );
  });
});
