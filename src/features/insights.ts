import { badgesFor } from '../insights/badges';
import type { BadgePart } from '../insights/model';
import type { ToggleFeature } from './types';

/**
 * Account insights: small badges beside a post's @handle built from what X itself reports about
 * the account (its "About this account" data). All four toggles share one badge controller, so
 * turning several on adds no extra work; the controller exists while at least one is on.
 *
 * Based in is X's estimate for the account. Connected via is the account's platform. Neither is
 * nationality, the place a post was written, or the app used for one post; the tooltips and the
 * details card say so.
 */
function badgePart(
  name: string,
  part: BadgePart,
  title: string,
  description: string,
  keywords: readonly string[],
): ToggleFeature {
  return {
    id: `insights.${name}`,
    category: 'insights',
    kind: 'toggle',
    title,
    description,
    keywords,
    defaultEnabled: false,
    activate({ scope, runtime }) {
      scope.add(badgesFor(runtime).retain(part));
    },
  };
}

export const INSIGHT_FEATURES: readonly ToggleFeature[] = [
  badgePart(
    'flags',
    'flags',
    'Show country flags',
    'Add a flag beside a username for the country or region X says the account is based in. X estimates this from account activity; it is not nationality.',
    ['country', 'location', 'based in', 'region'],
  ),
  badgePart(
    'connection',
    'connection',
    'Show connection-source badges',
    'Add an Apple, Android or Web mark for the platform X says the account connects through. It is the account’s platform, not the app used for a post.',
    ['apple', 'android', 'web', 'connected via', 'platform', 'app store'],
  ),
  badgePart(
    'details',
    'details',
    'Show account details',
    'Open a small card from the badge with what X reports: based in, connected via, joined date, username changes and affiliation. Only facts X sent are shown.',
    ['popover', 'card', 'joined', 'username changes'],
  ),
  badgePart(
    'warnings',
    'warnings',
    'Show location warnings',
    'Mark accounts where X says the based-in location may not be accurate. It is a note from X, not proof of a VPN or of anything else.',
    ['accuracy', 'vpn', 'uncertain'],
  ),
];
