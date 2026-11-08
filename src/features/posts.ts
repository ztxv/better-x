/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { hide, onRoute, POST, PRIMARY_COLUMN, rule, within } from './css';
import { definitions } from './define';
import type { ColorFeature, ToggleFeature } from './types';

const { toggle, color } = definitions('posts');

/** A post in the timeline, and the post at the top of a post's own page. */
const TIMELINE_POST = `${POST}[tabindex="0"]`;
const FOCUSED_POST = `${POST}[tabindex="-1"]`;
const ACTIONS = '[role="group"]';
/** Better X's own controls in an action row. Rules that act on X's buttons must never match them. */
const NOT_OURS = ':not([data-bx-slot])';

/** Hides the count under one of X's action buttons while keeping the button. */
const count = (testIds: string) =>
  rule(`${ACTIONS} button:is(${testIds}) span`, 'visibility: hidden;');

/**
 * Post details, counts and buttons, hidden with CSS only. Rules that act on X's action row match
 * X's own buttons by test ID and never Better X's controls (`data-bx-slot`), so Save and the
 * download buttons stay.
 */
export const POST_FEATURES: ReadonlyArray<ToggleFeature | ColorFeature> = [
  toggle(
    'hideViews',
    'Hide view counts',
    'Remove the views number under posts and on a post’s own page.',
    [
      hide(
        `${TIMELINE_POST} ${ACTIONS} > div:has(> a[href$="/analytics"])`,
        `[aria-modal="true"] ${ACTIONS} > div:has(> a[href$="/analytics"])`,
        // The line under a post's text ("10:32 AM · Mar 21, 2025 · 1.2M Views"): the separator and
        // the views, which are its 2nd and 3rd children.
        `${FOCUSED_POST} div:has(> div > a > time) > :is(:nth-child(2), :nth-child(3))`,
      ),
    ].join('\n'),
    ['impressions', 'analytics', 'metrics'],
  ),
  toggle(
    'hideReplyCount',
    'Hide reply counts',
    'Remove the number beside the reply button. The button stays.',
    count('[data-testid="reply"]'),
    ['comments', 'metrics'],
  ),
  toggle(
    'hideRepostCount',
    'Hide repost counts',
    'Remove the number beside the repost button. The button stays.',
    count('[data-testid$="retweet"]'),
    ['retweet', 'metrics'],
  ),
  toggle(
    'hideLikeCount',
    'Hide like counts',
    'Remove the number beside the like button. The button stays.',
    count('[data-testid$="like"]'),
    ['hearts', 'metrics'],
  ),
  toggle(
    'hideBookmarkCount',
    'Hide bookmark counts',
    'Remove the number beside the bookmark button. The button stays.',
    count('[data-testid$="ookmark"]'),
    ['metrics'],
  ),
  toggle(
    'hideFollowCounts',
    'Hide follower counts',
    'Remove follower and following numbers on profiles and hover cards.',
    [
      hide(
        within(`:is(#layers, ${onRoute('profile')})`, [
          'a:is([href$="/following"], [href$="/followers"], [href$="/verified_followers"]) > span:first-child',
        ]),
      ),
      rule(
        within(`:is(#layers, ${onRoute('profile')})`, [
          'a:is([href$="/following"], [href$="/followers"], [href$="/verified_followers"])',
        ]),
        'white-space: pre-line;',
      ),
    ].join('\n'),
    ['followers', 'following', 'metrics'],
  ),
  toggle(
    'hidePostCount',
    'Hide post totals on profiles',
    'Remove the “1,234 posts” line under a profile’s name.',
    hide(`${onRoute('profile')} ${PRIMARY_COLUMN} > div > div:first-of-type h2 + div[dir]`),
    ['tweets', 'metrics'],
  ),
  toggle(
    'hideBookmarkButton',
    'Hide X’s bookmark button',
    'Remove X’s own bookmark button from posts in your timeline. Better X’s Save button stays, and so does the button on a post’s own page.',
    hide(
      `html:not([data-bx-route="bookmarks"]) ${TIMELINE_POST} ${ACTIONS} > div:has(> button[data-testid$="ookmark"])`,
    ),
    ['save'],
  ),
  toggle(
    'hideShareButton',
    'Hide the share button',
    'Remove the share button from posts and from the media viewer.',
    hide(
      `${TIMELINE_POST} ${ACTIONS} > div[style]${NOT_OURS}`,
      `${FOCUSED_POST} ${ACTIONS} > div[style]${NOT_OURS}`,
      `[aria-modal="true"] ${ACTIONS} > div[style]${NOT_OURS}:not([role])`,
    ),
    ['upload'],
  ),
  toggle(
    'hideViewActivity',
    'Hide “View post engagements”',
    'Remove the engagements link under your own posts and in post menus.',
    hide(
      `[role="menu"] a[href$="/quotes"]`,
      `html[data-bx-layout="narrow"] [role="dialog"] a[href$="/quotes"]`,
      `${FOCUSED_POST} div:has(> ${ACTIONS}[id^="id__"]) + div > div:has(a[href$="/quotes"])`,
    ),
    ['activity', 'quotes'],
  ),
  toggle(
    'hideSortReplies',
    'Hide “Sort replies”',
    'Remove the reply sorting menu on a post’s page.',
    hide(
      `${FOCUSED_POST} div:has(> ${ACTIONS}[id^="id__"]) + div > div:has(button[aria-haspopup="menu"])`,
    ),
    ['relevant', 'conversation'],
  ),
  toggle(
    'simplifyActions',
    'Simplify post actions',
    'Remove X’s reply, repost, like and share buttons from posts, leaving Better X’s Save and download buttons.',
    // Only a row that holds X's reply button is an action row; other groups inside a post are left alone.
    hide(`${POST} ${ACTIONS}:has(button[data-testid="reply"]) > ${NOT_OURS}`),
    ['reduced interaction', 'buttons', 'calm'],
  ),
  toggle(
    'hideVerifiedBadges',
    'Hide verification badges',
    'Remove the check marks beside names. Hides every kind of badge, not only Premium ones.',
    hide('svg[data-testid="icon-verified"]', '[data-testid="verificationBadge"]'),
    ['blue check', 'premium', 'verified'],
  ),
  color(
    'verifiedColor',
    'Verification badge color',
    'Recolor the check marks beside names. Applies to every kind of badge, including gold and gray ones.',
    0x1d9bf0,
    (value) => {
      const hex = `#${value.toString(16).padStart(6, '0')}`;
      return rule(
        ['svg[data-testid="icon-verified"]', 'svg[data-testid="icon-verified"] :is(g, path)'],
        `color: ${hex} !important;
  fill: ${hex} !important;`,
      );
    },
    ['blue check', 'premium', 'verified', 'colour', 'hex'],
  ),
  toggle(
    'plainText',
    'Plain post text',
    'Show post text without bold or italic styling.',
    rule(`div[data-testid="tweetText"] span`, 'font-style: normal;\n  font-weight: normal;'),
    ['formatting', 'bold', 'italic'],
  ),
];
