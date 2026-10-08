// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from '../lib/settings';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { startFeatures } from './host';
import { createFeatureRegistry } from './registry';
import type { SliderFeature, ToggleFeature } from './types';

const runtime = {} as Runtime;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const styles = () => document.querySelectorAll('style#bx-features');

/** A feature that records what it does, so tests can see activation and cleanup. */
function probe(id: string, extra: Partial<ToggleFeature> = {}) {
  const log: string[] = [];
  const def: ToggleFeature = {
    id,
    category: id.startsWith('feed.') ? 'feed' : 'cleanup',
    title: id,
    description: '',
    kind: 'toggle',
    defaultEnabled: false,
    activate({ scope }) {
      log.push('on');
      scope.add(() => log.push('off'));
    },
    ...extra,
  };
  return { def, log };
}

let scope: Scope;
beforeEach(async () => {
  await freshEnvironment();
  scope = new Scope();
  document.head.innerHTML = '';
});
afterEach(() => {
  scope.dispose();
  vi.restoreAllMocks();
});

describe('feature host', () => {
  it('starts nothing when every feature is off, and leaves no stylesheet', async () => {
    const { def, log } = probe('cleanup.a', { css: '.x{display:none}' });
    const host = startFeatures(scope, runtime, createFeatureRegistry([def]));
    await settle();
    expect(log).toEqual([]);
    expect(host.active()).toEqual([]);
    expect(styles()).toHaveLength(0);
  });

  it('starts features that are on in stored settings, and one that defaults on', async () => {
    const stored = probe('cleanup.stored');
    const dflt = probe('cleanup.dflt', { defaultEnabled: true });
    await saveSettings({ features: { 'cleanup.stored': true } });
    const host = startFeatures(scope, runtime, createFeatureRegistry([stored.def, dflt.def]));
    await settle();
    expect(host.active().sort()).toEqual(['cleanup.dflt', 'cleanup.stored']);
  });

  it('follows settings changes live: on applies, off releases', async () => {
    const { def, log } = probe('cleanup.a', { css: '.hidden-by-a{display:none}' });
    startFeatures(scope, runtime, createFeatureRegistry([def]));
    await settle();
    await saveSettings({ features: { 'cleanup.a': true } });
    expect(log).toEqual(['on']);
    expect(styles()[0]!.textContent).toContain('.hidden-by-a{display:none}');
    await saveSettings({ features: { 'cleanup.a': false } });
    expect(log).toEqual(['on', 'off']);
    expect(styles()).toHaveLength(0);
  });

  it('does not restart a feature when an unrelated setting changes', async () => {
    const { def, log } = probe('cleanup.a');
    startFeatures(scope, runtime, createFeatureRegistry([def]));
    await saveSettings({ features: { 'cleanup.a': true } });
    await saveSettings({ accent: 'green' });
    await saveSettings({ features: { 'cleanup.a': true } });
    expect(log).toEqual(['on']);
  });

  it('repeated toggling pairs every start with a cleanup and never duplicates the stylesheet', async () => {
    const { def, log } = probe('cleanup.a', { css: '.a{display:none}' });
    startFeatures(scope, runtime, createFeatureRegistry([def]));
    await settle();
    for (let i = 0; i < 5; i++) {
      await saveSettings({ features: { 'cleanup.a': true } });
      expect(styles()).toHaveLength(1);
      await saveSettings({ features: { 'cleanup.a': false } });
      expect(styles()).toHaveLength(0);
    }
    expect(log.filter((entry) => entry === 'on')).toHaveLength(5);
    expect(log.filter((entry) => entry === 'off')).toHaveLength(5);
  });

  it('keeps one shared stylesheet for all active features, and only theirs', async () => {
    const a = probe('cleanup.a', { css: '.a{}' });
    const b = probe('feed.b', { css: '.b{}' });
    startFeatures(scope, runtime, createFeatureRegistry([a.def, b.def]));
    await saveSettings({ features: { 'cleanup.a': true, 'feed.b': true } });
    expect(styles()).toHaveLength(1);
    expect(styles()[0]!.textContent).toContain('.a{}');
    expect(styles()[0]!.textContent).toContain('.b{}');
    await saveSettings({ features: { 'cleanup.a': false } });
    expect(styles()[0]!.textContent).not.toContain('.a{}');
    expect(styles()[0]!.textContent).toContain('.b{}');
  });

  it('runs a css-only feature with no activation', async () => {
    const { def } = probe('cleanup.a', { css: '.a{}', activate: undefined });
    const host = startFeatures(scope, runtime, createFeatureRegistry([def]));
    await saveSettings({ features: { 'cleanup.a': true } });
    expect(host.active()).toEqual(['cleanup.a']);
    expect(styles()).toHaveLength(1);
  });

  it('ignores stored toggles for features it does not have', async () => {
    const { def, log } = probe('cleanup.a');
    const host = startFeatures(scope, runtime, createFeatureRegistry([def]));
    await saveSettings({ features: { 'cleanup.unknown': true } });
    expect(host.active()).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe('feature host: failure isolation', () => {
  it('leaves a feature that throws off, releases what it had started, and keeps the others running', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanedUp = vi.fn();
    const broken = probe('cleanup.broken', {
      css: '.broken{}',
      activate({ scope }) {
        scope.add(cleanedUp);
        throw new Error('boom');
      },
    });
    const fine = probe('feed.fine', { css: '.fine{}' });
    const host = startFeatures(scope, runtime, createFeatureRegistry([broken.def, fine.def]));
    await saveSettings({ features: { 'cleanup.broken': true, 'feed.fine': true } });
    expect(host.active()).toEqual(['feed.fine']);
    expect(host.failed()).toEqual(['cleanup.broken']);
    expect(cleanedUp).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    // The broken feature's stylesheet is not applied; the working one's is.
    expect(styles()[0]!.textContent).toContain('.fine{}');
    expect(styles()[0]!.textContent).not.toContain('.broken{}');
    // Unrelated settings changes do not retry it in a loop.
    await saveSettings({ accent: 'green' });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('tries a failed feature again after it is switched off and on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const flaky = probe('cleanup.flaky', {
      activate() {
        if (++attempts === 1) throw new Error('first time');
      },
    });
    const host = startFeatures(scope, runtime, createFeatureRegistry([flaky.def]));
    await saveSettings({ features: { 'cleanup.flaky': true } });
    expect(host.failed()).toEqual(['cleanup.flaky']);
    await saveSettings({ features: { 'cleanup.flaky': false } });
    expect(host.failed()).toEqual([]);
    await saveSettings({ features: { 'cleanup.flaky': true } });
    expect(host.active()).toEqual(['cleanup.flaky']);
    expect(attempts).toBe(2);
  });
});

describe('feature host: lifetime', () => {
  it('releases every running feature and the stylesheet when the script is taken down', async () => {
    const a = probe('cleanup.a', { css: '.a{}' });
    const b = probe('feed.b');
    startFeatures(scope, runtime, createFeatureRegistry([a.def, b.def]));
    await saveSettings({ features: { 'cleanup.a': true, 'feed.b': true } });
    scope.dispose();
    expect(a.log).toEqual(['on', 'off']);
    expect(b.log).toEqual(['on', 'off']);
    expect(styles()).toHaveLength(0);
  });

  it('ignores settings that arrive after it was taken down', async () => {
    const { def, log } = probe('cleanup.a');
    startFeatures(scope, runtime, createFeatureRegistry([def]));
    await settle();
    scope.dispose();
    await saveSettings({ features: { 'cleanup.a': true } });
    expect(log).toEqual([]);
  });
});

describe('feature host: sliders', () => {
  const width = (): SliderFeature => ({
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
    css: (value) => `.col{max-width:${value}px}`,
  });
  const css = () => styles()[0]?.textContent ?? '';

  it('writes the default number when switched on, and nothing while off', async () => {
    startFeatures(scope, runtime, createFeatureRegistry([width()]));
    await settle();
    expect(styles()).toHaveLength(0);
    await saveSettings({ features: { 'appearance.width': true } });
    expect(css()).toContain('max-width:700px');
  });

  it('restyles live as the number changes, in the same single stylesheet', async () => {
    startFeatures(scope, runtime, createFeatureRegistry([width()]));
    await saveSettings({ features: { 'appearance.width': true } });
    await saveSettings({ values: { 'appearance.width': 820 } });
    expect(styles()).toHaveLength(1);
    expect(css()).toContain('max-width:820px');
    expect(css()).not.toContain('700px');
  });

  it('does not restart the feature when only its number changes', async () => {
    const log: string[] = [];
    const def: SliderFeature = {
      ...width(),
      activate({ scope: own }) {
        log.push('on');
        own.add(() => log.push('off'));
      },
    };
    startFeatures(scope, runtime, createFeatureRegistry([def]));
    await saveSettings({ features: { 'appearance.width': true } });
    await saveSettings({ values: { 'appearance.width': 900 } });
    await saveSettings({ values: { 'appearance.width': 510 } });
    expect(log).toEqual(['on']);
  });

  it('keeps a stored number while off and uses it when switched back on', async () => {
    startFeatures(scope, runtime, createFeatureRegistry([width()]));
    await saveSettings({ values: { 'appearance.width': 880 } });
    expect(styles()).toHaveLength(0);
    await saveSettings({ features: { 'appearance.width': true } });
    expect(css()).toContain('880px');
    await saveSettings({ features: { 'appearance.width': false } });
    expect(styles()).toHaveLength(0);
  });

  it('never lets an invalid stored number reach the page', async () => {
    startFeatures(scope, runtime, createFeatureRegistry([width()]));
    await saveSettings({ features: { 'appearance.width': true } });
    for (const [stored, shown] of [
      [99999, '1000px'],
      [-5, '500px'],
      [655, '660px'],
    ] as const) {
      await saveSettings({ values: { 'appearance.width': stored } });
      expect(css()).toContain(`max-width:${shown}`);
    }
    // A hand-edited non-number is dropped by settings validation, so the default applies.
    await chrome.storage.local.set({
      'bx.settings': {
        features: { 'appearance.width': true },
        values: { 'appearance.width': 'wide' },
      },
    });
    await settle();
    expect(css()).toContain('max-width:700px');
  });
});
