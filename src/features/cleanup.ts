/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { cellWhere, hide, links, onRoute, POST, PRIMARY_COLUMN } from './css';
import { definitions } from './define';
import type { ToggleFeature } from './types';

const { toggle } = definitions('cleanup');

const IMAGINE =
  ':is([href^="/i/imagine"], [href^="https://grok.com/imagine"], [href^="/i/grok-redirect"])';
const PREMIUM_LINK = '[href^="/i/premium_sign_up"]';
const FOCUSED_POST = `${POST}[tabindex="-1"]`;
const PROFILE = onRoute('profile');

/**
 * Promotions, Grok extras and upsells beyond what Hide Ads and Hide Grok cover, hidden with CSS
 * only. These are Control Panel for Twitter's own selectors for the same surfaces; each hides one
 * widget, never a post's text.
 */
export const CLEANUP_FEATURES: readonly ToggleFeature[] = [
  toggle(
    'hideGrokImageEdit',
    'Hide Grok image editing',
    'Remove the “Edit image” entry points Grok adds to photos and menus.',
    hide(
      `${POST} div[aria-labelledby] a${IMAGINE}`,
      `${POST} [data-testid="tweetText"] a${IMAGINE}`,
      `[role="menuitem"]${IMAGINE}`,
      `[aria-modal="true"] > div > div:first-of-type a${IMAGINE}`,
    ),
    ['imagine', 'ai', 'edit image'],
  ),
  toggle(
    'hideGrokPosts',
    'Hide posts sharing Grok chats',
    'Remove posts that link to a shared Grok conversation.',
    hide(cellWhere(`:has(${POST} a[href^="/i/grok/share/"])`)),
    ['ai', 'conversation'],
  ),
  toggle(
    'hidePremiumUpsells',
    'Hide Premium upsells',
    'Remove the Premium prompts X shows in menus, settings, your profile, the composer and your own posts.',
    hide(
      links('[href="/i/account_analytics"]'),
      '[role="menu"] a' + PREMIUM_LINK,
      'html[data-bx-layout="narrow"] [role="dialog"] a' + PREMIUM_LINK,
      '[role="menuitem"][data-testid="highlightUpsell"]',
      '[role="menuitem"][data-testid="editWithPremium"]',
      `${onRoute('settings')} a${PREMIUM_LINK}`,
      `${PROFILE} ${PRIMARY_COLUMN} a${PREMIUM_LINK}`,
      `${PROFILE} [data-testid="analytics-preview"]`,
      `${onRoute('communities')} ${PRIMARY_COLUMN} a:is([href^="/i/premium"], [href^="/i/verified"])`,
      '[data-testid="verified_profile_upsell"]',
      '[data-testid="profileAnalyticsUpsell"]',
      '[data-testid="verified_profile_visitor_upsell"]',
      `[aria-live="polite"][role="status"]:has(a${PREMIUM_LINK})`,
      // The upsell under the profile tabs; its link is a few levels down, so each depth is tried
      // with a child combinator, which Chrome keeps cheap (a descendant `:has` would not be).
      ...[
        'a[href^="/i/premium"]',
        'div > a[href^="/i/premium"]',
        'div > div > a[href^="/i/premium"]',
      ].map((link) => `${PROFILE} ${PRIMARY_COLUMN} nav + div:has(> ${link})`),
    ),
    ['subscribe', 'blue', 'analytics', 'upgrade'],
  ),
  toggle(
    'hideSubscriptions',
    'Hide creator subscriptions',
    'Remove Subscribe buttons, subscriber badges, subscription counts and the Subscriptions tabs.',
    hide(
      // The purple Subscribe button on a profile, matched by its border colour as Control Panel does.
      `${PROFILE} [role="button"][style*="border-color: rgb(201, 54, 204)"]`,
      `${PROFILE} a[href$="/creator-subscriptions/subscriptions"]`,
      `${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/superfollows"])`,
      `${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/subscriptions"])`,
      `${FOCUSED_POST} [data-testid$="-subscribe"]`,
      '[data-testid="Dropdown"] > [data-testid="subscribe"]',
      '[data-testid="sheetDialog"] > [data-testid="subscribe"]',
      `${POST} [data-testid="icon-subscriber"]`,
    ),
    ['superfollow', 'creator', 'paid'],
  ),
  toggle(
    'hideVerifiedFollowersTab',
    'Hide the Verified Followers tab',
    'Remove the Verified Followers tab from follower lists. Opening its address directly still works.',
    hide(`${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/verified_followers"])`),
    ['premium', 'blue', 'followers'],
  ),
];
