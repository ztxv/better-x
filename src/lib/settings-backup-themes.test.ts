import { describe, expect, it } from 'vitest';
import { featureRegistry } from '../features';
import {
  createSettingsBackup,
  importPatch,
  parseSettingsBackup,
  SETTINGS_BACKUP_FORMAT,
  type ImportMode,
  type ValidatedBackup,
} from './settings-backup';
import { applyPatch, DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const parse = (data: unknown, current: Settings = DEFAULT_SETTINGS) => {
  const result = parseSettingsBackup(JSON.stringify(data), featureRegistry, current);
  if (!result.ok) throw new Error(result.error);
  return result;
};
const apply = (current: Settings, backup: ValidatedBackup, mode: ImportMode) =>
  applyPatch(current, importPatch(backup, mode, featureRegistry, current));

const mine = normalizeSettings({
  xTheme: {
    active: 'custom',
    chat: true,
    custom: { ...DEFAULT_SETTINGS.xTheme.custom, bg: '#101820', accent: '#ff8a3d' },
  },
});
const themed = normalizeSettings({ xTheme: { active: 'nord', custom: { bg: '#222222' } } });

describe('settings backup v3: X themes', () => {
  it('exports the theme, its custom colors and the Chat switch', () => {
    const backup = createSettingsBackup(mine, featureRegistry, NOW);
    expect(backup.version).toBe(3);
    expect(backup.xTheme).toEqual(mine.xTheme);
  });

  it('round-trips through a replace import into a fresh install', () => {
    const { backup } = parse(createSettingsBackup(mine, featureRegistry, NOW));
    expect(apply(DEFAULT_SETTINGS, backup, 'replace').xTheme).toEqual(mine.xTheme);
  });

  it('merge sets only what the file names, color by color', () => {
    const { backup } = parse({
      format: SETTINGS_BACKUP_FORMAT,
      version: 3,
      xTheme: { custom: { accent: '#AABBCC' } },
    });
    const after = apply(themed, backup, 'merge').xTheme;
    expect(after).toEqual({
      ...themed.xTheme,
      custom: { ...themed.xTheme.custom, accent: '#aabbcc' },
    });
  });

  it('replace with a v3 file that leaves the theme out turns it off', () => {
    const { backup } = parse({ format: SETTINGS_BACKUP_FORMAT, version: 3 });
    expect(apply(themed, backup, 'replace').xTheme).toEqual(DEFAULT_SETTINGS.xTheme);
  });

  it('a v2 or v1 file leaves the theme alone, even on replace', () => {
    for (const version of [1, 2]) {
      const { backup } = parse({ format: SETTINGS_BACKUP_FORMAT, version, features: {} });
      expect(apply(themed, backup, 'replace').xTheme).toEqual(themed.xTheme);
      expect(apply(themed, backup, 'merge').xTheme).toEqual(themed.xTheme);
    }
  });

  it('judges each theme entry alone: bad colors and unknown presets are skipped and counted', () => {
    const result = parse({
      format: SETTINGS_BACKUP_FORMAT,
      version: 3,
      xTheme: {
        active: 'neon',
        chat: 'yes',
        custom: {
          bg: '#123456',
          text: 'red;}body{display:none',
          accent: 'url(https://evil)',
          muted: '#fff',
          border: '#ABCDEF',
        },
      },
    });
    expect(result.backup.xTheme).toEqual({ custom: { bg: '#123456', border: '#abcdef' } });
    expect(result.preview).toMatchObject({ found: 7, unsupported: 1, invalid: 4, recognized: 2 });
    const after = apply(DEFAULT_SETTINGS, result.backup, 'merge');
    expect(after.xTheme.active).toBeNull();
    expect(JSON.stringify(after)).not.toMatch(/display|evil/);
  });

  it('accepts null as "X’s own look" and counts theme changes in the preview', () => {
    const result = parse(
      { format: SETTINGS_BACKUP_FORMAT, version: 3, xTheme: { active: null, chat: true } },
      themed,
    );
    expect(result.backup.xTheme).toEqual({ active: null, chat: true });
    expect(result.preview.mergeChanges).toBe(2);
  });

  it('refuses an xTheme section that is not an object', () => {
    const result = parseSettingsBackup(
      JSON.stringify({ format: SETTINGS_BACKUP_FORMAT, version: 3, xTheme: 'dim' }),
      featureRegistry,
      DEFAULT_SETTINGS,
    );
    expect(result.ok).toBe(false);
  });
});
