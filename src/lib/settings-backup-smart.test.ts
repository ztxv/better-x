import { describe, expect, it } from 'vitest';
import { featureRegistry } from '../features';
import {
  createSettingsBackup,
  importPatch,
  parseSettingsBackup,
  SETTINGS_BACKUP_FORMAT,
  type ValidatedBackup,
} from './settings-backup';
import { applyPatch, DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings';

const NOW = new Date('2026-10-09T08:00:00.000Z');
const file = (data: Record<string, unknown>, version = 2) =>
  JSON.stringify({
    format: SETTINGS_BACKUP_FORMAT,
    version,
    exportedAt: NOW.toISOString(),
    features: {},
    values: {},
    appearance: {},
    ...data,
  });
const parse = (text: string, current: Settings = DEFAULT_SETTINGS) => {
  const result = parseSettingsBackup(text, featureRegistry, current);
  if (!result.ok) throw new Error(result.error);
  return result;
};
const apply = (current: Settings, backup: ValidatedBackup, mode: 'merge' | 'replace') =>
  applyPatch(current, importPatch(backup, mode, featureRegistry, current));

const mine = normalizeSettings({
  insights: { lookup: 'visible' },
  filter: {
    countries: ['Germany'],
    mode: 'hide',
    posts: false,
    quotes: true,
    alwaysShow: [{ handle: 'keepme', id: '5' }],
  },
  features: { 'filtering.country': true },
});

describe('settings backup v2: account insights and the country filter', () => {
  it('exports the lookup mode and the whole filter setup, and nothing private', () => {
    const backup = createSettingsBackup(mine, featureRegistry, NOW);
    expect(backup.version).toBe(2);
    expect(backup.insights).toEqual({ lookup: 'visible' });
    expect(backup.filter).toEqual(mine.filter);
    expect(backup.features['filtering.country']).toBe(true);
    const text = JSON.stringify(backup);
    expect(text).not.toMatch(/cookie|csrf|token|authorization|bearer|bx\.accounts|basedIn/i);
  });

  it('round-trips through a replace import into a fresh install', () => {
    const text = JSON.stringify(createSettingsBackup(mine, featureRegistry, NOW));
    const { backup } = parse(text);
    const after = apply(DEFAULT_SETTINGS, backup, 'replace');
    expect(after.insights).toEqual(mine.insights);
    expect(after.filter).toEqual(mine.filter);
    expect(after.features['filtering.country']).toBe(true);
  });

  it('merges lists by adding to what is already there, and sets the scalars', () => {
    const { backup } = parse(
      file({
        insights: { lookup: 'manual' },
        filter: {
          countries: ['France', 'Germany'],
          mode: 'collapse',
          alwaysShow: ['@Other', { handle: 'keepme' }],
        },
      }),
      mine,
    );
    const after = apply(mine, backup, 'merge');
    expect(after.filter.countries).toEqual(['Germany', 'France']);
    expect(after.filter.mode).toBe('collapse');
    // Not named by the file: left as it was.
    expect(after.filter.posts).toBe(false);
    expect(after.filter.quotes).toBe(true);
    expect(after.filter.alwaysShow.map((e) => e.handle)).toEqual(['keepme', 'other']);
    // The id already known for keepme is not lost by the file naming the handle without one.
    expect(after.filter.alwaysShow[0]).toEqual({ handle: 'keepme', id: '5' });
    expect(after.insights.lookup).toBe('manual');
  });

  it('replaces: lists become the file’s, and what the file leaves out returns to its default', () => {
    const { backup } = parse(file({ filter: { countries: ['Japan'] } }), mine);
    const after = apply(mine, backup, 'replace');
    expect(after.filter).toEqual({ ...DEFAULT_SETTINGS.filter, countries: ['Japan'] });
    expect(after.insights).toEqual(DEFAULT_SETTINGS.insights);
    expect(after.features['filtering.country']).toBeUndefined();
  });

  it('counts the smart changes in the preview', () => {
    const { preview } = parse(
      file({ insights: { lookup: 'manual' }, filter: { countries: ['France'], mode: 'collapse' } }),
      mine,
    );
    // merge: lookup, mode, +France; replace additionally drops Germany, posts, the always-show entry.
    expect(preview.mergeChanges).toBe(3);
    expect(preview.replaceChanges).toBeGreaterThan(preview.mergeChanges);
  });

  it('judges each smart entry on its own and skips the bad ones', () => {
    const result = parse(
      file({
        insights: { lookup: 'always' },
        filter: {
          countries: ['Germany', 'Atlantis', 5, 'South Asia'],
          mode: 'delete',
          posts: 'yes',
          quotes: false,
          alwaysShow: [
            '@fine',
            '@bad handle',
            { handle: 'idbad', id: 'xyz' },
            { handle: 'idgood', id: '9' },
          ],
        },
      }),
    );
    expect(result.backup.insights).toEqual({});
    expect(result.backup.filter).toEqual({
      countries: ['Germany', 'South Asia'],
      quotes: false,
      alwaysShow: [{ handle: 'fine' }, { handle: 'idgood', id: '9' }],
    });
    // invalid: lookup, Atlantis, 5, mode, posts, '@bad handle', idbad.
    expect(result.preview.invalid).toBe(7);
    expect(result.preview.recognized).toBe(result.preview.found - 7);
  });

  it('refuses a smart section that is not an object', () => {
    for (const bad of [{ filter: [] }, { filter: 'x' }, { insights: 5 }]) {
      const result = parseSettingsBackup(file(bad), featureRegistry, DEFAULT_SETTINGS);
      expect(result.ok).toBe(false);
    }
  });

  it('caps the lists, not trusting a file to be reasonable', () => {
    const many = Array.from({ length: 400 }, (_, i) => `user${i}`);
    const { backup } = parse(file({ filter: { alwaysShow: many } }));
    expect(backup.filter.alwaysShow!.length).toBe(200);
  });
});

describe('upgrading from existing Better X settings backups (version 1)', () => {
  const v1 = file(
    {
      features: { 'cleanup.hideAds': true, 'sidebar.hideFooter': true },
      values: { 'appearance.timelineWidth': 800 },
      appearance: { theme: 'dark', accent: 'pink' },
    },
    1,
  );

  it('still imports, applying everything it names', () => {
    const { backup, preview } = parse(v1);
    expect(backup.smart).toBe(false);
    expect(preview.invalid).toBe(0);
    const after = apply(DEFAULT_SETTINGS, backup, 'merge');
    expect(after.features['cleanup.hideAds']).toBe(true);
    expect(after.values['appearance.timelineWidth']).toBe(800);
    expect(after.theme).toBe('dark');
    expect(after.accent).toBe('pink');
  });

  it('leaves the filter and lookup mode alone even on Replace: it could not name them', () => {
    const { backup } = parse(v1, mine);
    const after = apply(mine, backup, 'replace');
    expect(after.filter).toEqual(mine.filter);
    expect(after.insights).toEqual(mine.insights);
    // Everything it does govern is replaced as before.
    expect(after.features['filtering.country']).toBeUndefined();
    expect(after.features['cleanup.hideAds']).toBe(true);
  });

  it('keeps all earlier customization settings when a v2 file is merged in', () => {
    const before = normalizeSettings({
      features: { 'cleanup.hideAds': true, 'cleanup.hideGrok': true },
    });
    const { backup } = parse(file({ filter: { countries: ['Japan'] } }), before);
    const after = apply(before, backup, 'merge');
    expect(after.features).toEqual(before.features);
  });
});
