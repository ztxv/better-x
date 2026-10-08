import { beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  resetSettings,
  saveSettings,
  watchSettings,
} from './settings';

beforeEach(async () => {
  await freshEnvironment();
});

describe('settings', () => {
  it('fall back field by field to safe defaults', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        theme: 'neon',
        accent: 'toString',
        downloadsEnabled: 'yes',
        afterSave: 'quiet',
        menuActions: { download: false, openLibrary: 3 },
        saveAs: true,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      afterSave: 'quiet',
      menuActions: { download: false, openLibrary: true },
      saveAs: true,
    });
  });

  it('save partial changes and notify other contexts live', async () => {
    const seen: string[] = [];
    const stop = watchSettings((settings) => seen.push(settings.accent));
    await saveSettings({ accent: 'green' });
    await saveSettings({ menuActions: { openLibrary: false } });
    expect(await loadSettings()).toMatchObject({
      accent: 'green',
      menuActions: { download: true, openLibrary: false },
    });
    expect(seen).toEqual(['green', 'green']);
    stop();
    await resetSettings();
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('every accent keeps small text at 4.5:1 or better', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    for (const accent of Object.values(ACCENTS)) {
      expect(contrast(accent.text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent.text, '#f7f8f8')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent.textDark, '#000000')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent.textDark, '#101215')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('settings: customization toggles', () => {
  it('load a stored version 1 object with every other value kept and no toggles set', async () => {
    const { data } = await freshEnvironment();
    data['bx.settings'] = {
      version: 1,
      theme: 'dark',
      accent: 'green',
      downloadsEnabled: false,
      afterSave: 'quiet',
      menuActions: { download: false, openLibrary: true },
      saveAs: true,
    };
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      accent: 'green',
      downloadsEnabled: false,
      afterSave: 'quiet',
      menuActions: { download: false, openLibrary: true },
      saveAs: true,
      features: {},
    });
    await saveSettings({ accent: 'pink' });
    expect(data['bx.settings']).toMatchObject({ version: 2, theme: 'dark', accent: 'pink' });
  });

  it('keep only well-formed id: boolean entries', () => {
    const features = normalizeSettings({
      features: {
        'cleanup.hideAds': true,
        'feed.hideForYou': false,
        'cleanup.bad': 'yes',
        'no-dot': true,
        '__proto__.x': true,
        'Cleanup.upper': true,
      },
    }).features;
    expect(features).toEqual({ 'cleanup.hideAds': true, 'feed.hideForYou': false });
    expect(normalizeSettings({ features: [true] }).features).toEqual({});
    expect(normalizeSettings({ features: 'x' }).features).toEqual({});
  });

  it('merge a features patch with what is stored, and tell other contexts', async () => {
    const seen: Array<Record<string, boolean>> = [];
    const stop = watchSettings((settings) => seen.push(settings.features));
    await saveSettings({ features: { 'cleanup.hideAds': true } });
    await saveSettings({ features: { 'feed.hideForYou': true } });
    await saveSettings({ features: { 'cleanup.hideAds': false } });
    expect((await loadSettings()).features).toEqual({
      'cleanup.hideAds': false,
      'feed.hideForYou': true,
    });
    expect(seen).toHaveLength(3);
    expect(seen[1]).toEqual({ 'cleanup.hideAds': true, 'feed.hideForYou': true });
    stop();
  });

  it('are not changed by changing an unrelated preference', async () => {
    await saveSettings({ features: { 'cleanup.hideAds': true } });
    await saveSettings({ accent: 'orange', menuActions: { download: false } });
    expect((await loadSettings()).features).toEqual({ 'cleanup.hideAds': true });
  });

  it('survive resetting appearance and Saved preferences', async () => {
    await saveSettings({ accent: 'orange', saveAs: true, features: { 'cleanup.hideAds': true } });
    await resetSettings();
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      features: { 'cleanup.hideAds': true },
    });
  });
});
