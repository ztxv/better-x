import { post } from './fixture.mjs';

/**
 * An X-shaped page with a target and a decoy for every customization feature, in the shapes
 * Control Panel for Twitter's selectors describe (test IDs, hrefs, icon paths, nesting). Every
 * element a feature should touch or leave alone has an id, and `catalog-spec.mjs` says which.
 * A real browser decides what is visible, so the checks prove the rules on this markup, not
 * compatibility with live X.
 */
const svg = (d = 'M1 1h22v22H1z') =>
  `<svg viewBox="0 0 24 24" width="18" height="18"><path d="${d}"/></svg>`;

const REPOST_ICON = 'M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5';
const PINNED_ICON = 'M13 21l-1 2-1-2v-5H4.5v-2.287l2-2z';
const COMMUNITY_ICON = 'M7.471 21H.472l.029-1.027c.184-4 2-6 4-6z';
const NOTIF_LIKE = 'M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3z';
const NOTIF_REPOST = 'M4.75 3.79l4.603 4.3-1.706 1.8L5.75 7.97V16z';
const NOTIF_FOLLOW = 'M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1z';
const NOTIF_AD = 'M18.766 2H7.323l-4.8 12h5.324l-1.5 8z';
const MANAGE_PLUS = 'M11 11V4h2v7h7v2h-7v7h-2v-7H4v-2h7z';

/** An action row the way X lays it out, with a count under each button and an inline-styled share. */
export const actionRow = (
  n,
) => `<div role="group" id="row-${n}" style="display:flex;max-width:460px">
  <div id="reply-wrap-${n}"><button data-testid="reply" id="reply-${n}">${svg()}<span id="reply-count-${n}">12</span></button></div>
  <div id="repost-wrap-${n}"><button data-testid="retweet" id="repost-${n}">${svg()}<span id="repost-count-${n}">3</span></button></div>
  <div id="like-wrap-${n}"><button data-testid="like" id="like-${n}">${svg()}<span id="like-count-${n}">45</span></button></div>
  <div id="views-wrap-${n}"><a href="/u/status/${n}/analytics" id="views-${n}">${svg()}<span>1.2K</span></a></div>
  <div id="bookmark-wrap-${n}"><button data-testid="bookmark" id="bookmark-${n}">${svg()}<span id="bookmark-count-${n}">2</span></button></div>
  <div id="share-wrap-${n}" style="display:inline-flex"><button data-testid="share" id="share-${n}">${svg()}</button></div>
</div>`;

export const tweetArticle = (html, attrs = 'data-testid="tweet" tabindex="0"') =>
  html.replace('<article ', `<article ${attrs} `);

export const cell = (id, inner) =>
  `<div data-testid="cellInnerDiv" id="cell-${id}"><div id="inner-${id}">${inner}</div></div>`;

const social = (id, icon, text) =>
  `<div data-testid="socialContext" id="social-${id}">${svg(icon)}<span>${text}</span></div>`;

/** A timeline post (X's tabindex 0), optionally with extra content inside the article. */
const timelinePost = (id, n, extra = '', rowHtml = actionRow(n)) =>
  cell(
    id,
    tweetArticle(
      post({
        id: String(1300000000000000000n + BigInt(n)),
        handle: `user${n}`,
        text: `Post ${id}`,
        media: extra,
        rowHtml,
      }),
    ),
  );

const navItem = (id, href, label, extra = '') =>
  `<a id="${id}" href="${href}"><div dir="ltr"><span>${label}</span></div>${extra}</a>`;

