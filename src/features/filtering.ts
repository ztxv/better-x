import { startCountryFilter } from '../insights/filter';
import type { ToggleFeature } from './types';

/**
 * Smart filtering. The list of countries, the mode (collapse, hide or highlight), whether it acts
 * on posts and quoted posts, and the Always Show accounts are structured settings (`filter` in
 * settings) edited in the Smart filtering panel; this toggle turns the filter on.
 *
 * It acts only on a known answer from X about where an account is based. Unknown or still
 * loading accounts are never filtered. It changes only what this browser shows: it does not
 * block, mute or report anyone.
 */
export const countryFilter: ToggleFeature = {
  id: 'filtering.country',
  category: 'filtering',
  kind: 'toggle',
  title: 'Filter posts by account country',
  description:
    'Collapse, hide or highlight posts from accounts X says are based in the countries you choose. Needs a lookup of each account on screen, paced and cached. Only changes your own view.',
  keywords: ['country', 'region', 'location', 'collapse', 'hide', 'quote', 'based in', 'block'],
  defaultEnabled: false,
  activate: (context) => startCountryFilter(context),
};

export const FILTERING_FEATURES: readonly ToggleFeature[] = [countryFilter];
