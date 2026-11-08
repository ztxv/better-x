import type { FeatureDef, SliderFeature, ValueFeature } from './types';

const ID = /^[a-z][A-Za-z0-9]{0,31}\.[a-z][A-Za-z0-9]{0,47}$/;

export interface FeatureRegistry {
  list(): readonly FeatureDef[];
  get(id: string): FeatureDef | undefined;
  /** Every feature's toggle: the stored value when valid, else the feature's default. */
  enabled(stored: Record<string, boolean> | undefined): Record<string, boolean>;
  /** Every slider's number and color, validated, else the default. */
  values(stored: Record<string, number> | undefined): Record<string, number>;
}

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;
const onGrid = (def: SliderFeature, value: number) => {
  const steps = (value - def.min) / def.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};

/**
 * The number a slider should use for a stored value: the default when the stored one is missing
 * or not a finite number; otherwise the stored one clamped into the range and snapped to the
 * nearest step. A value from another build, or edited by hand, can never push the page outside
 * what the slider offers.
 */
export function resolveSliderValue(def: SliderFeature, stored: unknown): number {
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return def.defaultValue;
  const clamped = Math.min(def.max, Math.max(def.min, stored));
  const snapped = def.min + Math.round((clamped - def.min) / def.step) * def.step;
  return Number(Math.min(def.max, snapped).toFixed(decimals(def.step)));
}

/** Whether `value` is a whole number a color can be stored as (0xRRGGBB). */
export const isColorNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;

/** The stored number a slider or color should use: validated, else the feature's default. */
export function resolveValue(def: ValueFeature, stored: unknown): number {
  if (def.kind === 'slider') return resolveSliderValue(def, stored);
  return isColorNumber(stored) ? stored : def.defaultValue;
}

function checkSlider(def: SliderFeature) {
  const where = `Slider "${def.id}"`;
  if (!(def.min < def.max)) throw new Error(`${where} needs min below max`);
  if (!(def.step > 0)) throw new Error(`${where} needs a positive step`);
  if (!onGrid(def, def.max))
    throw new Error(`${where} max is not a whole number of steps from min`);
  if (def.defaultValue < def.min || def.defaultValue > def.max || !onGrid(def, def.defaultValue))
    throw new Error(`${where} default is outside its range or off its step`);
}

/** Builds a registry, refusing malformed or duplicate ids so a mistake fails loudly at startup. */
export function createFeatureRegistry(defs: readonly FeatureDef[]): FeatureRegistry {
  const byId = new Map<string, FeatureDef>();
  for (const def of defs) {
    if (!ID.test(def.id)) throw new Error(`Invalid feature id "${def.id}"`);
    if (!def.id.startsWith(`${def.category}.`))
      throw new Error(`Feature "${def.id}" is not in category "${def.category}"`);
    if (byId.has(def.id)) throw new Error(`Feature "${def.id}" is registered twice`);
    if (def.kind === 'slider') checkSlider(def);
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
    values(stored) {
      const result: Record<string, number> = {};
      for (const def of defs)
        if (def.kind !== 'toggle') result[def.id] = resolveValue(def, stored?.[def.id]);
      return result;
    },
  };
}
