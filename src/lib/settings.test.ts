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
