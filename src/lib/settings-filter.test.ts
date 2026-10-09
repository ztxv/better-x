import { beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  MAX_ALWAYS_SHOW,
  normalizeAlwaysShow,
  normalizeCountries,
  normalizeHandle,
  normalizeSettings,
  resetSettings,
  saveSettings,
  SETTINGS_VERSION,
} from './settings';

beforeEach(async () => {
  await freshEnvironment();
});

describe('settings version 5: account insights and the country filter', () => {
  it('starts with conservative defaults', () => {
    expect(DEFAULT_SETTINGS.insights).toEqual({ lookup: 'hover' });
    expect(DEFAULT_SETTINGS.filter).toEqual({
      countries: [],
      mode: 'collapse',
      posts: true,
      quotes: true,
      alwaysShow: [],
    });
  });

  it.each([
    ['version 1', { version: 1, theme: 'dark', accent: 'pink' }],
    ['version 2', { version: 2, accent: 'pink', features: { 'cleanup.hideAds': true } }],
    [
      'version 3',
      {
        version: 3,
        accent: 'pink',
        features: { 'cleanup.hideAds': true },
        values: { 'appearance.timelineWidth': 700 },
      },
    ],
    [
      'version 4',
      { version: 4, accent: 'pink', openAs: 'popup', features: { 'cleanup.hideAds': true } },
    ],
  ])('upgrades a stored %s object without losing anything', async (_name, stored) => {
    await chrome.storage.local.set({ 'bx.settings': stored });
    const loaded = await loadSettings();
    expect(loaded.version).toBe(SETTINGS_VERSION);
    expect(loaded.accent).toBe('pink');
    expect(loaded.insights).toEqual(DEFAULT_SETTINGS.insights);
    expect(loaded.filter).toEqual(DEFAULT_SETTINGS.filter);
    expect(loaded.features).toEqual((stored as { features?: object }).features ?? {});
    expect(loaded.values).toEqual((stored as { values?: object }).values ?? {});
    expect(loaded.openAs).toBe((stored as { openAs?: string }).openAs ?? 'sidepanel');
  });

  it('keeps all 64 earlier feature settings through the upgrade', async () => {
    const features = Object.fromEntries(
      Array.from({ length: 64 }, (_, i) => [`navigation.item${i}`, i % 2 === 0]),
    );
    await chrome.storage.local.set({ 'bx.settings': { version: 4, features } });
    const next = await saveSettings({ filter: { mode: 'hide' } });
    expect(next.features).toEqual(features);
    expect(next.filter.mode).toBe('hide');
  });

  it('keeps only real countries and region labels, canonical and once', () => {
    expect(
      normalizeCountries(['germany', 'Germany', 'DE', 'USA', 'United States', 'South Asia']),
    ).toEqual(['Germany', 'United States', 'South Asia']);
    expect(normalizeCountries(['Atlantis', 7, null, {}, ''])).toEqual([]);
    expect(normalizeCountries('Germany')).toEqual([]);
    expect(normalizeCountries(undefined)).toEqual([]);
  });

  it('reads handles as people type them', () => {
    expect(normalizeHandle('@SomeOne')).toBe('someone');
    expect(normalizeHandle(' a_b1 ')).toBe('a_b1');
    for (const bad of ['', '@', 'has space', 'x'.repeat(16), 'a-b', 7, null, '../x'])
      expect(normalizeHandle(bad)).toBeNull();
  });

  it('keeps Always Show entries valid, unique by handle, with an id only when it is numeric', () => {
    expect(
      normalizeAlwaysShow([
        '@Alice',
        { handle: 'alice' },
        { handle: 'Bob', id: '12345' },
        { handle: 'carol', id: 'abc' },
        { handle: 'bad handle' },
        42,
      ]),
    ).toEqual([{ handle: 'alice' }, { handle: 'bob', id: '12345' }, { handle: 'carol' }]);
    const many = Array.from({ length: MAX_ALWAYS_SHOW + 50 }, (_, i) => `user${i}`);
    expect(normalizeAlwaysShow(many)).toHaveLength(MAX_ALWAYS_SHOW);
  });

  it('falls back field by field for a damaged filter or lookup mode', () => {
    const settings = normalizeSettings({
      insights: { lookup: 'always' },
      filter: { countries: 'Germany', mode: 'delete', posts: 'yes', quotes: false, alwaysShow: {} },
    });
    expect(settings.insights.lookup).toBe('hover');
    expect(settings.filter).toEqual({ ...DEFAULT_SETTINGS.filter, quotes: false });
    expect(normalizeSettings({ insights: 5, filter: [] })).toEqual(normalizeSettings({}));
  });

  it('merges a patch field by field and replaces a list given whole', async () => {
    await saveSettings({ filter: { countries: ['Germany', 'France'], mode: 'hide' } });
    const next = await saveSettings({
      filter: { countries: ['Japan'] },
      insights: { lookup: 'visible' },
    });
    expect(next.filter).toMatchObject({ countries: ['Japan'], mode: 'hide' });
    expect(next.insights.lookup).toBe('visible');
    expect((await loadSettings()).filter.countries).toEqual(['Japan']);
  });

  it('does not reset the filter or lookup mode when appearance settings are reset', async () => {
    await saveSettings({
      accent: 'green',
      insights: { lookup: 'manual' },
      filter: { countries: ['Germany'], alwaysShow: [{ handle: 'friend' }] },
    });
    const after = await resetSettings();
    expect(after.accent).toBe(DEFAULT_SETTINGS.accent);
    expect(after.insights.lookup).toBe('manual');
    expect(after.filter.countries).toEqual(['Germany']);
    expect(after.filter.alwaysShow).toEqual([{ handle: 'friend' }]);
  });
});
