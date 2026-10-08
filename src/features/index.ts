import { hideAds } from './hide-ads';
import { hideForYou } from './hide-for-you';
import { hideGrok } from './hide-grok';
import { createFeatureRegistry } from './registry';
import type { FeatureDef } from './types';

/** Every customization feature Better X ships, in the order the Customize view shows them. */
export const FEATURES: readonly FeatureDef[] = [hideAds, hideGrok, hideForYou];

export const featureRegistry = createFeatureRegistry(FEATURES);
