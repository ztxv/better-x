import type { Runtime } from '../runtime';
import type { Scope } from '../runtime/scope';

/** Groups features in the Customize view, in the order the view lists them. */
export type FeatureCategory =
  'navigation' | 'feed' | 'posts' | 'insights' | 'filtering' | 'sidebar' | 'appearance' | 'cleanup';

export const CATEGORY_TITLES: Record<FeatureCategory, string> = {
  navigation: 'Navigation',
  feed: 'Home & feed',
  posts: 'Posts',
  insights: 'Account insights',
  filtering: 'Smart filtering',
  sidebar: 'Sidebar',
  appearance: 'Appearance',
  cleanup: 'Ads, Grok & Premium',
};

/** Short names for the category chips. */
export const CATEGORY_SHORT: Record<FeatureCategory, string> = {
  navigation: 'Navigation',
  feed: 'Home',
  posts: 'Posts',
  insights: 'Insights',
  filtering: 'Filtering',
  sidebar: 'Sidebar',
  appearance: 'Appearance',
  cleanup: 'Ads & Grok',
};

export const CATEGORY_HINTS: Record<FeatureCategory, string> = {
  navigation: 'Menu items and buttons you do not use',
  feed: 'What shows up in your timelines',
  posts: 'Counts, buttons and details on posts',
  insights: 'Where an account is based and how it connects, from X',
  filtering: 'Collapse, hide or highlight posts by account country',
  sidebar: 'The column beside your timeline',
  appearance: 'Widths, spacing, type and Twitter branding',
  cleanup: 'Promotions, Grok and upsells',
};

/** What a feature is given when it turns on. */
export interface FeatureContext {
  /**
   * Lives from activation to deactivation (or to the end of the content script). Anything the
   * feature starts is registered on it, so turning the feature off, or a failure while turning it
   * on, releases everything.
   */
  scope: Scope;
  /** The shared services: posts, action row, routes, layout. Features never make their own observers. */
  runtime: Runtime;
}

interface FeatureBase {
  /** `category.name`; what settings store. Never change one that has shipped. */
  id: string;
  category: FeatureCategory;
  title: string;
  description: string;
  /** Extra words the Customize search matches besides the title and description. */
  keywords?: readonly string[];
  defaultEnabled: boolean;
  activate?(context: FeatureContext): void;
}

/** An on/off option. `css` is applied while it is on, in one shared stylesheet. */
export interface ToggleFeature extends FeatureBase {
  kind: 'toggle';
  css?: string;
}

/**
 * An on/off option with a number, for a property that varies continuously (a width, a spacing, a
 * size). The number is only used while the feature is on. `css` gets the validated value, which
 * is always within `min`..`max` and a multiple of `step` from `min`.
 */
export interface SliderFeature extends FeatureBase {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  css(value: number): string;
}

/**
 * An on/off option with a color. The color is stored as one whole number (0xRRGGBB), so it travels
 * through the same `values` storage and backups as slider numbers. `css` gets the validated number.
 */
export interface ColorFeature extends FeatureBase {
  kind: 'color';
  defaultValue: number;
  css(value: number): string;
}

/** A feature that carries a stored number besides its switch. */
export type ValueFeature = SliderFeature | ColorFeature;

/**
 * A customization feature: what it is called, how it is set, what it does to the page.
 *
 * A feature changes the page with `css` (applied while it is on, in one shared stylesheet),
 * with `activate` (runtime behavior on the shared runtime), or both. Dependencies and
 * route/layout restrictions are not modelled; a feature that needs them checks the runtime in
 * `activate` or scopes its selectors on `<html data-bx-route data-bx-layout data-bx-sidebar>`.
 */
export type FeatureDef = ToggleFeature | SliderFeature | ColorFeature;
