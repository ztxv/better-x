import type { FeatureRegistry } from './registry';
import type { SettingsPatch } from '../lib/settings';
import type { Settings } from '../lib/settings';

export interface Preset {
  id: 'minimal' | 'clean' | 'focus';
  title: string;
  description: string;
  /** The features this setup turns on. Every other customization feature is turned off. */
  features: readonly string[];
  /** Slider numbers this setup uses; a slider not named here goes back to its default. */
  values?: Readonly<Record<string, number>>;
}

/** Promotions, upsells and prompts. Nothing about how X looks otherwise changes. */
const CLEAN = [
  'cleanup.hideAds',
  'cleanup.hideGrok',
  'cleanup.hideGrokImageEdit',
  'cleanup.hideGrokPosts',
  'cleanup.hidePremiumUpsells',
  'cleanup.hideSubscriptions',
  'feed.hideInlinePrompts',
  'feed.hideSuggestedModules',
  'navigation.hidePremium',
  'navigation.hideBusiness',
  'sidebar.hidePremiumPromo',
  'sidebar.hideWhoToFollow',
] as const;

/**
 * Declarative quick setups. A preset is a list of feature ids (and slider numbers): applying one
 * replaces the customization switches with exactly that list, and nothing else in the settings
 * (Saved, downloads, the panel's theme) is read or written. `presetPatch` and `restorePatch` are
 * the only code that turns one into a settings change, and the second undoes the first.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'clean',
    title: 'Clean',
    description: 'No ads, Grok, upsells or suggested accounts. X otherwise as it is.',
    features: CLEAN,
  },
  {
    id: 'minimal',
    title: 'Minimal',
    description: 'Clean, plus a leaner menu, a search-only sidebar and no engagement numbers.',
    features: [
      ...CLEAN,
      'navigation.hideCommunities',
      'navigation.hideJobs',
      'navigation.hideConnect',
      'navigation.hideSpaces',
      'navigation.hideHistory',
      'navigation.hideCreatorStudio',
      'navigation.hideBadges',
      'feed.hideNewPostsPill',
      'feed.hideManageTimelines',
      'feed.hideProfileSuggestions',
      'posts.hideViews',
      'posts.hideReplyCount',
      'posts.hideRepostCount',
      'posts.hideLikeCount',
      'posts.hideBookmarkCount',
      'posts.hideFollowCounts',
      'posts.hideVerifiedBadges',
      'sidebar.keepOnlySearch',
      'sidebar.hideFooter',
    ],
  },
  {
    id: 'focus',
    title: 'Focus',
    description: 'Following only, no sidebar, no counts, no reposts, no reasons to scroll.',
    features: [
      'cleanup.hideAds',
      'cleanup.hideGrok',
      'cleanup.hidePremiumUpsells',
      'feed.hideForYou',
      'feed.hideReposts',
      'feed.hideInlinePrompts',
      'feed.hideSuggestedModules',
      'feed.hideNewPostsPill',
      'feed.hideExploreContents',
      'feed.hideNotificationLikes',
      'navigation.hideBadges',
      'navigation.hideMessagesDrawer',
      'posts.hideViews',
      'posts.hideReplyCount',
      'posts.hideRepostCount',
      'posts.hideLikeCount',
      'posts.hideBookmarkCount',
      'posts.hideFollowCounts',
      'sidebar.hideSidebar',
    ],
  },
];

/** The settings change that applies a preset: its features on, every other feature forgotten. */
export function presetPatch(
  preset: Preset,
  registry: FeatureRegistry,
): Required<Pick<SettingsPatch, 'features' | 'values'>> {
  const on = new Set(preset.features);
  const features: Record<string, boolean | null> = {};
  const values: Record<string, number | null> = {};
  for (const def of registry.list()) {
    features[def.id] = on.has(def.id) ? true : null;
    if (def.kind === 'slider') values[def.id] = preset.values?.[def.id] ?? null;
  }
  return { features, values };
}

/** The settings change that puts the customization back exactly as `before` had it. */
export function restorePatch(
  before: Pick<Settings, 'features' | 'values'>,
  registry: FeatureRegistry,
): Required<Pick<SettingsPatch, 'features' | 'values'>> {
  const features: Record<string, boolean | null> = {};
  const values: Record<string, number | null> = {};
  for (const def of registry.list()) {
    features[def.id] = before.features[def.id] ?? null;
    if (def.kind === 'slider') values[def.id] = before.values[def.id] ?? null;
  }
  return { features, values };
}

/** The settings change that returns the given features (all of them, by default) to their defaults. */
export function resetPatch(
  registry: FeatureRegistry,
  ids?: readonly string[],
): Required<Pick<SettingsPatch, 'features' | 'values'>> {
  const only = ids && new Set(ids);
  const features: Record<string, boolean | null> = {};
  const values: Record<string, number | null> = {};
  for (const def of registry.list()) {
    if (only && !only.has(def.id)) continue;
    features[def.id] = null;
    if (def.kind === 'slider') values[def.id] = null;
  }
  return { features, values };
}
