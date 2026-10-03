// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { extractPost } from './selectors';

const PARENT_AVATAR = 'https://pbs.twimg.com/profile_images/1/author.jpg';
const QUOTED_AVATAR = 'https://pbs.twimg.com/profile_images/2/quoted.jpg';

/** The parent post body shared by every avatar case: author, time link, text, and a quote. */
const body = (media = '') => `
  <div data-testid="User-Name"><a href="https://x.com/author">Author</a><span>@author</span></div>
  <a href="https://x.com/author/status/1770825760162353449"><time datetime="2024-03-21T00:00:00Z"></time></a>
  <div data-testid="tweetText">Parent text</div>
  ${media}
  <div role="link">
    <div data-testid="User-Name"><a href="https://x.com/quoted">Quoted</a></div>
    <img src="${QUOTED_AVATAR}">
    <a href="https://x.com/quoted/status/1770825760162353450"><time datetime="2024-03-21T00:00:00Z"></time></a>
    <div data-testid="tweetText">Quoted text</div>
  </div>`;

function post(html: string) {
  const article = document.createElement('article');
  article.innerHTML = html;
  document.body.append(article);
  return extractPost(article)!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('author avatar extraction', () => {
  const cases: Array<[string, string, string | null]> = [
    [
      'legacy profile role link',
      `<a role="link" href="https://x.com/author"><div data-testid="Tweet-User-Avatar"><img src="${PARENT_AVATAR}"></div></a>`,
      PARENT_AVATAR,
    ],
    [
      'avatar-only role wrapper',
      `<div role="link"><div data-testid="UserAvatar-Container-author"><img src="${PARENT_AVATAR}"></div></div>`,
      PARENT_AVATAR,
    ],
    [
      'plain profile image',
      `<a href="https://x.com/author"><img src="${PARENT_AVATAR}"></a>`,
      PARENT_AVATAR,
    ],
    [
      'unsafe avatar host',
      `<div data-testid="Tweet-User-Avatar"><img src="https://evil.example/profile_images/1/author.jpg"></div>`,
      null,
    ],
    ['missing parent avatar never borrows the quoted one', '', null],
  ];
  for (const [name, avatar, expected] of cases)
    it(name, () => {
      const draft = post(avatar + body());
      expect(draft.authorAvatarUrl).toBe(expected);
      expect(draft.text).toBe('Parent text');
      expect(draft.quote?.authorAvatarUrl).toBe(QUOTED_AVATAR);
      expect(draft.quote?.text).toBe('Quoted text');
    });
});
