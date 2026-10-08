import { APPEARANCE_FEATURES } from './appearance';
import { CLEANUP_FEATURES } from './cleanup';
import { FEED_FEATURES } from './feed';
import { hideAds } from './hide-ads';
import { hideForYou } from './hide-for-you';
import { hideGrok } from './hide-grok';
import { NAVIGATION_FEATURES } from './navigation';
import { POST_FEATURES } from './posts';
import { createFeatureRegistry } from './registry';
import { SIDEBAR_FEATURES } from './sidebar';
import type { FeatureDef } from './types';

/**
 * Every customization feature Better X ships, grouped by category in the order the Customize
 * view shows them. Ids are what settings store: add to this list, never rename an id.
 */
export const FEATURES: readonly FeatureDef[] = [
  ...NAVIGATION_FEATURES,
  hideForYou,
  ...FEED_FEATURES,
  ...POST_FEATURES,
  ...SIDEBAR_FEATURES,
  ...APPEARANCE_FEATURES,
  hideAds,
  hideGrok,
  ...CLEANUP_FEATURES,
];

export const featureRegistry = createFeatureRegistry(FEATURES);
