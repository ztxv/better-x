import { describe, expect, it } from 'vitest';
import { contrast, toRgb } from '../lib/color';
import { contrastWarnings, deriveTokens, fillSeed, resolveTheme } from './derive';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, PRESETS, isPresetId } from './presets';
import type { ThemeSeed } from './types';

const ratio = (a: string, b: string) => contrast(toRgb(a), toRgb(b));
const HEX = /^#[0-9a-f]{6}$/;

const ADVERSARIAL: ThemeSeed[] = [
  { bg: '#ffffff', text: '#ffffff', accent: '#ffffff' },
  { bg: '#000000', text: '#000000', accent: '#000000' },
  { bg: '#777777', text: '#777777', accent: '#777777' },
  { bg: '#000000', text: '#e7e9ea', accent: '#ffd400' },
  { bg: '#ffffff', text: '#000000', accent: '#ffd400' },
  { bg: '#15202b', text: '#f7f9f9', accent: '#15202b', muted: '#15202b' },
];

describe('deriveTokens', () => {
  it('keeps muted and accent text at 4.5:1 for every preset, Lights Out and adversarial seeds', () => {
    for (const seed of [...PRESETS.map((p) => p.seed), LIGHTS_OUT_SEED, ...ADVERSARIAL]) {
      const tokens = deriveTokens(seed);
      expect(ratio(tokens.muted, tokens.bg), JSON.stringify(seed)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens.accentText, tokens.bg), JSON.stringify(seed)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never changes the person’s own background, text or accent', () => {
    for (const seed of [...PRESETS.map((p) => p.seed), ...ADVERSARIAL]) {
      const tokens = deriveTokens(seed);
      expect([tokens.bg, tokens.text, tokens.accent]).toEqual([seed.bg, seed.text, seed.accent]);
    }
  });

  it('fills missing colors from bg and text, and keeps supplied ones', () => {
    const tokens = deriveTokens({ bg: '#000000', text: '#ffffff', accent: '#1d9bf0' });
    expect(tokens.raised).toBe('#141414');
    expect(tokens.hover).toBe('#0a0a0a');
    expect(tokens.border).toBe('#292929');
    expect(deriveTokens(LIGHTS_OUT_SEED)).toMatchObject({
      raised: '#202327',
      hover: '#16181c',
      border: '#2f3336',
      muted: '#71767b',
    });
  });

  it('writes only #rrggbb and its own rgba()', () => {
    const tokens = deriveTokens({ bg: '#15202B', text: '#f7f9f9', accent: '#1D9BF0' });
    for (const [key, value] of Object.entries(tokens))
      if (key === 'backdrop' || key === 'scrim') expect(value).toMatch(/^rgba\(/);
      else expect(value).toMatch(HEX);
    expect(tokens.backdrop).toBe('rgba(21, 32, 43, 0.85)');
  });

  it('falls back from malformed seed colors instead of passing them on', () => {
    const tokens = deriveTokens({
      bg: 'red;}body{display:none',
      text: 'url(x)',
      accent: '#12345678',
      muted: '</style>',
    });
    expect(tokens.bg).toBe('#000000');
    expect(tokens.text).toBe('#e7e9ea');
    expect(tokens.accent).toBe('#1d9bf0');
    for (const value of Object.values(tokens)) expect(value).not.toMatch(/[;{}<>]|url/);
  });
});

describe('presets', () => {
  it('have unique, well-formed ids, dark bases and hex seeds', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(CUSTOM_THEME_ID);
    for (const preset of PRESETS) {
      expect(preset.id).toMatch(/^[a-z][a-z0-9]{1,15}$/);
      expect(preset.base).toBe('dark');
      expect(preset.title.length).toBeGreaterThan(0);
      for (const value of Object.values(preset.seed)) expect(value).toMatch(HEX);
      expect(ratio(preset.seed.text, preset.seed.bg)).toBeGreaterThanOrEqual(4.5);
      expect(isPresetId(preset.id)).toBe(true);
    }
  });

  it('ship the ids settings already store, never renamed', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'dim',
      'graphite',
      'midnight',
      'nord',
      'dracula',
      'mocha',
      'rosepine',
      'tokyo',
      'gruvbox',
      'solarized',
      'forest',
      'ember',
    ]);
  });
});

describe('resolveTheme, warnings, fillSeed', () => {
  it('resolves presets, custom and nothing', () => {
    expect(resolveTheme('nord', LIGHTS_OUT_SEED)?.id).toBe('nord');
    expect(resolveTheme('custom', LIGHTS_OUT_SEED)).toMatchObject({ id: 'custom', base: 'dark' });
    expect(resolveTheme(null, LIGHTS_OUT_SEED)).toBeUndefined();
    expect(resolveTheme('nope', LIGHTS_OUT_SEED)).toBeUndefined();
  });

  it('warns about low-contrast pairs without blocking them', () => {
    expect(contrastWarnings(LIGHTS_OUT_SEED)).toEqual([]);
    const pairs = contrastWarnings({
      bg: '#202020',
      text: '#303030',
      accent: '#252525',
      border: '#212121',
    }).map((w) => w.pair);
    expect(pairs).toEqual(['text', 'accent', 'border']);
  });

  it('fills every seed color for "Start from"', () => {
    const filled = fillSeed(PRESETS.find((p) => p.id === 'nord')!.seed);
    expect(Object.keys(filled).sort()).toEqual(
      ['accent', 'bg', 'border', 'hover', 'muted', 'raised', 'text'].sort(),
    );
    for (const value of Object.values(filled)) expect(value).toMatch(HEX);
  });
});
