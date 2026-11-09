import { beforeEach, describe, expect, it } from 'vitest';
import { featureRegistry } from '../features';
import { createBackup } from './backup';
import { freshEnvironment } from '../test/fakes';
import {
  createSettingsBackup,
  importPatch,
  MAX_BACKUP_BYTES,
  parseSettingsBackup,
  SETTINGS_BACKUP_FORMAT,
  SETTINGS_BACKUP_VERSION,
  settingsBackupFilename,
  type ImportMode,
} from './settings-backup';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type Settings,
} from './settings';

const NOW = new Date('2026-10-08T12:34:56.000Z');
const file = (data: unknown) => JSON.stringify(data);
const valid = (extra: Record<string, unknown> = {}) => ({
  format: SETTINGS_BACKUP_FORMAT,
  version: 1,
  exportedAt: NOW.toISOString(),
  features: {},
  values: {},
  appearance: {},
  ...extra,
});
const parse = (text: string, current: Settings = DEFAULT_SETTINGS) =>
  parseSettingsBackup(text, featureRegistry, current);
const ok = (text: string, current: Settings = DEFAULT_SETTINGS) => {
  const result = parse(text, current);
  if (!result.ok) throw new Error(result.error);
  return result;
};

/** Applies a file the way the panel does and returns what is stored. */
async function importFile(data: unknown, mode: ImportMode) {
  const { backup } = ok(file(data), await loadSettings());
  await saveSettings(importPatch(backup, mode, featureRegistry));
  return loadSettings();
}

beforeEach(async () => {
  await freshEnvironment();
});

describe('settings backup: export', () => {
  const configured = normalizeSettings({
    theme: 'dark',
    accent: 'pink',
    downloadsEnabled: false,
    afterSave: 'quiet',
    saveAs: true,
    features: {
      'cleanup.hideAds': true,
      'feed.hideForYou': false,
      'appearance.timelineWidth': true,
      'not.aFeature': true,
    },
    values: { 'appearance.timelineWidth': 800, 'appearance.gone': 5 },
  });

  it('names the format and version, and carries every configured switch and number', () => {
    const backup = createSettingsBackup(configured, featureRegistry, NOW);
    expect(backup).toEqual({
      format: 'better-x-settings',
      version: SETTINGS_BACKUP_VERSION,
      exportedAt: '2026-10-08T12:34:56.000Z',
      features: {
        'cleanup.hideAds': true,
        'feed.hideForYou': false,
        'appearance.timelineWidth': true,
      },
      values: { 'appearance.timelineWidth': 800 },
      appearance: { theme: 'dark', accent: 'pink' },
      preferences: {
        density: 'comfortable',
        downloadsEnabled: false,
        afterSave: 'quiet',
        saveAs: true,
        menuActions: { download: true, openLibrary: true },
      },
      insights: { lookup: 'hover' },
      filter: { countries: [], mode: 'collapse', posts: true, quotes: true, alwaysShow: [] },
      xTheme: { active: null, chat: false },
    });
  });

  it('holds no library data, how this device opens the panel, ids or paths', () => {
    const text = JSON.stringify(createSettingsBackup(configured, featureRegistry, NOW));
    for (const forbidden of [
      'bookmarks',
      'collections',
      '"downloads"',
      'openAs',
      'popupHeight',
      'panelMode',
      'panelHandle',
      'chrome-extension',
      '/Users/',
      'cookie',
      'csrf',
      'authorization',
      'bx.accounts',
    ])
      expect(text).not.toContain(forbidden);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      'appearance',
      'exportedAt',
      'features',
      'filter',
      'format',
      'insights',
      'preferences',
      'values',
      'version',
      'xTheme',
    ]);
  });

  it('is a fresh install’s empty configuration when nothing was set', () => {
    const backup = createSettingsBackup(DEFAULT_SETTINGS, featureRegistry, NOW);
    expect(backup.features).toEqual({});
    expect(backup.values).toEqual({});
  });

  it('is named by date', () => {
    expect(settingsBackupFilename(NOW)).toBe('better-x-settings-2026-10-08.json');
  });
});

