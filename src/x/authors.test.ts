// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { addPost } from '../test/x-markup';
import { extractPost, handleOfHref, postAuthorHandle, quotedAuthors } from './selectors';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('handleOfHref', () => {
  it('reads profile links, relative and absolute, and nothing else', () => {
    expect(handleOfHref('/SomeOne')).toBe('someone');
    expect(handleOfHref('https://x.com/SomeOne')).toBe('someone');
    expect(handleOfHref('https://twitter.com/a_b?x=1')).toBe('a_b');
    for (const not of [
      '/someone/status/1',
      '/i',
      '/home',
      'https://example.com/someone',
      '/',
      '',
      null,
      '/has-dash',
    ])
      expect(handleOfHref(not as string | null), String(not)).toBeNull();
  });
});

describe('post and quoted authors', () => {
  it('reads the post author from its own name block, whatever the permalink says', () => {
    const article = addPost({ id: '1', handle: 'Author' });
    expect(postAuthorHandle(article, null)).toBe('author');
    expect(postAuthorHandle(article, 'someoneelse')).toBe('author');
  });

  it('does not take the quoted author for the post’s author', () => {
    const article = addPost({
      id: '1',
      handle: 'parent',
      quote: { id: '2', handle: 'quoted' },
    });
    expect(postAuthorHandle(article, null)).toBe('parent');
    const quotes = quotedAuthors(article);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]!.handle).toBe('quoted');
    expect(quotes[0]!.block.matches('[data-testid="quoteTweet"]')).toBe(true);
  });

  it('finds no quote on a plain post', () => {
    expect(quotedAuthors(addPost({ id: '1', handle: 'plain' }))).toEqual([]);
  });

  it('falls back to the permalink handle, but never reads /i/web/status as a person', () => {
    const article = document.createElement('article');
    document.body.append(article);
    expect(postAuthorHandle(article, 'Real_Name')).toBe('real_name');
    expect(postAuthorHandle(article, 'web')).toBeNull();
    expect(postAuthorHandle(article, 'i')).toBeNull();
    expect(postAuthorHandle(article, null)).toBeNull();
    expect(postAuthorHandle(article, 'has space')).toBeNull();
  });

  it('reads a quote whose author is plain text, and a nested article quote', () => {
    const plain = document.createElement('article');
    plain.innerHTML = `
      <div data-testid="User-Name"><a href="/outer"><span>Outer</span></a><span>@outer</span></div>
      <div data-testid="tweetText">Mentions @decoy in text</div>
      <div role="link"><img src="https://pbs.twimg.com/profile_images/1/a.jpg">
        <span>Quoted Name</span><span>@compact</span>
        <a href="/compact/status/5"><span>time</span></a>
        <div data-testid="tweetText">@notme says hi</div></div>`;
    document.body.append(plain);
    expect(quotedAuthors(plain).map((q) => q.handle)).toEqual(['compact']);

    const nested = document.createElement('article');
    nested.innerHTML = `
      <div data-testid="User-Name"><a href="/outer"><span>@outer</span></a></div>
      <article><div data-testid="User-Name"><a href="/inner"><span>@inner</span></a></div></article>`;
    document.body.append(nested);
    expect(quotedAuthors(nested).map((q) => q.handle)).toEqual(['inner']);
  });
});

describe('bookmark extraction is unaffected by Better X marks', () => {
  it('reads the same post whether or not a quote is collapsed or a badge is present', () => {
    const article = addPost({
      id: '100',
      handle: 'parent',
      text: 'Parent text',
      quote: { id: '200', handle: 'quoted', text: 'Quoted text' },
    });
    const before = extractPost(article);
    const block = quotedAuthors(article)[0]!.block;
    block.setAttribute('data-bx-quote', 'collapse');
    block.style.display = 'none';
    const card = document.createElement('div');
    card.className = 'bx-filter-card';
    card.textContent = 'Quoted post hidden by Better X Reason: Country: Germany Show quoted post';
    block.after(card);
    const badge = document.createElement('button');
    badge.className = 'bx-acct';
    badge.textContent = '🇩🇪';
    article.querySelector('[data-testid="User-Name"] > div:nth-child(2)')!.append(badge);
    const after = extractPost(article);
    expect(after).toEqual(before);
    expect(after?.quote?.authorHandle).toBe('quoted');
    expect(after?.quote?.text).toBe('Quoted text');
    expect(after?.text).toBe('Parent text');
  });
});
