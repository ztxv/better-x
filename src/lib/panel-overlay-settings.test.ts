import { beforeEach, describe, expect, it } from 'vitest';
import { featureRegistry } from '../features';
import { freshEnvironment } from '../test/fakes';
import {
  clampOverlayWidth,
  DEFAULT_OVERLAY,
  loadOverlay,
  normalizeOverlay,
  OVERLAY_KEY,
  OVERLAY_WIDTH,
  saveOverlay,
  watchOverlay,
} from './overlay-state';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  resetSettings,
  saveSettings,
  SETTINGS_VERSION,
} from './settings';
import {
  createSettingsBackup,
  importPatch,
  parseSettingsBackup,
  SETTINGS_BACKUP_FORMAT,
  SETTINGS_BACKUP_VERSION,
} from './settings-backup';

beforeEach(async () => {
  await freshEnvironment();
});

describe('settings: version 7 panel mode', () => {
  it('defaults to the native side panel, with no edge tab, so nothing changes for anyone', () => {
    expect(SETTINGS_VERSION).toBe(7);
    expect(DEFAULT_SETTINGS.panelMode).toBe('native');
    expect(DEFAULT_SETTINGS.panelHandle).toBe(false);
  });

  it('loads a stored version 6 object unchanged, in native mode', async () => {
    const { data } = await freshEnvironment();
    const v6 = {
      version: 6,
      theme: 'dark',
      openAs: 'sidepanel',
      features: { 'cleanup.hideAds': true },
    };
    data['bx.settings'] = v6;
    const loaded = await loadSettings();
    expect(loaded).toMatchObject({ ...v6, version: 7, panelMode: 'native', panelHandle: false });
  });

  it('keeps only the two known modes and a real boolean', () => {
    expect(normalizeSettings({ panelMode: 'overlay' }).panelMode).toBe('overlay');
    for (const bad of ['Overlay', 'popup', '', 1, null, {}, ['overlay']])
      expect(normalizeSettings({ panelMode: bad }).panelMode).toBe('native');
    expect(normalizeSettings({ panelHandle: true }).panelHandle).toBe(true);
    expect(normalizeSettings({ panelHandle: 'true' }).panelHandle).toBe(false);
  });

  it('is saved and kept by reset, like the toolbar mode', async () => {
    await saveSettings({ panelMode: 'overlay', panelHandle: true, accent: 'pink' });
    const after = await resetSettings();
    expect(after.accent).toBe(DEFAULT_SETTINGS.accent);
    expect(after.panelMode).toBe('overlay');
    expect(after.panelHandle).toBe(true);
  });
});

describe('settings backup and the panel mode', () => {
  it('never carries the panel mode, a per-device preference like the toolbar mode', () => {
    const settings = normalizeSettings({ panelMode: 'overlay', panelHandle: true });
    const text = JSON.stringify(createSettingsBackup(settings, featureRegistry));
    expect(text).not.toContain('panelMode');
    expect(text).not.toContain('panelHandle');
    expect(text).not.toContain(OVERLAY_KEY);
    expect(SETTINGS_BACKUP_VERSION).toBe(3);
  });

  it('leaves the panel mode alone on import, from this version or an older one', () => {
    const current = normalizeSettings({ panelMode: 'overlay', panelHandle: true });
    for (const version of [1, 2, 3]) {
      const parsed = parseSettingsBackup(
        JSON.stringify({
          format: SETTINGS_BACKUP_FORMAT,
          version,
          exportedAt: new Date().toISOString(),
          features: {},
          values: {},
          // A hand-edited file cannot sneak it in either.
          panelMode: 'native',
        }),
        featureRegistry,
        current,
      );
      if (!parsed.ok) throw new Error(parsed.error);
      for (const mode of ['merge', 'replace'] as const) {
        const patch = importPatch(parsed.backup, mode, featureRegistry, current);
        expect(patch).not.toHaveProperty('panelMode');
        expect(patch).not.toHaveProperty('panelHandle');
      }
    }
  });

  it('round-trips a backup made in overlay mode without touching the mode', () => {
    const overlay = normalizeSettings({
      panelMode: 'overlay',
      features: { 'cleanup.hideAds': true },
    });
    const text = JSON.stringify(createSettingsBackup(overlay, featureRegistry));
    const native = normalizeSettings({});
    const parsed = parseSettingsBackup(text, featureRegistry, native);
    if (!parsed.ok) throw new Error(parsed.error);
    const patch = importPatch(parsed.backup, 'replace', featureRegistry, native);
    expect(patch.features).toMatchObject({ 'cleanup.hideAds': true });
    expect(patch).not.toHaveProperty('panelMode');
  });
});

describe('overlay state', () => {
  it('clamps the width to 320-560 whole pixels, and anything unusable is 400', () => {
    expect(OVERLAY_WIDTH).toEqual({ min: 320, max: 560, default: 400 });
    expect(clampOverlayWidth(100)).toBe(320);
    expect(clampOverlayWidth(9999)).toBe(560);
    expect(clampOverlayWidth(433.6)).toBe(434);
    expect(clampOverlayWidth(-Infinity)).toBe(400);
    for (const bad of [NaN, Infinity, '450', null, undefined, {}])
      expect(clampOverlayWidth(bad)).toBe(400);
  });

  it('is closed at 400 px until something is stored, and repairs what is stored', async () => {
    expect(await loadOverlay()).toEqual(DEFAULT_OVERLAY);
    expect(DEFAULT_OVERLAY).toEqual({ open: false, width: 400 });
    expect(normalizeOverlay({ open: 'yes', width: 2000 })).toEqual({ open: false, width: 560 });
    expect(normalizeOverlay('junk')).toEqual(DEFAULT_OVERLAY);
  });

  it('merges writes in order, so a toggle and a resize do not lose each other', async () => {
    const seen: unknown[] = [];
    const stop = watchOverlay((state) => seen.push(state));
    await Promise.all([saveOverlay({ open: true }), saveOverlay({ width: 480 })]);
    expect(await loadOverlay()).toEqual({ open: true, width: 480 });
    stop();
    await saveOverlay({ open: false });
    expect(seen).toEqual([
      { open: true, width: 400 },
      { open: true, width: 480 },
    ]);
  });

  it('lives under its own key, not in settings', async () => {
    const { data } = await freshEnvironment();
    await saveOverlay({ open: true });
    expect(Object.keys(data)).toEqual([OVERLAY_KEY]);
  });
});
