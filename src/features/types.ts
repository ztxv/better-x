import type { Runtime } from '../runtime';
import type { Scope } from '../runtime/scope';

/** Groups features in the Customize view. */
export type FeatureCategory = 'cleanup' | 'feed';

export const CATEGORY_TITLES: Record<FeatureCategory, string> = {
  cleanup: 'Clean up',
  feed: 'Home & feed',
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

/**
 * A customization feature: what it is called, how it is set, what it does to the page.
 *
 * The id is `category.name` (and is what settings store). The only kind of setting so far is a
 * toggle. A feature changes the page with `css` (applied while it is on, in one shared
 * stylesheet), with `activate` (runtime behavior on the shared runtime), or both. Dependencies and
 * route/layout restrictions are not modelled yet; a feature that needs them checks the runtime in
 * `activate` or scopes its selectors on `<html data-bx-route data-bx-layout>`.
 */
export interface FeatureDef {
  id: string;
  category: FeatureCategory;
  title: string;
  description: string;
  kind: 'toggle';
  defaultEnabled: boolean;
  css?: string;
  activate?(context: FeatureContext): void;
}
