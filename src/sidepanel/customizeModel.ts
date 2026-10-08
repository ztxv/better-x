import type { FeatureRegistry } from '../features/registry';
import type { FeatureDef } from '../features/types';
import type { Settings } from '../lib/settings';

/**
 * The words a search looks at: title, description and extra keywords. The category's name is
 * left out on purpose: the chips below the search choose a category, and a category named
 * “Ads, Grok & Premium” would otherwise match every one of its members for “ads”.
 */
function haystack(def: FeatureDef): string {
  return [def.title, def.description, ...(def.keywords ?? [])].join(' ').toLowerCase();
}

/** Splits a query into lowercase words, ignoring the typographic apostrophe so “what’s” matches. */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().replace(/[’']/g, '').split(/\s+/).filter(Boolean);
}

/** True when every word of the query appears somewhere in the feature's text. */
export function matchesQuery(def: FeatureDef, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const text = haystack(def).replace(/[’']/g, '');
  return terms.every((term) => text.includes(term));
}

export interface FeatureState {
  enabled: boolean;
  /** The slider's number (validated), or null for a toggle. */
  value: number | null;
  /** True when it differs from what a fresh install has. */
  changed: boolean;
}

export function featureState(
  def: FeatureDef,
  settings: Pick<Settings, 'features' | 'values'>,
  registry: FeatureRegistry,
): FeatureState {
  const enabled = registry.enabled(settings.features)[def.id]!;
  const value = def.kind === 'slider' ? registry.values(settings.values)[def.id]! : null;
  const changed =
    enabled !== def.defaultEnabled || (def.kind === 'slider' && value !== def.defaultValue);
  return { enabled, value, changed };
}
