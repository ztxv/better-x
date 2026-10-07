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
