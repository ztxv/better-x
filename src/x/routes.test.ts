import { describe, expect, it } from 'vitest';
import { classifyRoute, classifyUrl, type RouteId } from './routes';
import { parsePostUrl } from './url';

const id = (url: string) => classifyUrl(url).id;

describe('classifyRoute: surfaces', () => {
  it.each<[string, RouteId]>([
    ['https://x.com/', 'home'],
    ['https://x.com/home', 'home'],
    ['https://x.com/home/', 'home'],
    ['https://x.com/elonmusk', 'profile'],
    ['https://x.com/elonmusk/with_replies', 'profile'],
    ['https://x.com/elonmusk/media', 'profile'],
    ['https://x.com/elonmusk/likes', 'profile'],
    ['https://x.com/elonmusk/highlights', 'profile'],
    ['https://x.com/elonmusk/followers', 'profile'],
    ['https://x.com/elonmusk/verified_followers', 'profile'],
    ['https://x.com/elonmusk/status/1585341984679469056', 'post'],
    ['https://x.com/elonmusk/status/1585341984679469056/quotes', 'post'],
    ['https://x.com/elonmusk/status/1585341984679469056/likes', 'post'],
    ['https://x.com/elonmusk/status/1585341984679469056/retweets', 'post'],
    ['https://x.com/i/status/1585341984679469056', 'post'],
    ['https://x.com/i/web/status/1585341984679469056', 'post'],
    ['https://x.com/search?q=cats', 'search'],
    ['https://x.com/hashtag/cats', 'search'],
    ['https://x.com/notifications', 'notifications'],
    ['https://x.com/notifications/mentions', 'notifications'],
    ['https://x.com/messages', 'messages'],
    ['https://x.com/messages/123-456', 'messages'],
    ['https://x.com/i/chat/abc', 'messages'],
    ['https://x.com/i/bookmarks', 'bookmarks'],
    ['https://x.com/elonmusk/lists', 'lists'],
    ['https://x.com/i/lists', 'lists'],
    ['https://x.com/i/lists/1234567890', 'list'],
    ['https://x.com/elonmusk/communities', 'communities'],
    ['https://x.com/i/communities/suggested', 'communities'],
    ['https://x.com/i/communities/1234567890', 'community'],
    ['https://x.com/explore', 'explore'],
    ['https://x.com/explore/tabs/trending', 'explore'],
    ['https://x.com/settings/account', 'settings'],
    ['https://x.com/settings', 'settings'],
    ['https://x.com/compose/post', 'compose'],
    ['https://x.com/messages/compose', 'compose'],
    ['https://x.com/i/grok', 'grok'],
  ])('%s is %s', (url, expected) => {
    expect(id(url)).toBe(expected);
  });

  it('classifies twitter.com paths the same way', () => {
    expect(id('https://twitter.com/elonmusk/status/1585341984679469056')).toBe('post');
    expect(id('https://mobile.twitter.com/home')).toBe('home');
  });
});

describe('classifyRoute: unknown and reserved paths', () => {
  it.each([
    'https://x.com/login',
    'https://x.com/tos',
    'https://x.com/i/flow/login',
    'https://x.com/elonmusk/not_a_tab',
    'https://x.com/elonmusk/status/abc',
    'https://x.com/home/pinned/edit',
    'https://x.com/a/b/c/d/e',
    'https://x.com/someone_with_a_name_that_is_too_long_for_x',
  ])('%s is unknown', (url) => {
    expect(id(url)).toBe('unknown');
  });

  it('never mistakes a reserved top-level path for a profile', () => {
    for (const word of ['search', 'settings', 'explore', 'compose', 'i', 'jobs'])
      expect(classifyRoute({ pathname: `/${word}/with_replies` }).id).not.toBe('profile');
  });

  it('does not throw on garbage', () => {
    expect(classifyUrl('http://[').id).toBe('unknown');
    expect(classifyRoute({ pathname: '' }).id).toBe('home');
    expect(classifyRoute({ pathname: '//' }).id).toBe('home');
  });
});

