/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { hide, onRoute, rule, SIDEBAR, SIDEBAR_SECTIONS } from './css';
import { definitions } from './define';
import type { ToggleFeature } from './types';

const { toggle } = definitions('sidebar');

/**
 * The sidebar column, hidden with CSS only. X draws the column only when its window is wide
 * enough, so each rule applies when the column is there and does nothing when it is not: opening
 * Chrome's side panel (which narrows X) never leaves a rule in the wrong state. The sections are
 * found by their position in the column and by what they contain, as Control Panel tags them.
 */
export const SIDEBAR_FEATURES: readonly ToggleFeature[] = [
  toggle(
    'hideSidebar',
    'Hide the sidebar',
    'Remove the whole column beside your timeline, including its search box.',
    hide(SIDEBAR),
    ['right column', 'search'],
  ),
  toggle(
    'keepOnlySearch',
    'Keep only search in the sidebar',
    'Hide every sidebar section except the search box. Search results and community pages keep the section X shows there.',
    [
      // Not `!important`: the re-show rules below must be able to win on the pages that need them.
      rule(`${SIDEBAR_SECTIONS} > div:not(:first-of-type)`, 'display: none;'),
      rule(`${onRoute('search')} ${SIDEBAR_SECTIONS} > div:nth-of-type(2)`, 'display: block;'),
      rule(`${onRoute('community')} ${SIDEBAR_SECTIONS} > div:nth-of-type(3)`, 'display: block;'),
    ].join('\n'),
    ['minimal', 'clean', 'trends'],
  ),
  toggle(
    'hideWhatsHappening',
    'Hide “What’s happening”',
    'Remove the trending section from the sidebar.',
    hide(`${SIDEBAR} div:has(> section > div[aria-label] > div)`),
    ['trends', 'trending'],
  ),
  toggle(
    'hideTodaysNews',
    'Hide “Today’s News”',
    'Remove the news section from the sidebar.',
    hide(`${SIDEBAR_SECTIONS} > div:has(> [data-testid="news_sidebar"])`),
    ['headlines'],
  ),
  toggle(
    'hideWhoToFollow',
    'Hide “Who to follow”',
    'Remove suggested accounts from the sidebar. “Relevant people” on a post’s own page stays.',
    // The card is the `aside` that holds user cells. The rule is anchored on the aside, which has
    // a role, rather than on the section around it (see `cellWhere` in css.ts for why).
    hide(
      `html:not([data-bx-route="post"]) ${SIDEBAR} aside[role="complementary"]:has([data-testid="UserCell"])`,
    ),
    ['suggested accounts', 'recommended accounts', 'people'],
  ),
  toggle(
    'hidePremiumPromo',
    'Hide the Premium card',
    'Remove the “Subscribe to Premium” and similar cards from the sidebar.',
    hide(
      `${SIDEBAR} aside[role="complementary"]:has(a[href^="/i/premium_sign_up"])`,
      `${SIDEBAR} [data-testid="super-upsell-UpsellCardRenderProperties"]`,
    ),
    ['upsell', 'subscribe'],
  ),
  toggle(
    'hideFooter',
    'Hide footer links',
    'Remove “Terms of Service”, “Privacy Policy” and the other links at the bottom of the sidebar. English only.',
    hide(`${SIDEBAR} nav[aria-label="Footer"]`),
    ['terms', 'privacy', 'cookies'],
  ),
];