/** Links to the places X lets you hide, used in the nav, menus, the narrow dialog and More. */
const placeLinks = (p) => `
  ${navItem(`${p}-explore`, '/explore', 'Explore')}
  ${navItem(`${p}-communities`, '/u/communities', 'Communities')}
  ${navItem(`${p}-lists`, '/u/lists', 'Lists')}
  ${navItem(`${p}-messages`, '/messages', 'Messages')}
  ${navItem(`${p}-chat`, '/i/chat', 'Chat')}
  ${navItem(`${p}-notifications`, '/notifications', 'Notifications')}
  ${navItem(`${p}-bookmarks`, '/i/bookmarks', 'Bookmarks')}
  ${navItem(`${p}-premium`, '/i/premium_sign_up', 'Premium')}
  ${navItem(`${p}-verified`, '/i/verified-choose', 'Verified')}
  ${navItem(`${p}-business`, '/i/premium-business', 'Business')}
  ${navItem(`${p}-orgs`, '/i/verified-orgs-signup', 'Orgs')}
  ${navItem(`${p}-jobs`, '/jobs', 'Jobs')}
  ${navItem(`${p}-creators`, '/u/creators/studio', 'Creator Studio')}
  ${navItem(`${p}-connect`, '/i/connect_people', 'Connect')}
  ${navItem(`${p}-spaces`, '/i/spaces/start', 'Spaces')}
  ${navItem(`${p}-calls`, '/i/calls', 'Calls')}
  ${navItem(`${p}-history`, '/i/history', 'History')}
  ${navItem(`${p}-money`, '/i/money', 'X Money')}
  ${navItem(`${p}-articles`, '/i/articles', 'Articles')}
  ${navItem(`${p}-money-text`, '/i/some_new_money_page', 'Money')}
  ${navItem(`${p}-articles-text`, '/i/some_new_reading_page', 'Articles')}
  ${navItem(`${p}-settings`, '/settings', 'Settings')}
  ${navItem(`${p}-home`, '/home', 'Home')}`;

export const CATALOG_POSTS = 5;

/**
 * The catalog page. `timeline` replaces the timeline's cells and `extras: false` leaves out the
 * notifications, the post's own page and the other one-off sections, which is how the performance
 * harness gets an X-shaped shell around a long timeline.
 */
