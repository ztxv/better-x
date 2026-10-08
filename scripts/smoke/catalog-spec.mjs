/**
 * What each customization feature must do on `catalog-fixture.mjs`: which elements it hides
 * (`hides`), which it must leave alone (`keeps`), and on which route, layout and sidebar state.
 * `style` scenarios check a computed value instead (sliders and type). Every feature appears at
 * least once, and every hiding feature has a decoy. Nothing here is a claim about live X.
 */
export const PATHS = {
  home: '/home',
  profile: '/u',
  notifications: '/notifications',
  explore: '/explore',
  search: '/search?q=a',
  post: '/u/status/1',
  settings: '/settings',
  communities: '/i/communities',
  community: '/i/communities/1',
  list: '/i/lists/1',
  bookmarks: '/i/bookmarks',
};

/** Link ids for one destination in the side nav, bottom bar, popup menu and More dialog. */
const places = (name) => ['nav', 'bar', 'menu', 'more'].map((place) => `${place}-${name}`);
const sheet = (name) => [`sheet-${name}`];
/** Ids that should never be touched by a place-hiding feature. */
const others = (...names) => names.flatMap((name) => places(name));

const s = (feature, name, rest) => ({ feature, name, ...rest });

export const SCENARIOS = [
  // ---- navigation
  s('navigation.hideExplore', 'with the sidebar', {
    hides: places('explore'),
    keeps: [...others('lists', 'settings'), ...sheet('explore')],
  }),
  s('navigation.hideExplore', 'narrow layout', {
    layout: 'narrow',
    hides: [...places('explore'), ...sheet('explore')],
    keeps: others('lists'),
  }),
  s('navigation.hideExplore', 'without the sidebar (search must stay reachable)', {
    sidebar: false,
    hides: [],
    keeps: [...places('explore'), ...sheet('explore')],
  }),
  s('navigation.hideCommunities', 'menus', {
    hides: places('communities'),
    keeps: [...others('lists', 'explore'), ...sheet('communities')],
  }),
  s('navigation.hideCommunities', 'narrow dialog', {
    layout: 'narrow',
    hides: [...places('communities'), ...sheet('communities')],
    keeps: others('lists'),
  }),
  s('navigation.hideLists', 'menus', {
    hides: places('lists'),
    keeps: [...others('communities', 'settings'), ...sheet('lists')],
  }),
  s('navigation.hideMessages', 'menus', {
    hides: [...places('messages'), ...places('chat')],
    keeps: [...others('notifications', 'settings'), ...sheet('messages')],
  }),
  s('navigation.hideNotifications', 'nav and More only', {
    hides: ['nav-notifications', 'bar-notifications', 'more-notifications'],
    keeps: [
      'menu-notifications',
      ...sheet('notifications'),
      'notif-tab-all',
      'notif-tab-mentions',
      ...others('messages', 'settings'),
    ],
  }),
  s('navigation.hideBadges', 'wide layout', {
    layout: 'wide',
    hides: ['nav-pip-live', 'hover-pip-live', 'dm-header-icon', 'acct-pip'],
    keeps: ['nav-pip-label', 'bar-pip-label', 'nav-notifications', 'sheet-pip', 'dash-pip'],
  }),
  s('navigation.hideBadges', 'narrow layout', {
    layout: 'narrow',
    hides: ['nav-pip-label', 'bar-pip-label', 'sheet-pip', 'dash-pip'],
    keeps: ['nav-pip-live', 'nav-notifications', 'hover-pip-live'],
  }),
  s('navigation.hideBookmarks', 'menus', {
    hides: places('bookmarks'),
    keeps: [...others('lists', 'settings'), ...sheet('bookmarks')],
  }),
  s('navigation.hidePremium', 'menus and hover card', {
    hides: [...places('premium'), ...places('verified'), 'menu-premium-signup', 'hover-premium'],
    keeps: [...others('business', 'orgs', 'settings'), ...sheet('premium')],
  }),
  s('navigation.hideBusiness', 'menus', {
    hides: [...places('business'), ...places('orgs')],
    keeps: [...others('premium', 'verified', 'settings'), ...sheet('business')],
  }),
  s('navigation.hideJobs', 'menus', {
    hides: places('jobs'),
    keeps: [...others('settings'), 'profile-jobs'],
  }),
  s('navigation.hideJobs', 'profile page', {
    route: 'profile',
    hides: [...places('jobs'), 'profile-jobs'],
    keeps: others('settings'),
  }),
  s('navigation.hideCreatorStudio', 'menus', {
    hides: places('creators'),
    keeps: [...others('settings'), 'settings-monetization', 'settings-subscriptions'],
  }),
  s('navigation.hideCreatorStudio', 'settings page', {
    route: 'settings',
    hides: [...places('creators'), 'settings-monetization', 'settings-subscriptions'],
    keeps: ['settings-privacy', ...others('settings')],
  }),
  s('navigation.hideConnect', 'menus', {
    hides: places('connect'),
    keeps: [...others('settings'), ...sheet('connect')],
  }),
  s('navigation.hideSpaces', 'menus', {
    hides: places('spaces'),
    keeps: [...others('settings'), ...sheet('spaces')],
  }),
  s('navigation.hideHistory', 'menus', {
    hides: places('history'),
    keeps: [...others('settings'), ...sheet('history')],
  }),
  s('navigation.hideComposeButton', 'both buttons', {
    hides: ['nav-post', 'fab-post'],
    keeps: ['nav-home', 'composer-wrap'],
  }),
  s('navigation.hideAccountSwitcher', 'avatar and name only', {
    hides: ['acct-avatar', 'acct-name'],
    keeps: ['account-switcher', 'acct-dots'],
  }),
  s('navigation.hideMessagesDrawer', 'the drawer', {
    hides: ['dm-drawer'],
    keeps: ['side-nav', 'primary'],
  }),

  // ---- home and feed
  s('feed.hideNewPostsPill', 'home', { hides: ['pill'], keeps: ['home-nav', 'inner-plain'] }),
  s('feed.hideNewPostsPill', 'other routes', { route: 'profile', hides: [], keeps: ['pill'] }),
  s('feed.hidePostBox', 'home', { hides: ['composer-wrap'], keeps: ['inner-plain', 'nav-post'] }),
  s('feed.hidePostBox', 'other routes', { route: 'profile', hides: [], keeps: ['composer-wrap'] }),
  s('feed.hideManageTimelines', 'home', {
    hides: ['manage-timelines'],
    keeps: ['not-manage', 'tabs-wrap', 'home-nav'],
  }),
  s('feed.hideInlinePrompts', 'anywhere', {
    hides: ['inner-prompt'],
    keeps: ['inner-plain', 'inner-plain-text', 'inner-wtf-heading'],
  }),
  s('feed.hideSuggestedModules', 'home', {
    hides: ['inner-wtf-heading', 'inner-wtf-user', 'inner-wtf-more'],
    keeps: ['inner-heading-post', 'inner-plain', 'inner-plain-text', 'inner-prompt'],
  }),
  s('feed.hideSuggestedModules', 'other routes', {
    route: 'profile',
    hides: [],
    keeps: ['inner-wtf-heading', 'inner-wtf-user', 'inner-wtf-more'],
  }),
  s('feed.hideProfileSuggestions', 'profile', {
    route: 'profile',
    hides: ['profile-aside'],
    keeps: ['profile-name', 'inner-plain'],
  }),
  s('feed.hideProfileSuggestions', 'home', { hides: [], keeps: ['profile-aside'] }),
  s('feed.hideExploreContents', 'explore', {
    route: 'explore',
    hides: ['explore-tabs', 'explore-content', 'mobile-tabs'],
    keeps: ['explore-search', 'primary'],
  }),
  s('feed.hideExploreContents', 'other routes', {
    hides: [],
    keeps: ['explore-tabs', 'explore-content', 'mobile-tabs'],
  }),
  s('feed.hideReposts', 'home', {
    hides: ['inner-repost'],
    keeps: ['inner-plain', 'inner-pinned', 'inner-community', 'inner-grokshare'],
  }),
  s('feed.hideReposts', 'other routes', { route: 'profile', hides: [], keeps: ['inner-repost'] }),
  s('feed.hideProfileReposts', 'profile (pinned and community stay)', {
    route: 'profile',
    hides: ['inner-repost'],
    keeps: ['inner-plain', 'inner-pinned', 'inner-community'],
  }),
  s('feed.hideProfileReposts', 'home', { hides: [], keeps: ['inner-repost'] }),
  s('feed.hideNotificationLikes', 'notifications', {
    route: 'notifications',
    hides: ['inner-notif-like'],
    keeps: ['inner-notif-repost', 'inner-notif-follow', 'inner-notif-ad', 'inner-plain'],
  }),
  s('feed.hideNotificationReposts', 'notifications', {
    route: 'notifications',
    hides: ['inner-notif-repost'],
    keeps: ['inner-notif-like', 'inner-notif-follow', 'inner-notif-ad'],
  }),

  // ---- posts
  s('posts.hideViews', 'timeline, post page and media viewer', {
    hides: ['views-wrap-1', 'views-wrap-2', 'modal-views-wrap', 'permalink-dot', 'permalink-views'],
    keeps: ['like-wrap-1', 'reply-wrap-1', 'share-wrap-1', 'permalink', 'modal-share-wrap'],
  }),
  s('posts.hideReplyCount', 'counts only', {
    hides: ['reply-count-1', 'reply-count-2', 'reply-count-f'],
    keeps: ['reply-1', 'like-count-1', 'repost-count-1', 'bookmark-count-1'],
  }),
  s('posts.hideRepostCount', 'counts only', {
    hides: ['repost-count-1', 'repost-count-f'],
    keeps: ['repost-1', 'reply-count-1', 'like-count-1'],
  }),
  s('posts.hideLikeCount', 'counts only', {
    hides: ['like-count-1', 'like-count-f'],
    keeps: ['like-1', 'reply-count-1', 'repost-count-1'],
  }),
  s('posts.hideBookmarkCount', 'counts only', {
    hides: ['bookmark-count-1', 'bookmark-count-f'],
    keeps: ['bookmark-1', 'like-count-1', 'reply-count-1'],
  }),
  s('posts.hideFollowCounts', 'profile and hover card', {
    route: 'profile',
    hides: ['profile-following-count', 'profile-followers-count', 'hover-following-count'],
    keeps: ['profile-following', 'profile-followers', 'profile-subs'],
  }),
  s('posts.hideFollowCounts', 'home: only the hover card', {
    hides: ['hover-following-count'],
    keeps: ['profile-following-count', 'profile-followers-count'],
  }),
  s('posts.hidePostCount', 'profile', {
    route: 'profile',
    hides: ['post-count'],
    keeps: ['profile-name', 'inner-plain'],
  }),
  s('posts.hidePostCount', 'home', { hides: [], keeps: ['post-count'] }),
  s('posts.hideBookmarkButton', 'timeline posts only', {
    hides: ['bookmark-wrap-1', 'bookmark-wrap-2'],
    keeps: ['like-wrap-1', 'reply-wrap-1', 'bookmark-wrap-f'],
  }),
  s('posts.hideBookmarkButton', 'bookmarks page', {
    route: 'bookmarks',
    hides: [],
    keeps: ['bookmark-wrap-1'],
  }),
  s('posts.hideShareButton', 'timeline, post page and media viewer', {
    hides: ['share-wrap-1', 'share-wrap-f', 'modal-share-wrap'],
    keeps: ['like-wrap-1', 'reply-wrap-1', 'views-wrap-1', 'modal-views-wrap'],
  }),
  s('posts.hideViewActivity', 'menu and post page', {
    hides: ['menu-quotes', 'activity-wrap'],
    keeps: ['sort-wrap', 'subscribe-wrap', 'menu-analytics', ...sheet('quotes')],
  }),
  s('posts.hideViewActivity', 'narrow dialog', {
    layout: 'narrow',
    hides: ['menu-quotes', 'sheet-quotes', 'activity-wrap'],
    keeps: ['sort-wrap'],
  }),
  s('posts.hideSortReplies', 'post page', {
    hides: ['sort-wrap'],
    keeps: ['activity-wrap', 'subscribe-wrap'],
  }),
  s('posts.simplifyActions', 'X’s buttons go, Better X’s stay', {
    hides: [
      'reply-wrap-1',
      'repost-wrap-1',
      'like-wrap-1',
      'views-wrap-1',
      'bookmark-wrap-1',
      'share-wrap-1',
      'reply-wrap-f',
    ],
    keeps: ['inner-plain', 'permalink', 'modal-views-wrap'],
    saveControlsVisible: true,
  }),
  s('posts.hideVerifiedBadges', 'every badge', {
    hides: ['badge', 'focus-badge'],
    keeps: ['subscriber-badge', 'inner-plain'],
  }),
  s('posts.plainText', 'post text', {
    style: { target: '#imagine-text span', prop: 'fontStyle', off: 'italic', on: 'normal' },
  }),

  // ---- sidebar
  s('sidebar.hideSidebar', 'the column', { hides: ['sidebar'], keeps: ['primary', 'side-nav'] }),
  s('sidebar.keepOnlySearch', 'home', {
    hides: [
      'sec-news',
      'sec-trends',
      'sec-wtf',
      'sec-premium',
      'sec-super',
      'sec-other',
      'sec-footer',
    ],
    keeps: ['sec-search', 'primary'],
  }),
  s('sidebar.keepOnlySearch', 'search results keep the second section', {
    route: 'search',
    hides: ['sec-trends', 'sec-wtf', 'sec-premium', 'sec-super', 'sec-other', 'sec-footer'],
    keeps: ['sec-search', 'sec-news'],
  }),
  s('sidebar.keepOnlySearch', 'community keeps the third section', {
    route: 'community',
    hides: ['sec-news', 'sec-wtf', 'sec-premium', 'sec-super', 'sec-other', 'sec-footer'],
    keeps: ['sec-search', 'sec-trends'],
  }),
  s('sidebar.hideWhatsHappening', 'trends', {
    hides: ['sec-trends'],
    keeps: ['sec-search', 'sec-news', 'sec-wtf', 'sec-premium', 'sec-other'],
  }),
  s('sidebar.hideTodaysNews', 'news', {
    hides: ['sec-news'],
    keeps: ['sec-search', 'sec-trends', 'sec-wtf'],
  }),
  s('sidebar.hideWhoToFollow', 'home', {
    hides: ['sec-wtf'],
    keeps: ['sec-search', 'sec-premium', 'sec-other', 'sec-trends'],
  }),
  s('sidebar.hideWhoToFollow', 'post page keeps Relevant people', {
    route: 'post',
    hides: [],
    keeps: ['sec-wtf'],
  }),
  s('sidebar.hidePremiumPromo', 'premium cards', {
    hides: ['sec-premium', 'sec-super'],
    keeps: ['sec-search', 'sec-wtf', 'sec-other', 'sec-trends'],
  }),
  s('sidebar.hideFooter', 'footer links', {
    hides: ['footer-nav'],
    keeps: ['sec-search', 'sec-other'],
  }),

  // ---- appearance (sliders and type); a slider scenario also runs at min, default and max
  s('appearance.timelineWidth', 'home', {
    slider: {
      target: '#primary',
      prop: 'maxWidth',
      off: '600px',
      on: (v) => `${v}px`,
      min: 500,
      max: 1000,
      def: 700,
    },
  }),
  s('appearance.timelineWidth', 'a page it does not widen', {
    route: 'profile',
    slider: {
      target: '#primary',
      prop: 'maxWidth',
      off: '600px',
      on: () => '600px',
      min: 500,
      max: 1000,
      def: 700,
    },
  }),
  s('appearance.sidebarWidth', 'the column', {
    slider: {
      target: '#sidebar',
      prop: 'width',
      off: '350px',
      on: (v) => `${v}px`,
      min: 250,
      max: 450,
      def: 350,
    },
  }),
  s('appearance.navSpacing', 'menu item padding', {
    slider: {
      target: '#nav-explore > div',
      prop: 'paddingTop',
      off: '12px',
      on: (v) => `${v}px`,
      min: 0,
      max: 12,
      def: 6,
    },
  }),
  s('appearance.navTextSize', 'menu labels', {
    slider: {
      target: '#nav-explore span',
      prop: 'fontSize',
      off: '20px',
      on: (v) => `${v}px`,
      min: 12,
      max: 20,
      def: 15,
    },
  }),
  s('appearance.postTextSize', 'post text', {
    slider: {
      target: '#imagine-text span',
      prop: 'fontSize',
      off: '15px',
      on: (v) => `${v}px`,
      min: 13,
      max: 22,
      def: 16,
    },
  }),
  s('appearance.systemFont', 'the whole page', {
    style: {
      target: '#imagine-text',
      prop: 'fontFamily',
      off: (v) => !v.includes('system-ui'),
      on: (v) => v.startsWith('system-ui'),
    },
  }),
  s('appearance.lighterMenuText', 'popup menus', {
    style: { target: '#dropdown-text', prop: 'fontWeight', off: '700', on: '400' },
  }),

  // ---- ads, Grok and Premium
  s('cleanup.hideAds', 'promoted notifications', {
    route: 'notifications',
    hides: ['inner-notif-ad'],
    keeps: ['inner-notif-like', 'inner-notif-repost', 'inner-notif-follow'],
  }),
  s('cleanup.hideGrokImageEdit', 'entry points', {
    hides: ['imagine-image', 'imagine-text-link', 'menu-imagine', 'modal-imagine'],
    keeps: ['plain-link', 'imagine-text', 'menu-quotes'],
  }),
  s('cleanup.hideGrokPosts', 'posts that share a Grok chat', {
    hides: ['inner-grokshare'],
    keeps: ['inner-plain', 'inner-repost', 'inner-heading-post'],
  }),
  s('cleanup.hidePremiumUpsells', 'menus, composer', {
    hides: [
      'menu-analytics',
      'menu-premium-signup',
      'menu-highlight',
      'menu-edit',
      'composer-upsell',
    ],
    keeps: [
      'composer-status',
      'menu-quotes',
      'settings-premium',
      'profile-premium-link',
      'nav-premium',
    ],
  }),
  s('cleanup.hidePremiumUpsells', 'narrow dialog', {
    layout: 'narrow',
    hides: ['menu-premium-signup', 'sheet-premium-signup'],
    keeps: ['composer-status'],
  }),
  s('cleanup.hidePremiumUpsells', 'settings', {
    route: 'settings',
    hides: ['settings-premium'],
    keeps: ['settings-privacy', 'settings-monetization'],
  }),
  s('cleanup.hidePremiumUpsells', 'profile', {
    route: 'profile',
    hides: [
      'profile-premium-link',
      'profile-analytics',
      'profile-verified-upsell',
      'profile-analytics-upsell',
      'profile-visitor-upsell',
      'likes-upsell',
    ],
    keeps: ['profile-following', 'likes-other', 'profile-other-button'],
  }),
  s('cleanup.hidePremiumUpsells', 'communities', {
    route: 'communities',
    hides: ['communities-premium'],
    keeps: ['communities-other'],
  }),
  s('cleanup.hideSubscriptions', 'profile', {
    route: 'profile',
    hides: [
      'profile-subs',
      'profile-subscribe',
      'tab-subs',
      'tab-subscriptions',
      'focus-subscribe',
      'dropdown-subscribe',
      'subscriber-badge',
    ],
    keeps: ['profile-other-button', 'tab-posts', 'profile-following', 'subscribe-wrap'],
  }),
  s('cleanup.hideSubscriptions', 'home: menus and posts only', {
    hides: ['focus-subscribe', 'dropdown-subscribe', 'subscriber-badge'],
    keeps: ['profile-subs', 'profile-subscribe', 'tab-subs'],
  }),
  s('cleanup.hideVerifiedFollowersTab', 'profile', {
    route: 'profile',
    hides: ['tab-verified'],
    keeps: ['tab-followers', 'notif-tab-all'],
  }),
];

/** Features covered by other checks: Hide Ads / Grok / For You have their own sections. */
export const COVERED_ELSEWHERE = new Set(['cleanup.hideGrok', 'feed.hideForYou']);
