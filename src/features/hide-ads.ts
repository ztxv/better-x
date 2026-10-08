import type { FeatureDef } from './types';

/**
 * The "promoted" badge's icon path, which marks a promoted trend (the trend has no other
 * stable marker). Taken from Control Panel for Twitter, which has relied on it for years.
 */
const PROMOTED_ICON =
  'M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0 1.38 1.119 2.5 2.5 2.5h15c1.381 0 2.5-1.12 2.5-2.5v-13c0-1.38-1.119-2.5-2.5-2.5zm-3.502 12h-2v-3.59l-5.293 5.3-1.414-1.42L12.581 10H8.996V8h7v7z';

const ADS_LINK = ':is([href*="ads.twitter.com"], [href*="ads.x.com"])';

/**
 * Hides promoted content, using only CSS: nothing observes the page, a post X renders later is
 * covered the moment it appears, and switching the feature off restores everything at once.
 *
 * - Promoted posts. X wraps a promoted post in `placementTracking` (Control Panel's marker too).
 *   The rule needs both that wrapper and a post inside it, so an ordinary post, or a wrapper
 *   around something that is not a post, is never matched. It hides the timeline cell's inner
 *   div rather than the cell, because X positions cells of its virtualized list by the cell
 *   itself; hiding the cell would shift or collapse the list.
 * - Promoted trends, by the promoted badge inside the trend.
 * - The Ads link in X's menus (the desktop menu, and the narrow layout's dialog).
 *
 * Detection relies on X's test IDs. X's newer markup shape (served to signed-out visitors) has
 * none, so nothing in it is matched and nothing in it is hidden. Not covered: promoted accounts
 * in "Who to follow".
 */
export const hideAds: FeatureDef = {
  id: 'cleanup.hideAds',
  category: 'cleanup',
  title: 'Hide Ads',
  description: 'Remove promoted posts and trends from X.',
  kind: 'toggle',
  defaultEnabled: false,
  css: `
[data-testid="cellInnerDiv"] > div:has([data-testid="placementTracking"] [data-testid="tweet"]),
[data-testid="trend"]:has(path[d="${PROMOTED_ICON}"]),
[role="menu"] a${ADS_LINK},
html[data-bx-layout="narrow"] [role="dialog"] a${ADS_LINK} {
  display: none !important;
}`,
};
