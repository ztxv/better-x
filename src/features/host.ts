import { loadSettings, watchSettings, type Settings } from '../lib/settings';
import type { Runtime } from '../runtime';
import type { Scope } from '../runtime/scope';
import type { FeatureRegistry } from './registry';

export interface FeatureHost {
  /** Ids of features that are on and running. */
  active(): string[];
  /** Ids of features that were switched on but threw while starting; off until switched off and on again. */
  failed(): string[];
}

const STYLE_ID = 'bx-features';

/**
 * Turns the registry's features on and off to match the stored settings, now and whenever any
 * context changes them (so open X tabs follow the side panel without a reload).
 *
 * Each running feature has its own child scope, so deactivation and failure release exactly that
 * feature's work. A feature that throws while starting is disposed and left off; it never
 * reaches Saved or the other features. All feature CSS lives in one `<style id="bx-features">`.
 */
export function startFeatures(
  scope: Scope,
  runtime: Runtime,
  registry: FeatureRegistry,
): FeatureHost {
  const running = new Map<string, Scope>();
  const failed = new Set<string>();
  const style = document.createElement('style');
  style.id = STYLE_ID;

  function renderStyle() {
    const css = registry
      .list()
      .filter((def) => def.css && running.has(def.id))
      .map((def) => `/* ${def.id} */\n${def.css}`)
      .join('\n');
    if (!css) return style.remove();
    style.textContent = css;
    if (!style.isConnected) (document.head ?? document.documentElement).append(style);
  }

  function start(id: string) {
    const def = registry.get(id)!;
    const own = scope.child();
    try {
      def.activate?.({ scope: own, runtime });
      running.set(id, own);
    } catch (error) {
      own.dispose();
      failed.add(id);
      console.error(`[Better X] feature ${id} failed to start`, error);
    }
  }

  function apply(settings: Settings) {
    if (scope.disposed) return;
    const want = registry.enabled(settings.features);
    for (const def of registry.list()) {
      const on = want[def.id]!;
      if (!on) failed.delete(def.id);
      if (on && !running.has(def.id) && !failed.has(def.id)) start(def.id);
      else if (!on && running.has(def.id)) {
        running.get(def.id)!.dispose();
        running.delete(def.id);
      }
    }
    renderStyle();
  }

  void loadSettings().then(apply);
  scope.add(watchSettings(apply));
  scope.add(() => {
    running.clear();
    style.remove();
  });

  return { active: () => [...running.keys()], failed: () => [...failed] };
}
