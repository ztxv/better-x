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

describe('media extraction', () => {
  it('keeps the original photo source and a separate small preview', () => {
    const draft = post(
      body(
        '<a href="https://x.com/author/status/1770825760162353449/photo/1"><img src="https://pbs.twimg.com/media/AbC_123?format=png&name=900x900"></a>',
      ),
    );
    expect(draft.media).toEqual([
      {
        kind: 'image',
        thumbnailUrl: 'https://pbs.twimg.com/media/AbC_123?format=png&name=small',
        sourceUrl: 'https://pbs.twimg.com/media/AbC_123?format=png&name=orig',
        alt: null,
      },
    ]);
  });

  it('records a GIF MP4 exposed by the player, and never a blob: player URL', () => {
    const draft = post(
      body(`
        <div><div><video poster="https://pbs.twimg.com/tweet_video_thumb/GiF1.jpg"
          src="https://video.twimg.com/tweet_video/GiF1.mp4"></video></div></div>
        <div><div><video poster="https://pbs.twimg.com/ext_tw_video_thumb/42/pu/img/x.jpg"
          src="blob:https://x.com/5f1c"></video></div></div>`),
    );
    expect(draft.media.map((item) => [item.kind, item.sourceUrl])).toEqual([
      ['gif', 'https://video.twimg.com/tweet_video/GiF1.mp4'],
      ['video', null],
    ]);
  });

  it('keeps quoted media out of the parent media list', () => {
    const draft = post(
      body().replace(
        '<div data-testid="tweetText">Quoted text</div>',
        '<div data-testid="tweetText">Quoted text</div><img src="https://pbs.twimg.com/media/QuOtE?format=jpg&name=small">',
      ),
    );
    expect(draft.media).toEqual([]);
    expect(draft.quote?.media).toHaveLength(1);
  });
});
