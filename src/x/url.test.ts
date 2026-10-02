import { describe, expect, it } from 'vitest';
import { parsePostUrl, postDateFromId } from './url';

describe('parsePostUrl', () => {
  it('normalizes X and Twitter links and removes tracking', () => {
    expect(parsePostUrl('https://twitter.com/Some_User/status/123456789?s=20#foo')).toEqual({
      tweetId: '123456789',
      url: 'https://x.com/Some_User/status/123456789',
      handle: 'Some_User',
    });
    expect(parsePostUrl('https://x.com/a/status/42/photo/1')?.tweetId).toBe('42');
  });
  it('rejects unsupported or invalid links', () => {
    for (const url of [
      'https://evil.com/a/status/42',
      'javascript:alert(1)',
      'https://x.com/a',
      'https://x.com/a/status/abc',
      'https://x.com/too-long-username/status/1',
    ]) {
      expect(parsePostUrl(url)).toBeNull();
    }
  });
});

describe('postDateFromId', () => {
  it('reads the creation time encoded in post IDs', () => {
    expect(postDateFromId('1770825760162353449')?.slice(0, 10)).toBe('2024-03-21');
    expect(postDateFromId('20')).toBeNull();
    expect(postDateFromId('not-an-id')).toBeNull();
  });
});
