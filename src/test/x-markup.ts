/** X-shaped post markup for tests: the structure X renders, with test IDs, relative links and cells. */
export interface PostSpec {
  id: string;
  handle: string;
  name?: string;
  text?: string;
  quote?: { id: string; handle: string; name?: string; text?: string };
  /** `false` omits the timeline cell wrapper. */
  cell?: boolean;
}

const nameBlock = (handle: string, name: string, id: string) => `
  <div data-testid="User-Name">
    <div><div><a href="/${handle}" role="link"><span>${name}</span></a></div></div>
    <div>
      <div><a href="/${handle}" role="link" tabindex="-1"><span>@${handle}</span></a></div>
      <div aria-hidden="true"><span>·</span></div>
      <div><a href="https://x.com/${handle}/status/${id}" role="link"><time datetime="2024-03-21T00:00:00Z">Mar 21</time></a></div>
    </div>
  </div>`;

export const quoteHtml = (q: NonNullable<PostSpec['quote']>) => `
  <div role="link" tabindex="0" data-testid="quoteTweet">
    ${nameBlock(q.handle, q.name ?? q.handle, q.id)}
    <div data-testid="tweetText">${q.text ?? 'Quoted text'}</div>
  </div>`;

export const articleHtml = (p: PostSpec) => `
  <article data-testid="tweet" role="article" tabindex="0">
    ${nameBlock(p.handle, p.name ?? p.handle, p.id)}
    <div data-testid="tweetText">${p.text ?? 'Post text'}</div>
    ${p.quote ? quoteHtml(p.quote) : ''}
    <div role="group">
      ${['reply', 'retweet', 'like', 'bookmark', 'share']
        .map(
          (id) =>
            `<div><button data-testid="${id}"><svg viewBox="0 0 24 24"><path d="M1 1h22v22H1z"/></svg></button></div>`,
        )
        .join('')}
    </div>
  </article>`;

export const postHtml = (p: PostSpec) =>
  p.cell === false
    ? articleHtml(p)
    : `<div data-testid="cellInnerDiv"><div>${articleHtml(p)}</div></div>`;

/** Appends a post to the page and returns its article. */
export function addPost(spec: PostSpec, into: ParentNode = document.body): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = postHtml(spec);
  const node = host.firstElementChild!;
  into.append(node);
  return (node.matches('article') ? node : node.querySelector('article')) as HTMLElement;
}
