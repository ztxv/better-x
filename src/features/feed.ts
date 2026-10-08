/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { CELL, hide, onRoute, POST, PRIMARY_COLUMN } from './css';
import { definitions } from './define';
import type { ToggleFeature } from './types';

const { toggle } = definitions('feed');

const HOME = onRoute('home');
/** Social-context icons that mark a pinned post and a community post (Control Panel's own checks). */
const PINNED_ICON = 'M13 21l-1 2-1-2v-5H4.5v-2.287l';
const COMMUNITY_ICON = 'M7.471 21H.472l.029-1.027c.184';
/** The icons of a "liked" and a "reposted" notification. */
const LIKE_NOTIFICATION_ICON = 'M20.884 13.19c-1.351 2.48-4.00';
const REPOST_NOTIFICATION_ICON = 'M4.75 3.79l4.603 4.3-1.706 1.8';

/**
 * A timeline cell holding a post that X shows because of someone else: a repost (and the other
 * "because ..." posts, which Control Panel treats the same way). Pinned and community posts carry
 * the same label but are the profile's own, so they are left out. X positions a cell itself, so
 * the rule hides the cell's child, as Hide Ads does.
 */
const sharedPost = (route: string) =>
  `${route} ${CELL} > div:has(${POST} [data-testid="socialContext"]):not(:has(path[d^="${PINNED_ICON}"], path[d^="${COMMUNITY_ICON}"]))`;

/**
 * Home and timeline cleanup, hidden with CSS only. Nothing here changes what X loads, so a hidden
 * post is still fetched and counted by X, and returns the moment its switch is turned off.
 * (Hide For You, in `hide-for-you.ts`, is the one feature here that acts on the page.)
 */
export const FEED_FEATURES: readonly ToggleFeature[] = [
  toggle(
    'hideNewPostsPill',
    'Hide “Show new posts”',
    'Remove the floating pill that announces new posts on Home.',
    hide(
      `${HOME} ${PRIMARY_COLUMN} > div > div:first-child > div[style^="transform"]`,
      `${HOME} [data-testid="TopNavBar"] ~ div[style^="transform"]:last-child`,
    ),
    ['see new posts', 'refresh'],
  ),
  toggle(
    'hidePostBox',
    'Hide the Home composer',
    'Remove the “What is happening?” box at the top of Home. The Post button still opens the composer.',
    hide(`${HOME} ${PRIMARY_COLUMN} > div > div:has([data-testid^="tweetTextarea"])`),
    ['compose', 'tweet box', 'write'],
  ),
  toggle(
    'hideManageTimelines',
    'Hide “Manage timelines”',
    'Remove the plus button beside the Home tabs.',
    hide(
      `${HOME} ${PRIMARY_COLUMN} div:has(> nav) + div:has(path[d="M11 11V4h2v7h7v2h-7v7h-2v-7H4v-2h7z"])`,
    ),
    ['pinned timelines', 'tabs'],
  ),
  toggle(
    'hideInlinePrompts',
    'Hide timeline prompts',
    'Remove the “Subscribe”, “Verify” and other prompts X inserts between posts.',
    hide(`${CELL} > div:has([data-testid="inlinePrompt"])`),
    ['upsell', 'promotion'],
  ),
  toggle(
    'hideSuggestedModules',
    'Hide “Who to follow” in the timeline',
    'Remove suggested-account modules from Home: their heading, the accounts and “Show more”.',
    hide(
      `${HOME} ${CELL} > div:not(:has(${POST})):is(:has(h2[role="heading"]), :has([data-testid="UserCell"]), :has(a[href*="/i/connect_people"]))`,
    ),
    ['recommended accounts', 'suggested accounts', 'people'],
  ),
  toggle(
    'hideProfileSuggestions',
    'Hide suggestions on profiles',
    'Remove “You might like” and similar suggestions that appear on a profile page.',
    hide(`${onRoute('profile')} ${PRIMARY_COLUMN} aside[role="complementary"]`),
    ['recommended', 'who to follow'],
  ),
  toggle(
    'hideExploreContents',
    'Empty the Explore page',
    'Remove the trending, news and recommendation tabs from Explore, leaving search.',
    hide(
      `${onRoute('explore')} ${PRIMARY_COLUMN} > div > div:first-of-type nav`,
      `${onRoute('explore')} ${PRIMARY_COLUMN} section > h1 + div[aria-label] > div`,
      `${onRoute('explore')} [data-testid="TopNavBar"] > div > div:nth-of-type(2)`,
    ),
    ['trending', 'for you', 'news'],
  ),
  toggle(
    'hideReposts',
    'Hide reposts on Home',
    'Remove reposts from the Home timeline. Also hides the other “because someone liked or followed” posts, which X labels the same way.',
    hide(sharedPost(HOME)),
    ['retweets', 'shared'],
  ),
  toggle(
    'hideProfileReposts',
    'Hide reposts on profiles',
    'Remove reposts from other people’s profiles. Pinned posts stay.',
    hide(sharedPost(onRoute('profile'))),
    ['retweets'],
  ),
  toggle(
    'hideNotificationLikes',
    'Hide “liked your post” notifications',
    'Remove like notifications from your Notifications page.',
    hide(
      `${onRoute('notifications')} ${CELL} > div:has([data-testid="notification"] svg path[d^="${LIKE_NOTIFICATION_ICON}"])`,
    ),
    ['likes'],
  ),
  toggle(
    'hideNotificationReposts',
    'Hide “reposted your post” notifications',
    'Remove repost notifications from your Notifications page.',
    hide(
      `${onRoute('notifications')} ${CELL} > div:has([data-testid="notification"] svg path[d^="${REPOST_NOTIFICATION_ICON}"])`,
    ),
    ['retweets'],
  ),
];