describe('settings backup: reading a file', () => {
  it('round-trips: an export read back sets exactly the same preferences', async () => {
    const configured = normalizeSettings({
      theme: 'light',
      accent: 'green',
      features: { 'cleanup.hideAds': true, 'feed.hideForYou': false, 'sidebar.hideFooter': true },
      values: { 'appearance.sidebarWidth': 300, 'appearance.navSpacing': 0 },
    });
    const text = JSON.stringify(createSettingsBackup(configured, featureRegistry, NOW));
    const result = ok(text);
    expect(result.backup).toEqual({
      features: { 'cleanup.hideAds': true, 'feed.hideForYou': false, 'sidebar.hideFooter': true },
      values: { 'appearance.sidebarWidth': 300, 'appearance.navSpacing': 0 },
      appearance: { theme: 'light', accent: 'green' },
      prefs: true,
      preferences: {
        density: 'comfortable',
        downloadsEnabled: true,
        afterSave: 'downloadOffer',
        saveAs: false,
        menuActions: { download: true, openLibrary: true },
      },
      smart: true,
      insights: { lookup: 'hover' },
      filter: {
        countries: [],
        mode: 'collapse',
        posts: true,
        quotes: true,
        alwaysShow: [],
      },
      themes: true,
      xTheme: { active: null, chat: false },
    });
    const stored = await importFile(JSON.parse(text), 'replace');
    expect(stored.features).toEqual(configured.features);
    expect(stored.values).toEqual(configured.values);
    expect([stored.theme, stored.accent]).toEqual(['light', 'green']);
  });

  it('round-trips defaults: an unconfigured export changes nothing', async () => {
    const text = JSON.stringify(createSettingsBackup(DEFAULT_SETTINGS, featureRegistry, NOW));
    const result = ok(text, DEFAULT_SETTINGS);
    expect(result.preview).toMatchObject({ unsupported: 0, invalid: 0, replaceChanges: 0 });
    const stored = await importFile(JSON.parse(text), 'replace');
    expect(stored).toEqual(DEFAULT_SETTINGS);
  });

  it('counts what it found, recognized, ignored and would change', () => {
    const result = ok(
      file(
        valid({
          features: {
            'cleanup.hideAds': true,
            'sidebar.hideFooter': false,
            'future.newThing': true,
            'posts.hideViews': 'yes',
          },
          values: { 'appearance.sidebarWidth': 300, 'appearance.futureSlider': 3 },
          appearance: { theme: 'dark', accent: 'chartreuse' },
        }),
      ),
    );
    expect(result.preview).toEqual({
      found: 8,
      recognized: 4,
      unsupported: 2,
      invalid: 2,
      // hideAds on, sidebarWidth 300, theme dark (hideFooter false is already the default).
      mergeChanges: 3,
      replaceChanges: 3,
    });
  });

  it('reports merge and replace separately: replace also undoes what the file does not name', () => {
    const current = normalizeSettings({
      features: { 'posts.hideViews': true, 'cleanup.hideAds': true },
      values: { 'appearance.navSpacing': 2 },
      accent: 'pink',
    });
    const { preview } = ok(file(valid({ features: { 'cleanup.hideAds': true } })), current);
    expect(preview.mergeChanges).toBe(0);
    // hideViews off, navSpacing back to 6 (it was set but its switch is off), accent back to blue.
    expect(preview.replaceChanges).toBe(3);
  });

  it('judges each entry alone: bad ones do not stop the good ones', () => {
    const { backup } = ok(
      file(valid({ features: { 'cleanup.hideAds': true, 'nope.x': 1, 'feed.hideForYou': 'on' } })),
    );
    expect(backup.features).toEqual({ 'cleanup.hideAds': true });
  });
});

