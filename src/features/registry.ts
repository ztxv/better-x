import type { FeatureDef } from './types';

const ID = /^[a-z][A-Za-z0-9]{0,31}\.[a-z][A-Za-z0-9]{0,47}$/;

export interface FeatureRegistry {
  list(): readonly FeatureDef[];
  get(id: string): FeatureDef | undefined;
  /** Every feature's toggle: the stored value when valid, else the feature's default. */
  enabled(stored: Record<string, boolean> | undefined): Record<string, boolean>;
}

/** Builds a registry, refusing malformed or duplicate ids so a mistake fails loudly at startup. */
export function createFeatureRegistry(defs: readonly FeatureDef[]): FeatureRegistry {
  const byId = new Map<string, FeatureDef>();
  for (const def of defs) {
    if (!ID.test(def.id)) throw new Error(`Invalid feature id "${def.id}"`);
    if (!def.id.startsWith(`${def.category}.`))
      throw new Error(`Feature "${def.id}" is not in category "${def.category}"`);
    if (byId.has(def.id)) throw new Error(`Feature "${def.id}" is registered twice`);
    byId.set(def.id, def);
  }
  return {
    list: () => defs,
    get: (id) => byId.get(id),
    enabled(stored) {
      const result: Record<string, boolean> = {};
      for (const def of defs) {
        const value = stored?.[def.id];
        result[def.id] = typeof value === 'boolean' ? value : def.defaultEnabled;
      }
      return result;
    },
  };
}
