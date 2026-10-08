/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { hide, links, navLinks, PRIMARY_NAV, rule, within } from './css';
import { definitions } from './define';
import type { ToggleFeature } from './types';

const { toggle } = definitions('navigation');

/**
 * Navigation clutter, hidden with CSS only. Every rule matches a link by its destination
 * (`href`), which is what Control Panel for Twitter matches too, in the places X shows links: the
 * side nav (or bottom bar when narrow), popup menus, the narrow layout's menu dialog and the
 * More dialog. A rule that no longer matches does nothing; none can hide a post.
 */
export const NAVIGATION_FEATURES: readonly ToggleFeature[] = [
  toggle(
    'hideExplore',
    'Hide Explore',
    'Remove Explore from the menu while X shows its sidebar, which has search. With no sidebar it stays, so search is never lost.',
    hide(links('[href="/explore"]', '[data-bx-sidebar]')),
    ['search', 'trending'],
  ),
  toggle(
    'hideCommunities',
    'Hide Communities',
    'Remove Communities from the menu.',
    hide(links('[href$="/communities"]')),
  ),
  toggle('hideLists', 'Hide Lists', 'Remove Lists from the menu.', hide(links('[href$="/lists"]'))),
  toggle(
    'hideMessages',
    'Hide Messages',
    'Remove Messages and Chat from the menu.',
    hide(links(':is([href="/messages"], [href="/i/chat"])')),
    ['chat', 'dm', 'inbox'],
  ),
  toggle(
    'hideNotifications',
    'Hide Notifications',
    'Remove Notifications from the menu. The Notifications page still works if you open it.',
    hide(
      navLinks('[href^="/notifications"]'),
      '[aria-labelledby="modal-header"] a[href^="/notifications"]',
    ),
  ),
  toggle(
    'hideBadges',
    'Hide notification counts',
    'Remove the unread-count dots from Notifications, Messages and your account.',
    [
      hide(
        within('html[data-bx-layout="wide"]', [
          `${PRIMARY_NAV} > :is(a[href^="/notifications"], a[href="/messages"], a[href="/i/chat"]) div[aria-live]`,
          'button[data-testid="SideNav_AccountSwitcher_Button"] > div > div[aria-label]',
          '[data-testid="HoverCard"] button[data-testid="UserCell"] div[aria-live]',
          '[data-testid="DMDrawerHeader"] h2 svg[role="img"]',
        ]),
        within('html[data-bx-layout="narrow"]', [
          `${PRIMARY_NAV} > :is(a[href^="/notifications"], a[href="/messages"], a[href="/i/chat"]) div[aria-label]`,
          'button[data-testid="DashButton_ProfileIcon_Link"] div[aria-label]',
          '[role="dialog"] [data-testid^="UserAvatar-Container"] div[dir]',
        ]),
      ),
    ].join('\n'),
    ['unread', 'dot', 'badge'],
  ),
  toggle(
    'hideBookmarks',
    'Hide Bookmarks',
    'Remove X’s own Bookmarks from the menu. Your Better X Library is separate and stays.',
    hide(links('[href="/i/bookmarks"]')),
    ['saved'],
  ),
  toggle(
    'hidePremium',
    'Hide Premium',
    'Remove Premium and Verified from the menu and from profile hover cards.',
    hide(
      links(
        ':is([href^="/i/premium"], [href^="/i/verified"]):not([href^="/i/premium-business"], [href^="/i/verified-orgs"])',
      ),
      '[data-testid="HoverCard"] a[href^="/i/premium"]',
    ),
    ['subscription', 'blue', 'verified'],
  ),
  toggle(
    'hideBusiness',
    'Hide Business',
    'Remove Premium Business and Verified Organizations from the menu.',
    hide(links(':is([href^="/i/premium-business"], [href^="/i/verified-orgs-signup"])')),
  ),
  toggle(
    'hideJobs',
    'Hide Jobs',
    'Remove Jobs from the menu and your profile.',
    [
      hide(links('[href="/jobs"]')),
      hide(within('html[data-bx-route="profile"]', '[data-testid="jobs"]')),
    ].join('\n'),
  ),
  toggle(
    'hideCreatorStudio',
    'Hide Creator Studio and subscriptions',
    'Remove Creator Studio, and Monetization and Subscriptions in Settings.',
    hide(
      links('[href$="/creators/studio"]'),
      within('html[data-bx-route="settings"]', [
        'a[href="/settings/monetization"]',
        'a[href="/settings/manage_subscriptions"]',
      ]),
    ),
    ['monetization', 'subscription'],
  ),
  toggle(
    'hideConnect',
    'Hide Connect',
    'Remove “Connect” and “Follow people” from menus.',
    hide(links(':is([href$="/i/connect_people"], [href$="/i/follow_people"])')),
    ['people', 'suggestions'],
  ),
  toggle(
    'hideSpaces',
    'Hide Spaces',
    'Remove Spaces from menus.',
    hide(links('[href="/i/spaces/start"]')),
  ),
  toggle(
    'hideHistory',
    'Hide History',
    'Remove History from menus.',
    hide(links('[href="/i/history"]')),
  ),
  toggle(
    'hideComposeButton',
    'Hide the Post button',
    'Remove the Post button from the menu and the floating Post button. The composer on Home is separate.',
    hide(
      '[data-testid="SideNav_NewTweet_Button"]',
      '[data-testid="FloatingActionButtons_Tweet_Button"]',
    ),
    ['compose', 'tweet', 'write'],
  ),
  toggle(
    'hideAccountSwitcher',
    'Hide account switcher details',
    'Keep the account button at the bottom of the menu but drop your avatar and name from it.',
    [
      rule(
        'header[role="banner"] > div > div > div > div:last-child',
        'flex-shrink: 1 !important;\n  align-items: flex-end !important;',
      ),
      hide(
        '[data-testid="SideNav_AccountSwitcher_Button"] > div:first-child:not(:only-child)',
        '[data-testid="SideNav_AccountSwitcher_Button"] > div:first-child + div',
      ),
    ].join('\n'),
    ['profile', 'avatar'],
  ),
  toggle(
    'hideMessagesDrawer',
    'Hide the Messages drawer',
    'Hide the chat panel that sits at the bottom right of X.',
    rule(
      'div:is([data-testid="DMDrawer"], [data-testid="chat-drawer-root"])',
      'visibility: hidden;',
    ),
    ['chat', 'dm'],
  ),
];
