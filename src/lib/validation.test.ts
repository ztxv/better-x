import { describe, expect, it } from 'vitest';
import { normalizeTag, validateExport } from './validation';

const sample = {
  format: 'saved-for-x',
  version: 1,
  exportedAt: '2026-10-01T00:00:00.000Z',
  collections: [{ id: 'research', name: 'Research', createdAt: '2026-10-01T00:00:00.000Z' }],
  bookmarks: [
    {
      id: '123',
      tweetId: '123',
      url: 'https://twitter.com/alice/status/123?s=1',
      authorHandle: 'alice',
      authorDisplayName: 'Alice',
      authorAvatarUrl: null,
      text: 'A post',
      createdAt: null,
      savedAt: '2026-10-01T00:00:00.000Z',
      collectionId: 'research',
      tags: ['#AI', 'ai'],
      note: 'Read later',
      schemaVersion: 1,
    },
  ],
};

describe('import validation', () => {
  it('normalizes canonical URLs and deduplicates tags', () => {
    const result = validateExport(sample);
    expect(result.bookmarks[0]?.url).toBe('https://x.com/alice/status/123');
    expect(result.bookmarks[0]?.tags).toEqual(['ai']);
    expect(normalizeTag('  #Read Later ')).toBe('read-later');
  });
  it('rejects malformed and non-X bookmarks', () => {
    expect(() =>
      validateExport({
        ...sample,
        bookmarks: [{ ...sample.bookmarks[0], url: 'https://example.com/alice/status/123' }],
      }),
    ).toThrow();
    expect(() =>
      validateExport({ ...sample, bookmarks: [{ ...sample.bookmarks[0], note: 42 }] }),
    ).toThrow();
  });
  it('imports version 1 files with empty context', () => {
    const result = validateExport(sample);
    expect(result.version).toBe(2);
    expect(result.bookmarks[0]).toMatchObject({
      media: [],
      quote: null,
      replyTo: null,
      card: null,
      schemaVersion: 2,
    });
  });
  it('round-trips post context and drops only unsafe context fields', () => {
    const context = {
      media: [
        { kind: 'image', thumbnailUrl: 'https://pbs.twimg.com/media/A?name=small', alt: 'A cat' },
        { kind: 'video', thumbnailUrl: 'https://tracker.example/pixel.gif', alt: null },
        { kind: 'hologram', thumbnailUrl: null, alt: null },
      ],
      quote: {
        tweetId: '99',
        url: 'https://twitter.com/bob/status/99',
        authorHandle: 'bob',
        authorDisplayName: 'Bob',
        authorAvatarUrl: null,
        text: 'Quoted words',
        createdAt: null,
        media: [{ kind: 'gif', thumbnailUrl: null, alt: null }],
      },
      replyTo: {
        tweetId: null,
        url: null,
        authorHandle: 'carol',
        authorDisplayName: null,
        text: null,
      },
      card: {
        kind: 'link',
        url: 'https://t.co/abc',
        domain: 'example.com',
        title: 'A headline',
        description: null,
        imageUrl: 'https://pbs.twimg.com/card_img/1/x?name=small',
      },
    };
    const first = validateExport({
      ...sample,
      bookmarks: [{ ...sample.bookmarks[0], ...context }],
    });
    const again = validateExport(JSON.parse(JSON.stringify(first)) as unknown);
    expect(again.bookmarks[0]?.media).toEqual([
      { kind: 'image', thumbnailUrl: 'https://pbs.twimg.com/media/A?name=small', alt: 'A cat' },
      { kind: 'video', thumbnailUrl: null, alt: null },
    ]);
    expect(again.bookmarks[0]?.quote).toMatchObject({
      tweetId: '99',
      url: 'https://x.com/bob/status/99',
      text: 'Quoted words',
      media: [{ kind: 'gif', thumbnailUrl: null, alt: null }],
    });
    expect(again.bookmarks[0]?.replyTo?.authorHandle).toBe('carol');
    expect(again.bookmarks[0]?.card).toMatchObject({ domain: 'example.com', title: 'A headline' });
    const unsafe = validateExport({
      ...sample,
      bookmarks: [{ ...sample.bookmarks[0], card: { url: 'javascript:alert(1)' }, quote: 'x' }],
    });
    expect(unsafe.bookmarks[0]).toMatchObject({ card: null, quote: null, text: 'A post' });
  });
  it('detaches bookmarks from missing collections', () => {
    const result = validateExport({ ...sample, collections: [] });
    expect(result.bookmarks[0]?.collectionId).toBeNull();
  });
});
