import { describe, expect, it } from 'vitest';
import { applyPatch, DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings';
import { FEATURES, featureRegistry } from './index';
import { PRESETS, presetPatch, resetPatch, restorePatch } from './presets';

describe('quick setups', () => {
  it('are declarative: Clean, Minimal and Focus, each with a title and a description', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(['clean', 'minimal', 'focus']);
    for (const preset of PRESETS) {
      expect(preset.title.length).toBeGreaterThan(3);
      expect(preset.description.length).toBeGreaterThan(20);
    }
  });

  it('name only features that exist, once each', () => {
    const ids = new Set(FEATURES.map((feature) => feature.id));
    for (const preset of PRESETS) {
      expect(new Set(preset.features).size, preset.id).toBe(preset.features.length);
      for (const id of preset.features) expect(ids.has(id), `${preset.id}: ${id}`).toBe(true);
      for (const id of Object.keys(preset.values ?? {}))
        expect(featureRegistry.get(id)?.kind, `${preset.id}: ${id}`).toBe('slider');
    }
  });

  it('are distinct and nested the way their descriptions say', () => {
    const [clean, minimal, focus] = PRESETS.map((preset) => new Set(preset.features));
    expect(clean!.size).toBeGreaterThan(5);
    for (const id of clean!) expect(minimal!.has(id)).toBe(true);
    expect(minimal!.size).toBeGreaterThan(clean!.size);
    expect(focus!.has('feed.hideForYou')).toBe(true);
    expect(focus!.has('sidebar.hideSidebar')).toBe(true);
    expect(minimal!.has('sidebar.hideSidebar')).toBe(false);
  });

  it('never include a numeric default that would hide the page behind a slider', () => {
    for (const preset of PRESETS)
      for (const [id, value] of Object.entries(preset.values ?? {})) {
        const def = featureRegistry.get(id);
        expect(def?.kind === 'slider' && value >= def.min && value <= def.max).toBe(true);
      }
  });

  it('apply as a replacement: the preset on, everything else forgotten', () => {
    const before = normalizeSettings({
      features: { 'posts.plainText': true, 'cleanup.hideAds': false },
      values: { 'appearance.sidebarWidth': 300 },
    });
    for (const preset of PRESETS) {
      const after = applyPatch(before, presetPatch(preset, featureRegistry));
      expect(Object.keys(after.features).sort()).toEqual([...preset.features].sort());
      expect(Object.values(after.features).every((value) => value === true)).toBe(true);
      expect(after.values).toEqual({});
    }
  });

  it('leave Saved, downloads and the panel’s own preferences alone', () => {
    const before = normalizeSettings({
      theme: 'dark',
      accent: 'pink',
      downloadsEnabled: false,
      afterSave: 'quiet',
      saveAs: true,
      menuActions: { download: false, openLibrary: false },
    });
    for (const preset of PRESETS) {
      const patch = presetPatch(preset, featureRegistry);
      expect(Object.keys(patch).sort()).toEqual(['features', 'values']);
      const after = applyPatch(before, patch);
      const { features: _f, values: _v, ...rest } = after;
      const { features: _f2, values: _v2, ...expected } = before;
      expect(rest).toEqual(expected);
    }
  });

  it('are fully undone by restoring what was there, whatever it was', () => {
    const before = normalizeSettings({
      features: { 'posts.plainText': true, 'cleanup.hideAds': false, 'sidebar.hideFooter': true },
      values: { 'appearance.sidebarWidth': 300, 'appearance.navSpacing': 2 },
    });
    for (const preset of PRESETS) {
      const applied = applyPatch(before, presetPatch(preset, featureRegistry));
      const restored = applyPatch(applied, restorePatch(before, featureRegistry));
      expect(restored.features).toEqual(before.features);
      expect(restored.values).toEqual(before.values);
    }
  });

  it('can be re-applied without piling up', () => {
    const preset = PRESETS[1]!;
    const once = applyPatch(DEFAULT_SETTINGS, presetPatch(preset, featureRegistry));
    const twice = applyPatch(once, presetPatch(preset, featureRegistry));
    expect(twice).toEqual(once);
  });
});

describe('reset patches', () => {
  it('forget only the given features, or all of them', () => {
    const before = normalizeSettings({
      features: { 'posts.plainText': true, 'sidebar.hideFooter': true },
      values: { 'appearance.sidebarWidth': 300 },
    });
    const some = applyPatch(before, resetPatch(featureRegistry, ['sidebar.hideFooter']));
    expect(some.features).toEqual({ 'posts.plainText': true });
    expect(some.values).toEqual({ 'appearance.sidebarWidth': 300 });
    const all = applyPatch(before, resetPatch(featureRegistry));
    expect(all.features).toEqual({});
    expect(all.values).toEqual({});
  });
});
