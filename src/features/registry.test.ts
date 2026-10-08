import { describe, expect, it } from 'vitest';
import { createFeatureRegistry, resolveSliderValue } from './registry';
import type { SliderFeature, ToggleFeature } from './types';

const feature = (id: string, extra: Partial<ToggleFeature> = {}): ToggleFeature => ({
  id,
  category: id.startsWith('feed.') ? 'feed' : 'cleanup',
  title: id,
  description: '',
  kind: 'toggle',
  defaultEnabled: false,
  ...extra,
});

describe('feature registry', () => {
  it('lists features in the order given and finds them by id', () => {
    const a = feature('cleanup.a');
    const b = feature('feed.b');
    const registry = createFeatureRegistry([a, b]);
    expect(registry.list()).toEqual([a, b]);
    expect(registry.get('feed.b')).toBe(b);
    expect(registry.get('feed.nope')).toBeUndefined();
  });

  it('refuses a duplicate id, a malformed id, and an id outside its category', () => {
    expect(() => createFeatureRegistry([feature('cleanup.a'), feature('cleanup.a')])).toThrow(
      /twice/,
    );
    expect(() => createFeatureRegistry([feature('hideAds')])).toThrow(/Invalid feature id/);
    expect(() => createFeatureRegistry([feature('cleanup.a', { category: 'feed' })])).toThrow(
      /not in category/,
    );
  });

  it('resolves each toggle to the stored value, or the default when missing or invalid', () => {
    const registry = createFeatureRegistry([
      feature('cleanup.off'),
      feature('cleanup.on', { defaultEnabled: true }),
      feature('feed.stored'),
    ]);
    expect(registry.enabled(undefined)).toEqual({
      'cleanup.off': false,
      'cleanup.on': true,
      'feed.stored': false,
    });
    expect(
      registry.enabled({
        'cleanup.off': true,
        'cleanup.on': 'no' as unknown as boolean,
        'feed.stored': true,
        'feed.unknown': true,
      }),
    ).toEqual({ 'cleanup.off': true, 'cleanup.on': true, 'feed.stored': true });
  });
});

const slider = (extra: Partial<SliderFeature> = {}): SliderFeature => ({
  id: 'appearance.width',
  category: 'appearance',
  title: 'Width',
  description: '',
  kind: 'slider',
  defaultEnabled: false,
  min: 500,
  max: 1000,
  step: 10,
  defaultValue: 700,
  unit: 'px',
  css: (value) => `.x{max-width:${value}px}`,
  ...extra,
});

describe('slider features', () => {
  it('use a valid stored number, and the default when it is missing or not a number', () => {
    const def = slider();
    expect(resolveSliderValue(def, 640)).toBe(640);
    expect(resolveSliderValue(def, undefined)).toBe(700);
    expect(resolveSliderValue(def, '640')).toBe(700);
    expect(resolveSliderValue(def, Number.NaN)).toBe(700);
    expect(resolveSliderValue(def, Number.POSITIVE_INFINITY)).toBe(700);
    expect(resolveSliderValue(def, null)).toBe(700);
  });

  it('clamp an out-of-range number to the nearest end', () => {
    const def = slider();
    expect(resolveSliderValue(def, 10)).toBe(500);
    expect(resolveSliderValue(def, 5000)).toBe(1000);
    expect(resolveSliderValue(def, -1e9)).toBe(500);
  });

  it('snap an off-step number to the nearest step, never past the maximum', () => {
    const def = slider();
    expect(resolveSliderValue(def, 644)).toBe(640);
    expect(resolveSliderValue(def, 646)).toBe(650);
    expect(resolveSliderValue(def, 999)).toBe(1000);
    const odd = slider({ min: 0, max: 12, step: 4, defaultValue: 4 });
    expect(resolveSliderValue(odd, 11)).toBe(12);
  });

  it('keep fractional steps exact', () => {
    const def = slider({ min: 0, max: 1, step: 0.1, defaultValue: 0.5 });
    expect(resolveSliderValue(def, 0.3)).toBe(0.3);
    expect(resolveSliderValue(def, 0.7000000001)).toBe(0.7);
  });

  it('are resolved per slider by the registry, and toggles have no value', () => {
    const registry = createFeatureRegistry([
      slider(),
      slider({ id: 'appearance.other', min: 0, max: 12, step: 1, defaultValue: 6 }),
      feature('cleanup.t'),
    ]);
    expect(registry.values(undefined)).toEqual({ 'appearance.width': 700, 'appearance.other': 6 });
    expect(
      registry.values({ 'appearance.width': 123456, 'appearance.other': 3, 'cleanup.t': 9 }),
    ).toEqual({ 'appearance.width': 1000, 'appearance.other': 3 });
  });

  it('refuse a malformed range at startup', () => {
    expect(() => createFeatureRegistry([slider({ min: 10, max: 10 })])).toThrow(/min below max/);
    expect(() => createFeatureRegistry([slider({ step: 0 })])).toThrow(/positive step/);
    expect(() => createFeatureRegistry([slider({ max: 995 })])).toThrow(/whole number of steps/);
    expect(() => createFeatureRegistry([slider({ defaultValue: 705 })])).toThrow(/default/);
    expect(() => createFeatureRegistry([slider({ defaultValue: 1500 })])).toThrow(/default/);
  });
});
