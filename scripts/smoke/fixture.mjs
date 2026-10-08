const icon =
  '<svg viewBox="0 0 24 24" width="18.75" height="18.75"><path d="M1 1h22v22H1z"/></svg>';
const row =
  () => `<div role="group" style="display:flex;justify-content:space-between;max-width:420px">
  ${['reply', 'retweet', 'like', 'bookmark', 'share'].map((id) => `<div><button data-testid="${id}" style="width:34px;height:34px;background:none;border:0">${icon}</button></div>`).join('')}
</div>`;
const avatar = (n) =>
  `<div data-testid="Tweet-User-Avatar"><img width="40" src="https://pbs.twimg.com/profile_images/1661201415899951105/azNjKOSH_normal.jpg" alt="${n}"></div>`;
export function post({ id, handle, text, media = '', quote = '' }) {
  return `<article style="padding:12px;border-bottom:1px solid #eee" data-post="${id}">
    ${avatar(handle)}
    <div data-testid="User-Name"><a href="https://x.com/${handle}">${handle} Name</a><span>@${handle}</span></div>
    <a href="https://x.com/${handle}/status/${id}"><time datetime="2024-03-21T00:00:00Z">Mar 21</time></a>
    <div data-testid="tweetText">${text}</div>
    ${media}${quote}
    ${row()}
  </article>`;
}
export const photo = (mediaId, n = 1, id = 0, handle = 'x') =>
  `<a href="https://x.com/${handle}/status/${id}/photo/${n}"><img width="160" src="https://pbs.twimg.com/media/${mediaId}?format=jpg&name=small"></a>`;
export const video = (poster, src) =>
  `<div><div><video width="200" poster="${poster}" src="${src}"></video></div></div>`;
export const quoteBlock = ({
  id,
  handle,
  text,
  media,
}) => `<div role="link" style="border:1px solid #ccc;margin:8px;padding:8px">
  <div data-testid="User-Name"><a href="https://x.com/${handle}">${handle}</a><span>@${handle}</span></div>
  <a href="https://x.com/${handle}/status/${id}"><time datetime="2022-10-26T18:45:58Z"></time></a>
  <div data-testid="tweetText">${text}</div>${media}</div>`;

export const ELON = '1585341984679469056';
export const ELON_THUMB =
  'https://pbs.twimg.com/ext_tw_video_thumb/1585341912877146112/pu/img/DwJ7wlGIe9iryk6N.jpg';
export function page(theme = 'light') {
  const bg = theme === 'dark' ? '#000' : '#fff';
  return `<!doctype html><html><head><meta charset="utf-8"><title>X fixture</title></head>
  <body style="margin:0;background:${bg};color:${theme === 'dark' ? '#e7e9ea' : '#0f1419'};font-family:sans-serif">
  <style>#bx-app{display:flex}#bx-app.app-narrow{flex-direction:column}</style>
  <div id="layers"></div>
  <div id="bx-app" class="app-wide">
  <main style="width:600px;margin:0 auto">
  ${post({ id: '1100000000000000001', handle: 'texter', text: 'Text only post' })}
  ${post({ id: '440322224407314432', handle: 'TheEllenShow', text: 'Real photo', media: photo('BhxWutnCEAAtEQ6', 1, '440322224407314432', 'TheEllenShow') })}
  ${post({ id: '1100000000000000003', handle: 'gifposter', text: 'Real GIF', media: video('https://pbs.twimg.com/tweet_video_thumb/EC6DSXDXsAEhHAa.jpg', 'https://video.twimg.com/tweet_video/EC6DSXDXsAEhHAa.mp4') })}
  ${post({ id: ELON, handle: 'elonmusk', text: 'Real video behind a blob player', media: video(ELON_THUMB, 'blob:https://x.com/0b5e') })}
  ${post({ id: '1100000000000000005', handle: 'batch', text: 'Two photos, one gone', media: photo('BhxWutnCEAAtEQ6', 1, '1100000000000000005', 'batch') + photo('ZZnotARealMediaId0', 2, '1100000000000000005', 'batch') })}
  ${post({ id: '1100000000000000006', handle: 'quoter', text: 'Parent photo quoting a video', media: photo('BhxWutnCEAAtEQ6', 1, '1100000000000000006', 'quoter'), quote: quoteBlock({ id: ELON, handle: 'elonmusk', text: 'Quoted video', media: video(ELON_THUMB, 'blob:https://x.com/9c1d') }) })}
  ${post({ id: '1999999999999999997', handle: 'ghost', text: 'Blob-only video on a post X cannot describe', media: video('https://pbs.twimg.com/amplify_video_thumb/1999999999999999990/img/a.jpg', 'blob:https://x.com/77aa') })}
  <div style="height:1400px"></div>
  </main></div>
  <script>
    // X switches layouts from JS when its window narrows, by re-rendering the wrapper's classes.
    const app = () => document.getElementById('bx-app');
    const fit = () => app() && (app().className = innerWidth < 500 ? 'app-narrow' : 'app-wide');
    addEventListener('resize', fit);
    fit();
  </script></body></html>`;
}

