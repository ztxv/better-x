import { describe, expect, it } from 'vitest';
import { createFeatureRegistry } from './registry';
import type { FeatureDef } from './types';

const feature = (id: string, extra: Partial<FeatureDef> = {}): FeatureDef => ({
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