describe('settings backup: refusing files', () => {
  it.each([
    ['not JSON', '{nope', /not valid JSON/],
    ['an array', '[]', /not a Better X settings backup/],
    ['null', 'null', /not a Better X settings backup/],
    ['a string', '"hi"', /not a Better X settings backup/],
    ['another format', file({ format: 'something', version: 1 }), /not a Better X settings backup/],
    ['no format', file({ version: 1, features: {} }), /not a Better X settings backup/],
    ['a Library backup', file({ format: 'better-x', version: 1, bookmarks: [] }), /Library backup/],
    [
      'a Saved for X backup',
      file({ format: 'saved-for-x', version: 3, bookmarks: [] }),
      /Library backup/,
    ],
    ['no version', file({ format: SETTINGS_BACKUP_FORMAT, features: {} }), /valid version/],
    ['version 0', file(valid({ version: 0 })), /valid version/],
    ['a fractional version', file(valid({ version: 1.5 })), /valid version/],
    ['a version as text', file(valid({ version: '1' })), /valid version/],
    ['a newer version', file(valid({ version: SETTINGS_BACKUP_VERSION + 1 })), /newer Better X/],
    ['features as a list', file(valid({ features: [true] })), /“features”/],
    ['values as text', file(valid({ values: 'wide' })), /“values”/],
    ['appearance as a number', file(valid({ appearance: 3 })), /“appearance”/],
  ])('refuses %s', (_, text, message) => {
    const result = parse(text as string);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message as RegExp);
  });

  it('refuses a file too large to be ours without parsing it', () => {
    const result = parse(' '.repeat(MAX_BACKUP_BYTES + 1));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/too large/) });
  });

  it('refuses an absurd number of entries', () => {
    const features = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`x.f${i}`, true]));
    expect(parse(file(valid({ features }))).ok).toBe(false);
  });

  it('never changes stored settings, whatever it refuses', async () => {
    await saveSettings({ features: { 'cleanup.hideAds': true }, accent: 'pink' });
    const before = await loadSettings();
    for (const text of ['{nope', '[]', file(valid({ version: 9 })), file(valid({ features: 5 }))])
      parse(text, before);
    expect(await loadSettings()).toEqual(before);
  });
});

