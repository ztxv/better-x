import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, applyPatch, normalizeSettings } from '../lib/settings';
import { featureRegistry } from '../features';
import { createSettingsBackup, importPatch, parseSettingsBackup } from '../lib/settings-backup';
import { resolveTheme } from './derive';
import {
  createThemeFile,
  newThemeId,
  parseThemeFile,
  themeFilename,
  uniqueThemeName,
} from './file';

const seed = { ...DEFAULT_SETTINGS.xTheme.custom, bg: '#101820', accent: '#ff8a3d' };

describe('theme files', () => {
  it('round-trips a theme through its file', () => {
    const parsed = parseThemeFile(JSON.stringify(createThemeFile('Sunset', seed)));
    expect(parsed).toEqual({ ok: true, name: 'Sunset', seed });
  });

  it('derives the colors a file leaves out and lowercases the rest', () => {
    const parsed = parseThemeFile(
      JSON.stringify({
        format: 'better-x-theme',
        version: 1,
        name: '  Loud\n name ',
        colors: { bg: '#000000', text: '#FFFFFF', accent: '#1D9BF0' },
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.name).toBe('Loud name');
    expect(parsed.seed.accent).toBe('#1d9bf0');
    for (const color of Object.values(parsed.seed)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['[]', 'not a Better X theme'],
    [JSON.stringify({ format: 'better-x-settings', version: 3 }), 'settings backup'],
    [JSON.stringify({ format: 'better-x-theme', version: 2, colors: {} }), 'newer version'],
    [JSON.stringify({ format: 'better-x-theme', version: 1 }), 'no colors'],
    [
      JSON.stringify({
        format: 'better-x-theme',
        version: 1,
        colors: { bg: 'red', text: '#ffffff', accent: '#1d9bf0' },
      }),
      'bg color',
    ],
    [
      JSON.stringify({
        format: 'better-x-theme',
        version: 1,
        colors: {
          bg: '#000000',
          text: '#ffffff',
          accent: '#1d9bf0',
          border: 'url(https://example.com)',
        },
      }),
      'border color',
    ],
    ['x'.repeat(30_000), 'too large'],
  ])('refuses %s', (text, message) => {
    const parsed = parseThemeFile(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(message);
  });

  it('names files and themes safely', () => {
    expect(themeFilename('My Theme! 2')).toBe('better-x-theme-my-theme-2.json');
    expect(themeFilename('///')).toBe('better-x-theme-custom.json');
    expect(uniqueThemeName('My theme', [])).toBe('My theme');
    expect(uniqueThemeName('My theme', ['My theme', 'My theme 2'])).toBe('My theme 3');
    expect(newThemeId()).toMatch(/^my-[a-z0-9]{8}$/);
  });
});

describe('saved themes in settings', () => {
  const saved = [{ id: 'my-abcd1234', name: 'Sunset', seed }];

  it('keeps valid themes, drops malformed ones, and resolves the active one', () => {
    const { xTheme } = normalizeSettings({
      xTheme: {
        active: 'my-abcd1234',
        saved: [
          ...saved,
          { id: 'my-abcd1234', name: 'Duplicate id', seed },
          { id: 'nord', name: 'Preset id', seed },
          { id: 'my-zzzz0000', name: '   ', seed },
          'junk',
        ],
      },
    });
    expect(xTheme.saved).toEqual(saved);
    expect(xTheme.active).toBe('my-abcd1234');
    expect(resolveTheme(xTheme.active, xTheme.custom, xTheme.saved)).toEqual({
      id: 'my-abcd1234',
      base: 'dark',
      seed,
    });
  });

  it('falls back to X’s own look when the active saved theme is deleted', () => {
    const before = normalizeSettings({ xTheme: { active: 'my-abcd1234', saved } });
    expect(applyPatch(before, { xTheme: { saved: [] } }).xTheme.active).toBeNull();
    expect(normalizeSettings({ xTheme: { active: 'my-nothere1' } }).xTheme.active).toBeNull();
  });

  it('travels in settings backups: replace copies, merge keeps local themes', () => {
    const source = normalizeSettings({ xTheme: { active: 'my-abcd1234', saved } });
    const text = JSON.stringify(createSettingsBackup(source, featureRegistry));
    const parsed = parseSettingsBackup(text, featureRegistry, DEFAULT_SETTINGS);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.preview.invalid).toBe(0);
    const replaced = applyPatch(
      DEFAULT_SETTINGS,
      importPatch(parsed.backup, 'replace', featureRegistry, DEFAULT_SETTINGS),
    );
    expect(replaced.xTheme).toEqual(source.xTheme);

    const local = normalizeSettings({
      xTheme: {
        saved: [
          { id: 'my-abcd1234', name: 'Mine', seed: DEFAULT_SETTINGS.xTheme.custom },
          { id: 'my-local001', name: 'Local', seed },
        ],
      },
    });
    const merged = applyPatch(local, importPatch(parsed.backup, 'merge', featureRegistry, local));
    expect(merged.xTheme.saved.map((theme) => theme.name)).toEqual(['Mine', 'Local']);
  });

  it('counts a bad saved theme in a backup as invalid and skips it', () => {
    const parsed = parseSettingsBackup(
      JSON.stringify({
        format: 'better-x-settings',
        version: 3,
        xTheme: { saved: [...saved, { id: 'my-bad00001', name: 'Bad', seed: { bg: 'red' } }] },
      }),
      featureRegistry,
      DEFAULT_SETTINGS,
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.xTheme.saved).toEqual(saved);
    expect(parsed.preview.invalid).toBe(1);
  });
});
