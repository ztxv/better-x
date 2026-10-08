import { createFeatureRegistry } from './registry';
import type { FeatureDef } from './types';

/** Every customization feature Better X ships, in the order the Customize view shows them. */
export const FEATURES: readonly FeatureDef[] = [];

export const featureRegistry = createFeatureRegistry(FEATURES);
