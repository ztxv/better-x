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
  it('detaches bookmarks from missing collections', () => {
    const result = validateExport({ ...sample, collections: [] });
    expect(result.bookmarks[0]?.collectionId).toBeNull();
  });
});