export function catalogPage({ timeline, extras = true } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>X catalog fixture</title></head>
  <body style="margin:0;background:#fff;color:#0f1419;font-family:Georgia,serif">
  <style>
    #bx-app{display:flex}#bx-app.app-narrow{flex-direction:column}
    [role="tablist"]{display:flex}
    [data-testid="primaryColumn"]{max-width:600px;width:100%;flex-shrink:0}
    [data-testid="sidebarColumn"]{width:350px;flex-shrink:0}
    .card{border:1px solid #ccc;border-radius:12px;padding:12px;margin-bottom:16px}
    header nav>a{display:block;padding:4px 0}
    header nav>a>div{padding:12px}
    header nav span{font-size:20px;font-weight:700}
    [data-testid="tweetText"]{font-size:15px;line-height:20px}
    [data-testid="tweetText"] span{font-size:15px;font-style:italic;font-weight:700}
    [data-testid="Dropdown"] [dir]{font-weight:700}
  </style>
  <div id="layers">
    <nav id="bottom-nav">${placeLinks('bar')}
      <a id="bar-pip-notifications" href="/notifications/pips"><div aria-label="3 unread" id="bar-pip-label">3</div></a>
    </nav>
    <div role="menu" id="menu">${placeLinks('menu')}
      <a id="menu-quotes" href="/u/status/1/quotes">View post engagements</a>
      <a id="menu-analytics" href="/i/account_analytics">Analytics</a>
      <a id="menu-premium-signup" href="/i/premium_sign_up?x">Subscribe</a>
      <div role="menuitem" data-testid="highlightUpsell" id="menu-highlight">Highlight</div>
      <div role="menuitem" data-testid="editWithPremium" id="menu-edit">Edit</div>
      <a role="menuitem" id="menu-imagine" href="https://grok.com/imagine/x">Imagine</a>
    </div>
    <div role="dialog" id="sheet">${placeLinks('sheet')}
      <a id="sheet-quotes" href="/u/status/1/quotes">View post engagements</a>
      <a id="sheet-premium-signup" href="/i/premium_sign_up?x">Subscribe</a>
      <div data-testid="UserAvatar-Container-x"><div dir="ltr" id="sheet-pip">1</div></div>
    </div>
    <button data-testid="DashButton_ProfileIcon_Link" id="dash-button"><div aria-label="1" id="dash-pip">1</div></button>
    <a data-testid="FloatingActionButtons_Tweet_Button" id="fab-post" href="/compose/post">Post</a>
    <div aria-labelledby="modal-header" id="more">${placeLinks('more')}</div>
    <div data-testid="HoverCard" id="hovercard">
      <a id="hover-premium" href="/i/premium_sign_up">Premium</a>
      <a id="hover-following" href="/u/following"><span id="hover-following-count">12</span><span> Following</span></a>
      <button data-testid="UserCell"><div aria-live="polite" id="hover-pip-live">1</div></button>
    </div>
    <div data-testid="Dropdown" id="dropdown"><div role="menuitem" id="dropdown-item"><div dir="ltr" id="dropdown-text">Menu item</div></div>
      <div data-testid="subscribe" id="dropdown-subscribe">Subscribe to @u</div></div>
    <div data-testid="DMDrawer" id="dm-drawer">Messages</div>
    <div data-testid="DMDrawerHeader"><h2>Messages<svg role="img" id="dm-header-icon" width="10" height="10"></svg></h2></div>
    <div aria-modal="true" id="media-modal"><div><div>
      <div role="group" id="modal-group"><div id="modal-views-wrap"><a href="/u/status/9/analytics" id="modal-views">v</a></div>
        <div id="modal-share-wrap" style="display:inline-flex"><button id="modal-share">s</button></div></div>
      <a id="modal-imagine" href="/i/imagine/y">Edit image</a>
    </div></div></div>
  </div>
  <div id="bx-app" class="app-wide">
    <header role="banner"><div><div><div>
      <nav id="side-nav">${placeLinks('nav')}
        <a id="nav-pip-notifications" href="/notifications/pips"><div aria-live="polite" id="nav-pip-live">3</div><div aria-label="3 unread" id="nav-pip-label">3</div></a>
        <div data-testid="AppTabBar_More_Menu" id="nav-more"><div>More</div></div>
        <a data-testid="SideNav_NewTweet_Button" id="nav-post" href="/compose/post">Post</a>
      </nav>
      <div><button data-testid="SideNav_AccountSwitcher_Button" id="account-switcher">
        <div id="acct-avatar">A</div><div id="acct-name">Name @handle</div><div id="acct-dots">…</div>
        <div id="acct-pip-outer"><div aria-label="1 new" id="acct-pip">1</div></div>
      </button></div>
    </div></div></div></header>
    <div data-testid="primaryColumn" id="primary"><div id="col">
      <div id="hdr">
        <div id="pill" style="transform: translateY(0px)">Show 12 posts</div>
        <div id="tabs-wrap"><nav id="home-nav"><div role="tablist"><div><a role="tab" href="/home" aria-selected="false">For you</a></div><div><a role="tab" href="/home" aria-selected="true">Following</a></div></div></nav></div>
        <div id="manage-timelines">${svg(MANAGE_PLUS)}</div>
        <div id="not-manage">${svg('M1 1h2')}</div>
        <nav id="explore-tabs"><div role="tablist"><div><a role="tab" href="/explore">For you</a></div></div></nav>
        <nav id="profile-tabs"><div role="tablist"><div><a id="profile-articles-tab" role="tab" href="/u/articles">Articles</a></div></div></nav>
        <div id="explore-search"><input type="search" placeholder="Search"></div>
        <h2 role="heading" id="profile-name">Name</h2><div dir="ltr" id="post-count">1,234 posts</div>
      </div>
      <div id="composer-wrap"><div data-testid="tweetTextarea_0" class="DraftEditor-root" id="composer-box">What is happening?</div></div>
      <div id="top-bar" data-testid="TopNavBar"><div><div>x</div><div id="mobile-tabs">tabs</div></div></div>
      <div id="profile-tabs-wrap"><nav id="profile-nav"><div id="tab-posts"><a href="/u">Posts</a></div>
        <div id="tab-subs"><a href="/u/superfollows">Subscriptions</a></div>
        <div id="tab-subscriptions"><a href="/u/subscriptions">Subscriptions</a></div></nav></div>
      <nav id="follow-tabs"><div id="tab-verified"><a href="/u/verified_followers">Verified Followers</a></div><div id="tab-followers"><a href="/u/followers">Followers</a></div></nav>
      <nav id="notif-tabs"><div id="notif-tab-all"><a href="/notifications">All</a></div><div id="notif-tab-mentions"><a href="/notifications/mentions">Mentions</a></div></nav>
      <div id="spacer"></div>
      <div id="profile-links">
        <a id="profile-following" href="/u/following"><span id="profile-following-count">120</span><span> Following</span></a>
        <a id="profile-followers" href="/u/verified_followers"><span id="profile-followers-count">9,000</span><span> Followers</span></a>
        <a id="profile-subs" href="/u/creator-subscriptions/subscriptions">3 subscriptions</a>
        <div role="button" id="profile-subscribe" style="border-color: rgb(201, 54, 204)">Subscribe</div>
        <div role="button" id="profile-other-button" style="border-color: rgb(1, 2, 3)">Follow</div>
        <div data-testid="jobs" id="profile-jobs">Jobs</div>
        <aside role="complementary" id="profile-aside">You might like</aside>
        <a id="profile-premium-link" href="/i/premium_sign_up">Get Premium</a>
        <div data-testid="analytics-preview" id="profile-analytics">Analytics</div>
        <div data-testid="verified_profile_upsell" id="profile-verified-upsell">Verify</div>
        <div data-testid="profileAnalyticsUpsell" id="profile-analytics-upsell">Analytics upsell</div>
        <div data-testid="verified_profile_visitor_upsell" id="profile-visitor-upsell">Not verified</div>
      </div>
      <nav id="likes-nav"></nav><div id="likes-upsell"><a href="/i/premium">Upsell</a></div>
      <nav id="other-nav"></nav><div id="likes-other"><a href="/x">Other</a></div>
      <div id="communities-links"><a id="communities-premium" href="/i/premium">Premium</a><a id="communities-other" href="/i/communities/1">A community</a></div>
      <div id="settings-links"><a id="settings-monetization" href="/settings/monetization">Monetization</a>
        <a id="settings-subscriptions" href="/settings/manage_subscriptions">Subscriptions</a>
        <a id="settings-privacy" href="/settings/privacy">Privacy</a>
        <a id="settings-premium" href="/i/premium_sign_up">Premium</a></div>
      <div aria-live="polite" role="status" id="composer-upsell"><a href="/i/premium_sign_up">Upgrade</a></div>
      <div aria-live="polite" role="status" id="composer-status"><span>Posting…</span></div>
      <div id="explore-section-wrap"><section><h1>Explore</h1><div aria-label="Timeline: Explore"><div id="explore-content">Trending</div></div></section></div>
      <div id="timeline">${
        timeline ??
        `
        ${timelinePost('plain', 1)}
        ${timelinePost('repost', 2, social('repost', REPOST_ICON, 'You reposted'))}
        ${timelinePost('pinned', 3, social('pinned', PINNED_ICON, 'Pinned'))}
        ${timelinePost('community', 4, social('community', COMMUNITY_ICON, 'Community'))}
        ${timelinePost('grokshare', 5, '<a id="grok-share" href="/i/grok/share/abc">Grok chat</a>')}
        ${cell('prompt', '<div data-testid="inlinePrompt" id="prompt">Subscribe to Premium</div>')}
        ${cell('wtf-heading', '<h2 role="heading" id="wtf-heading">Who to follow</h2>')}
        ${cell('wtf-user', '<div data-testid="UserCell" id="wtf-user">Someone</div>')}
        ${cell('wtf-more', '<a href="/i/connect_people?x" id="wtf-more">Show more</a>')}
        ${cell('heading-post', `<h2 role="heading" id="heading-post-title">A thread</h2>${tweetArticle(post({ id: '1400000000000000001', handle: 'threader', text: 'Post with a heading in its cell' }))}`)}
        ${cell('plain-text', '<div id="plain-text-content"><div>Just a cell of text</div></div>')}
      `
      }</div>
      ${
        extras
          ? `
      <div id="notifications">
        ${cell('notif-like', `<div data-testid="notification">${svg(NOTIF_LIKE)}Someone liked your post</div>`)}
        ${cell('notif-repost', `<div data-testid="notification">${svg(NOTIF_REPOST)}Someone reposted your post</div>`)}
        ${cell('notif-follow', `<div data-testid="notification">${svg(NOTIF_FOLLOW)}Someone followed you</div>`)}
        ${cell('notif-ad', `<div data-testid="notification">${svg(NOTIF_AD)}Promoted</div>`)}
      </div>
      <div id="focused">
        ${tweetArticle(
          post({
            id: '1500000000000000001',
            handle: 'focus',
            text: 'The post at the top of its own page',
            rowHtml: '',
          }).replace(
            '</article>',
            `<div id="permalink"><div><a href="/focus/status/1500000000000000001"><time datetime="2025-03-21T10:32:00Z">10:32 AM · Mar 21, 2025</time></a></div><div id="permalink-dot">·</div><div id="permalink-views">1.2M Views</div></div>
            <div id="actionbar-wrap">${actionRow('f').replace('role="group"', 'role="group" id="id__focused"').replace('id="row-f"', '')}</div>
            <div id="under-bar"><div id="sort-wrap"><button aria-haspopup="menu" id="sort-button">Relevant</button></div>
              <div id="activity-wrap"><a href="/focus/status/1500000000000000001/quotes" id="activity-link">View post engagements</a></div>
              <div id="subscribe-wrap"><button data-testid="focus-subscribe" id="focus-subscribe">Subscribe</button></div></div>
            <div data-testid="verificationBadge" id="focus-badge"></div></article>`,
          ),
          'data-testid="tweet" tabindex="-1"',
        )}
      </div>
`
          : ''
      }
      <div id="badges"><svg data-testid="icon-verified" id="badge" width="12" height="12"></svg></div>
      <div id="imagine"><div data-testid="tweet" id="imagine-post"><span data-testid="icon-subscriber" id="subscriber-badge">sub</span><div aria-labelledby="x" id="imagine-wrap"><a id="imagine-image" href="/i/imagine/z">Edit image</a></div>
        <div data-testid="tweetText" id="imagine-text"><span>text </span><a id="imagine-text-link" href="https://grok.com/imagine/q">Imagine</a><a id="plain-link" href="https://example.com">link</a></div></div></div>
    </div></div>
    <aside data-testid="sidebarColumn" id="sidebar"><div><div><div><div><div id="sections">
      <div id="sec-search"><div role="search">Search</div></div>
      <div id="sec-news"><div data-testid="news_sidebar">News</div></div>
      <div id="sec-trends"><section><div aria-label="Timeline: Trending now"><div><div data-testid="trend" id="side-trend">#news</div></div></div></section></div>
      <div id="sec-wtf" class="card"><div><div><aside role="complementary" id="aside-wtf"><h2>Who to follow</h2><div data-testid="UserCell">Someone to follow</div></aside></div></div></div>
      <div id="sec-premium" class="card"><div><aside role="complementary" id="aside-premium"><a href="/i/premium_sign_up">Subscribe to Premium</a></aside></div></div>
      <div id="sec-super" class="card"><div><div data-testid="super-upsell-UpsellCardRenderProperties" id="super-card">Upsell</div></div></div>
      <div id="sec-other" class="card"><aside role="complementary" id="aside-other"><a href="https://example.com/">Something else</a></aside></div>
      <div id="sec-footer"><nav aria-label="Footer" id="footer-nav"><a href="/tos">Terms</a></nav></div>
    </div></div></div></div></div></aside>
  </div>
  <script>
    const app = () => document.getElementById('bx-app');
    const fit = () => app() && (app().className = innerWidth < 500 ? 'app-narrow' : 'app-wide');
    addEventListener('resize', fit); fit();
  </script></body></html>`;
}
