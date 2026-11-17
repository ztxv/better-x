import type { Runtime } from '../runtime';
import type { Scope } from '../runtime/scope';
import { loadPluginState, pluginEnabled, watchPluginState, type PluginState } from './state';

/** What a plugin is given when it turns on. */
export interface PluginContext {
  /** Lives until the plugin is switched off (or the content script ends): owns all its cleanup. */
  scope: Scope;
  runtime: Runtime;
  /** Opens Better X's own panel, however the person has it set to open. */
  openPanel: () => void;
}

/** The part of a plugin that runs on X. `start` registers everything it creates on `scope`. */
export interface ContentPlugin {
  id: string;
  start(context: PluginContext): void;
}

/**
 * Runs the plugins that are switched on and keeps them in step with `bx.plugins`, live, in every
 * X tab. Each running plugin has its own child scope: switching it off disposes exactly that
 * scope (its UI, listeners, timers and observers), and a plugin that throws while starting is
 * released the same way and stays off until it is toggled again, without reaching the others.
 */
export function startPlugins(
  scope: Scope,
  runtime: Runtime,
  plugins: readonly ContentPlugin[],
  openPanel: () => void,
): void {
  const running = new Map<string, Scope>();
  const failed = new Set<string>();
  scope.add(() => running.clear());

  const apply = (state: PluginState) => {
    if (scope.disposed) return;
    for (const plugin of plugins) {
      const on = pluginEnabled(state, plugin.id);
      const current = running.get(plugin.id);
      if (!on) {
        failed.delete(plugin.id);
        if (current) {
          running.delete(plugin.id);
          current.dispose();
        }
        continue;
      }
      if (current || failed.has(plugin.id)) continue;
      const own = scope.child();
      try {
        plugin.start({ scope: own, runtime, openPanel });
        running.set(plugin.id, own);
      } catch (error) {
        own.dispose();
        failed.add(plugin.id);
        console.error(`[Better X] plugin ${plugin.id} could not start`, error);
      }
    }
  };

  scope.add(watchPluginState(apply));
  void loadPluginState().then(apply);
}