/**
 * A home timeline with the surfaces Better X's customization touches, in the shapes Control
 * Panel for Twitter documents: timeline cells (cellInnerDiv > div > article), promoted posts
 * wrapped in placementTracking, header nav, Home tabs (For you / Following), sidebar trends and
 * a Grok promo, menus, a Grok drawer, and one post in the newer markup shape (no test IDs).
 * A real browser decides what is visible, so the checks are about CSS, not about this fixture.
 * Not X: proof of the rules' behavior on this markup, not of compatibility with live X.
 */
export const PROMOTED_ICON =
  'M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0 1.38 1.119 2.5 2.5 2.5h15c1.381 0 2.5-1.12 2.5-2.5v-13c0-1.38-1.119-2.5-2.5-2.5zm-3.502 12h-2v-3.59l-5.293 5.3-1.414-1.42L12.581 10H8.996V8h7v7z';
const tweet = (html) => html.replace('<article ', '<article data-testid="tweet" ');
const cell = (id, inner) =>
  `<div data-testid="cellInnerDiv" id="cell-${id}"><div id="inner-${id}">${inner}</div></div>`;
export const FEATURE_POSTS = 5;
export function featuresPage(theme = 'light') {
  const bg = theme === 'dark' ? '#000' : '#fff';
  const grokActions = '<button aria-label="Grok actions" id="grok-actions">G</button>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>X features fixture</title></head>
  <body style="margin:0;background:${bg};color:${theme === 'dark' ? '#e7e9ea' : '#0f1419'};font-family:sans-serif">
  <style>
    #bx-app{display:flex}#bx-app.app-narrow{flex-direction:column}
    [role="tablist"]{display:flex}[role="tablist"]>div{flex:1}
    [role="tab"]{display:block;padding:8px}[role="tab"][aria-selected="true"]{font-weight:700}
  </style>
  <div id="layers">
    <div role="menu" id="menu"><a id="menu-ads" href="https://ads.x.com/">Ads</a><a id="menu-grok" href="/i/grok">Grok</a><a id="menu-settings" href="/settings">Settings</a></div>
    <div role="dialog" id="sheet"><a id="sheet-ads" href="https://ads.twitter.com/">Ads</a><a id="sheet-settings" href="/settings">Settings</a></div>
    <div data-testid="GrokDrawer" id="grok-drawer">Grok drawer</div>
  </div>
  <div id="bx-app" class="app-wide">
    <header><nav aria-label="Primary">
      <a id="nav-home" href="/home">Home</a><a href="/explore">Explore</a><a id="nav-grok" href="/i/grok">Grok</a><a href="/notifications">Notifications</a>
    </nav></header>
    <div data-testid="primaryColumn" style="width:600px">
      <nav id="home-tabs"><div role="tablist">
        <div id="tab-foryou"><a role="tab" id="tab-foryou-link" href="/home" aria-selected="true">For you</a></div>
        <div id="tab-following"><a role="tab" id="tab-following-link" href="/home" aria-selected="false">Following</a></div>
      </div></nav>
      <div id="timeline">
        ${cell('plain1', tweet(post({ id: '1200000000000000001', handle: 'plainone', text: 'An ordinary post' })))}
        ${cell('promo', `<div data-testid="placementTracking">${tweet(post({ id: '1200000000000000002', handle: 'advertiser', text: 'A promoted post' }))}</div>`)}
        ${cell('plain2', tweet(post({ id: '1200000000000000003', handle: 'plaintwo', text: 'Another ordinary post' })))}
        ${cell('nopost', '<div data-testid="placementTracking"><div data-testid="UserCell">A tracked block that is not a post</div></div>')}
        ${cell('mention', tweet(post({ id: '1200000000000000004', handle: 'talker', text: 'I asked Grok about this and it said no' })))}
        ${cell('grokpost', tweet(post({ id: '1200000000000000005', handle: 'groker', text: 'A post with Grok surfaces', media: `<div data-testid="followups_1" id="followups">Suggested prompts</div><nav id="followups-nav">more</nav><a id="ask-grok" href="/i/grok">Ask Grok</a>${grokActions}` })))}
        ${cell('tailwind', '<article id="tailwind-post"><a href="https://x.com/newlayout/status/1200000000000000006"><span>A post in the newer markup shape</span></a></article>')}
      </div>
    </div>
    <aside data-testid="sidebarColumn">
      <div data-testid="trend" id="trend-promo"><svg width="12" height="12"><path d="${PROMOTED_ICON}"></path></svg>Promoted</div>
      <div data-testid="trend" id="trend-plain"><svg width="12" height="12"><path d="M0 0h1"></path></svg>#news</div>
      <div id="grok-promo-wrap"><aside role="complementary" id="grok-promo"><a href="https://grok.com/imagine">Try Grok Imagine</a></aside></div>
      <div id="other-sidebar"><aside role="complementary" id="other-promo"><a href="https://example.com/">Something else</a></aside></div>
    </aside>
  </div>
  <script>
    // X switches layouts from JS when its window narrows, and tabs select themselves on click.
    const app = () => document.getElementById('bx-app');
    const fit = () => app() && (app().className = innerWidth < 500 ? 'app-narrow' : 'app-wide');
    addEventListener('resize', fit); fit();
    window.__tabClicks = [];
    document.getElementById('home-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]'); if (!tab) return;
      e.preventDefault();
      window.__tabClicks.push(tab.id);
      document.querySelectorAll('#home-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    });
  </script></body></html>`;
}