describe('settings backup: slider validation policy', () => {
  const slider = featureRegistry.get('appearance.timelineWidth')!;
  const bad = (value: unknown) => ok(file(valid({ values: { [slider.id]: value } })));

  it.each([
    ['below the range', 100],
    ['above the range', 100000],
    ['off its step', 705],
    ['not a number', '800'],
    ['null', null],
    ['an object', { a: 1 }],
    ['negative', -800],
  ])('skips a number %s and counts it as invalid, not bent into range', (_, value) => {
    const result = bad(value);
    expect(result.backup.values).toEqual({});
    expect(result.preview).toMatchObject({ found: 1, recognized: 0, invalid: 1 });
  });

  it('refuses non-finite numbers that JSON itself cannot carry, and accepts the limits', () => {
    expect(bad(500).backup.values).toEqual({ [slider.id]: 500 });
    expect(bad(1000).backup.values).toEqual({ [slider.id]: 1000 });
    expect(bad(Number.NaN).backup.values).toEqual({});
  });

  it('treats a number for a switch-only feature as invalid', () => {
    const result = ok(file(valid({ values: { 'cleanup.hideAds': 1 } })));
    expect(result.preview.invalid).toBe(1);
  });

  it('is not fooled by prototype keys', () => {
    const result = ok(
      '{"format":"better-x-settings","version":1,"features":{"__proto__":true,"constructor":true,"toString":true},"values":{"__proto__":5}}',
    );
    expect(result.backup.features).toEqual({});
    expect(result.preview).toMatchObject({ found: 4, unsupported: 4 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('settings backup: applying', () => {
  it('merge sets what the file names and keeps the rest, including unrelated preferences', async () => {
    await saveSettings({
      features: { 'posts.hideViews': true, 'cleanup.hideAds': false },
      values: { 'appearance.navSpacing': 3 },
      downloadsEnabled: false,
      afterSave: 'quiet',
      accent: 'purple',
      menuActions: { download: false },
    });
    const stored = await importFile(
      valid({
        features: { 'cleanup.hideAds': true, 'sidebar.hideFooter': true },
        values: { 'appearance.sidebarWidth': 280 },
        appearance: { theme: 'dark' },
      }),
      'merge',
    );
    expect(stored.features).toEqual({
      'posts.hideViews': true,
      'cleanup.hideAds': true,
      'sidebar.hideFooter': true,
    });
    expect(stored.values).toEqual({ 'appearance.navSpacing': 3, 'appearance.sidebarWidth': 280 });
    expect([stored.theme, stored.accent]).toEqual(['dark', 'purple']);
    expect(stored.downloadsEnabled).toBe(false);
    expect(stored.afterSave).toBe('quiet');
    expect(stored.menuActions.download).toBe(false);
  });

  it('replace makes the file the whole customization and still leaves Saved and downloads alone', async () => {
    await saveSettings({
      features: { 'posts.hideViews': true },
      values: { 'appearance.navSpacing': 3 },
      downloadsEnabled: false,
      afterSave: 'quiet',
      saveAs: true,
      accent: 'purple',
      theme: 'light',
    });
    const stored = await importFile(
      valid({ features: { 'cleanup.hideAds': true }, appearance: { accent: 'green' } }),
      'replace',
    );
    expect(stored.features).toEqual({ 'cleanup.hideAds': true });
    expect(stored.values).toEqual({});
    // Theme was not in the file, so it goes back to its default; accent comes from the file.
    expect([stored.theme, stored.accent]).toEqual([DEFAULT_SETTINGS.theme, 'green']);
    expect(stored.downloadsEnabled).toBe(false);
    expect(stored.afterSave).toBe('quiet');
    expect(stored.saveAs).toBe(true);
  });

  it('merge never touches an appearance field the file does not name', async () => {
    await saveSettings({ accent: 'orange', theme: 'dark' });
    const stored = await importFile(valid({ features: { 'cleanup.hideAds': true } }), 'merge');
    expect([stored.theme, stored.accent]).toEqual(['dark', 'orange']);
  });

  it('is safe to import the same file again and again', async () => {
    const data = valid({
      features: { 'cleanup.hideAds': true, 'posts.hideViews': false },
      values: { 'appearance.sidebarWidth': 300 },
      appearance: { theme: 'dark' },
    });
    const first = await importFile(data, 'merge');
    for (const mode of ['merge', 'replace', 'merge'] as const)
      expect(await importFile(data, mode)).toEqual(first);
    expect(ok(file(data), first).preview).toMatchObject({ mergeChanges: 0, replaceChanges: 0 });
  });

  it('applies in one storage write, so a reader never sees half of it', async () => {
    const writes: unknown[] = [];
    const original = chrome.storage.local.set;
    chrome.storage.local.set = (async (values: Record<string, unknown>) => {
      writes.push(values);
      return original(values);
    }) as typeof chrome.storage.local.set;
    await importFile(
      valid({
        features: { 'cleanup.hideAds': true, 'posts.hideViews': true },
        values: { 'appearance.sidebarWidth': 300 },
        appearance: { theme: 'dark', accent: 'pink' },
      }),
      'replace',
    );
    expect(writes).toHaveLength(1);
  });

  it('leaves the Library backup format and its reader unchanged', () => {
    const library = createBackup({ bookmarks: [], collections: [] }, []);
    expect(library.format).toBe('better-x');
    expect(library.version).toBe(1);
    // …and a Library file is never mistaken for a settings file.
    expect(parse(JSON.stringify(library)).ok).toBe(false);
  });
});
