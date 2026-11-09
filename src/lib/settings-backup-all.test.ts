import { beforeEach, describe, expect, it } from 'vitest';
import { featureRegistry } from '../features';
import { freshEnvironment } from '../test/fakes';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type Settings,
} from './settings';
import {
  createSettingsBackup,
  importPatch,
  parseSettingsBackup,
  SETTINGS_BACKUP_FORMAT,
  type ImportMode,
} from './settings-backup';

/**
 * Every field of `Settings` is in exactly one of these lists. Adding a setting without deciding
 * whether backups carry it fails the first test below.
 */
const BACKED_UP = [
  'theme',
  'accent',
  'density',
  'downloadsEnabled',
  'afterSave',
  'menuActions',
  'saveAs',
  'insights',
  'filter',
  'xTheme',
  'openAs',
  'popupHeight',
  'panelMode',
  'panelHandle',
  'features',
  'values',
] as const satisfies readonly (keyof Settings)[];
/** Not a setting: the stored object's schema version. */
const NOT_BACKED_UP = ['version'] as const satisfies readonly (keyof Settings)[];

/** Every setting moved away from its default: each switch flipped, each number changed. */
function everythingChanged(): Settings {
  const features: Record<string, boolean> = {};
  const values: Record<string, number> = {};
  for (const def of featureRegistry.list()) {
    features[def.id] = !def.defaultEnabled;
    if (def.kind === 'slider') values[def.id] = def.defaultValue === def.max ? def.min : def.max;
    else if (def.kind === 'color')
      values[def.id] = def.defaultValue === 0x123456 ? 0x654321 : 0x123456;
  }
  return normalizeSettings({
    theme: 'dark',
    accent: '#ab12cd',
    density: 'dense',
    downloadsEnabled: false,
    afterSave: 'confirmationOnly',
    menuActions: { download: false, openLibrary: false },
    saveAs: true,
    insights: { lookup: 'visible' },
    filter: {
      countries: ['Germany', 'Japan'],
      mode: 'highlight',
      posts: false,
      quotes: false,
      alwaysShow: [{ handle: 'someone', id: '12345' }, { handle: 'other' }],
    },
    xTheme: {
      active: 'nord',
      chat: true,
      custom: {
        bg: '#101010',
        text: '#fafafa',
        accent: '#ff00aa',
        raised: '#202020',
        hover: '#303030',
        border: '#404040',
        muted: '#a0a0a0',
      },
    },
    // How Better X opens, which a second browser should copy too.
    openAs: 'window',
    popupHeight: 'tall',
    panelMode: DEFAULT_SETTINGS.panelMode === 'overlay' ? 'native' : 'overlay',
    panelHandle: true,
    features,
    values,
  });
}

const pick = (settings: Settings) =>
  Object.fromEntries(BACKED_UP.map((key) => [key, settings[key]]));

async function exportThenImport(source: Settings, mode: ImportMode, target: Settings) {
  const text = JSON.stringify(createSettingsBackup(source, featureRegistry));
  const parsed = parseSettingsBackup(text, featureRegistry, target);
  if (!parsed.ok) throw new Error(parsed.error);
  await saveSettings(target);
  await saveSettings(importPatch(parsed.backup, mode, featureRegistry, target));
  return { parsed, stored: await loadSettings() };
}

beforeEach(async () => {
  await freshEnvironment();
});

describe('settings backup carries every setting a person chooses', () => {
  it('every setting is backed up (a new one fails here until it is listed)', () => {
    const listed = [...BACKED_UP, ...NOT_BACKED_UP].sort();
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(listed);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('the fixture really changes every backed-up setting and every feature', () => {
    const changed = everythingChanged();
    for (const key of BACKED_UP) expect(changed[key], key).not.toEqual(DEFAULT_SETTINGS[key]);
    for (const def of featureRegistry.list()) {
      expect(changed.features[def.id], def.id).toBe(!def.defaultEnabled);
      if (def.kind !== 'toggle') expect(changed.values[def.id], def.id).not.toBe(def.defaultValue);
    }
  });

  for (const mode of ['replace', 'merge'] as const)
    it(`${mode}: a fresh browser ends up with exactly the same settings`, async () => {
      const source = everythingChanged();
      const { parsed, stored } = await exportThenImport(source, mode, DEFAULT_SETTINGS);
      expect(pick(stored)).toEqual(pick(source));
      // Nothing was skipped or misread on the way.
      expect(parsed.preview.invalid).toBe(0);
      expect(parsed.preview.unsupported).toBe(0);
      expect(parsed.preview.recognized).toBe(parsed.preview.found);
    });

  it('replace: a default setup carried onto a changed one puts every setting back', async () => {
    const { stored } = await exportThenImport(DEFAULT_SETTINGS, 'replace', everythingChanged());
    expect(pick(stored)).toEqual(pick(DEFAULT_SETTINGS));
  });

  it('counts every change in the preview', () => {
    const text = JSON.stringify(createSettingsBackup(everythingChanged(), featureRegistry));
    const parsed = parseSettingsBackup(text, featureRegistry, DEFAULT_SETTINGS);
    if (!parsed.ok) throw new Error(parsed.error);
    // Two per value feature (switch and number), one per toggle, plus the rest named here.
    const defs = featureRegistry.list();
    const featureChanges = defs.reduce((n, def) => n + (def.kind === 'toggle' ? 1 : 2), 0);
    const others =
      2 + // theme, accent
      5 + // density, downloads, after save, ask where, menu download
      1 + // menu open library
      1 + // lookup
      3 + // filter mode, posts, quotes
      2 + // countries added
      2 + // always show added
      2 + // X theme active, chat
      7 + // custom colors
      4; // toolbar mode, popup height, panel mode, edge tab
    expect(parsed.preview.mergeChanges).toBe(featureChanges + others);
  });
});

describe('the preferences section', () => {
  const file = (extra: Record<string, unknown>) =>
    JSON.stringify({
      format: SETTINGS_BACKUP_FORMAT,
      version: 3,
      exportedAt: new Date().toISOString(),
      features: {},
      values: {},
      ...extra,
    });

  it('an older file without it leaves those settings alone, even on Replace', async () => {
    const current = everythingChanged();
    const parsed = parseSettingsBackup(file({}), featureRegistry, current);
    if (!parsed.ok) throw new Error(parsed.error);
    const patch = importPatch(parsed.backup, 'replace', featureRegistry, current);
    for (const key of ['density', 'downloadsEnabled', 'afterSave', 'saveAs', 'menuActions'])
      expect(patch).not.toHaveProperty(key);
  });

  it('judges each entry on its own: bad values are invalid and ignored, the rest apply', () => {
    const parsed = parseSettingsBackup(
      file({
        preferences: {
          density: 'tiny',
          downloadsEnabled: 'no',
          afterSave: 'quiet',
          saveAs: true,
          menuActions: { download: 1, openLibrary: false },
        },
      }),
      featureRegistry,
      DEFAULT_SETTINGS,
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.preferences).toEqual({
      afterSave: 'quiet',
      saveAs: true,
      menuActions: { openLibrary: false },
    });
    expect(parsed.preview.invalid).toBe(3);
    expect(parsed.preview.found).toBe(6);
  });

  it('refuses a file whose preferences are not an object', () => {
    const parsed = parseSettingsBackup(
      file({ preferences: 'compact' }),
      featureRegistry,
      DEFAULT_SETTINGS,
    );
    expect(parsed.ok).toBe(false);
  });
});