describe('classifyRoute: parameters', () => {
  it('reads handle and post id', () => {
    expect(classifyUrl('https://x.com/ElonMusk/status/1585341984679469056')).toMatchObject({
      id: 'post',
      handle: 'ElonMusk',
      tweetId: '1585341984679469056',
    });
  });

  it('reads a post views and keeps them distinct from the thread', () => {
    const thread = classifyUrl('https://x.com/a/status/1');
    const quotes = classifyUrl('https://x.com/a/status/1/quotes');
    expect(quotes.view).toBe('quotes');
    expect(quotes.key).not.toBe(thread.key);
  });

  it('reads profile tabs', () => {
    expect(classifyUrl('https://x.com/a/media')).toMatchObject({
      id: 'profile',
      handle: 'a',
      view: 'media',
    });
  });

  it('reads the search text and filter', () => {
    expect(classifyUrl('https://x.com/search?q=hello%20world&f=live')).toMatchObject({
      id: 'search',
      query: 'hello world',
      view: 'live',
    });
    expect(classifyUrl('https://x.com/hashtag/cats').query).toBe('#cats');
  });
});

describe('classifyRoute: identity key', () => {
  const key = (url: string) => classifyUrl(url).key;

  it('ignores hash, trailing slash and irrelevant query strings', () => {
    expect(key('https://x.com/home?s=20')).toBe(key('https://x.com/home'));
    expect(key('https://x.com/home/')).toBe(key('https://x.com/home'));
    expect(key('https://x.com/a/status/1#reply')).toBe(key('https://x.com/a/status/1'));
    expect(key('https://x.com/a/status/1?s=20&t=abc')).toBe(key('https://x.com/a/status/1'));
    expect(key('https://x.com/A')).toBe(key('https://x.com/a'));
  });

  it('treats a different search or filter as a different route', () => {
    expect(key('https://x.com/search?q=a')).not.toBe(key('https://x.com/search?q=b'));
    expect(key('https://x.com/search?q=a')).not.toBe(key('https://x.com/search?q=a&f=live'));
  });

  it('ignores search tracking parameters and parameter order', () => {
    expect(key('https://x.com/search?q=a&src=typed_query')).toBe(key('https://x.com/search?q=a'));
    expect(key('https://x.com/search?f=live&q=a')).toBe(key('https://x.com/search?q=a&f=live'));
    expect(key('https://x.com/hashtag/cats')).toBe(key('https://x.com/search?q=%23cats'));
  });

  it('distinguishes content within a surface', () => {
    expect(key('https://x.com/a')).not.toBe(key('https://x.com/b'));
    expect(key('https://x.com/a')).not.toBe(key('https://x.com/a/with_replies'));
    expect(key('https://x.com/a/status/1')).not.toBe(key('https://x.com/a/status/2'));
    expect(key('https://x.com/messages/1-2')).not.toBe(key('https://x.com/messages/3-4'));
  });

  it('keeps the same post under its handle and under /i/', () => {
    expect(key('https://x.com/a/status/1')).toBe(key('https://x.com/i/status/1'));
  });
});

describe('classifyRoute: modal routes', () => {
  it('marks the composer and media viewers as overlays', () => {
    expect(classifyUrl('https://x.com/compose/post').modal).toBe(true);
    expect(classifyUrl('https://x.com/messages/compose').modal).toBe(true);
    expect(classifyUrl('https://x.com/i/foundmedia/search').modal).toBe(true);
    expect(classifyUrl('https://x.com/a/status/1/photo/2')).toMatchObject({
      id: 'media',
      modal: true,
      tweetId: '1',
    });
    expect(classifyUrl('https://x.com/a/status/1/video/1').modal).toBe(true);
    expect(classifyUrl('https://x.com/a/status/1/mediaviewer').modal).toBe(true);
  });

  it('marks real pages as not modal', () => {
    for (const url of ['https://x.com/home', 'https://x.com/a/status/1', 'https://x.com/a/media'])
      expect(classifyUrl(url).modal).toBe(false);
  });
});

describe('route parsing stays separate from post URL parsing', () => {
  it('agrees with parsePostUrl on which canonical URLs are posts', () => {
    for (const url of [
      'https://x.com/elonmusk/status/1585341984679469056',
      'https://twitter.com/elonmusk/status/1585341984679469056?s=20',
    ]) {
      const post = parsePostUrl(url)!;
      expect(classifyUrl(url)).toMatchObject({ id: 'post', tweetId: post.tweetId });
    }
  });
});
