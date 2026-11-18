import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { deriveTokens } from './derive';
import { panelTokens } from './panel';
import { LIGHTS_OUT_SEED, PRESETS } from './presets';

const HEX = /^#[0-9a-f]{6}$/;

describe('panelTokens (Match Better X to my X theme)', () => {
  it('is off unless the switch is on', () => {
    expect(panelTokens(DEFAULT_SETTINGS.xTheme)).toBeNull();
  });

  it('paints the panel with the active theme, Custom and named themes included', () => {
    const preset = PRESETS[0]!;
    const on = { ...DEFAULT_SETTINGS.xTheme, matchPanel: true };
    const fromPreset = panelTokens({ ...on, active: preset.id })!;
    expect(fromPreset['--bg']).toBe(deriveTokens(preset.seed).bg);
    const custom = { ...LIGHTS_OUT_SEED, bg: '#102030' };
    expect(panelTokens({ ...on, active: 'custom', custom })!['--bg']).toBe('#102030');
    const saved = [
      { id: 'my-abcd1234', name: 'Mine', seed: { ...LIGHTS_OUT_SEED, bg: '#203040' } },
    ];
    expect(panelTokens({ ...on, active: 'my-abcd1234', saved })!['--bg']).toBe('#203040');
  });

  it('matches Lights out when no theme is chosen, and writes only colors', () => {
    const tokens = panelTokens({ ...DEFAULT_SETTINGS.xTheme, matchPanel: true })!;
    expect(tokens['--bg']).toBe(deriveTokens(LIGHTS_OUT_SEED).bg);
    for (const value of Object.values(tokens)) expect(value).toMatch(HEX);
  });
});
