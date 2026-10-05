import { beforeEach, describe, expect, it } from 'vitest';
import { DownloadRepository } from '../downloads/repository';
import { exportDownloads } from '../downloads/history';
import { validateExport } from '../lib/validation';
import { freshEnvironment } from '../test/fakes';
import type { DownloadRecord } from '../types/model';
import { BookmarkRepository } from './repository';

const POST = '123';
const bookmarkDraft = {
  tweetId: POST,
  url: `https://x.com/alice/status/${POST}`,
  authorHandle: 'alice',
  authorDisplayName: 'Alice',
  authorAvatarUrl: null,
  text: 'Local',
  createdAt: null,
  media: [],
  quote: null,
  replyTo: null,
  card: null,
};
const completed: DownloadRecord = {
  id: 'd1',
  batchId: 'b1',
  tweetId: POST,
  sourceTweetId: POST,
  scope: 'post',
  mediaIndex: 0,
  mediaKind: 'image',
  mediaKey: `${POST}:img:A`,
  previewUrl: null,
  snapshot: bookmarkDraft,
  chromeId: 9,
  status: 'complete',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:01.000Z',
  completedAt: '2026-10-01T00:00:01.000Z',
  filename: 'alice_123_1.jpg',
  url: 'https://pbs.twimg.com/media/A?format=jpg&name=orig',
  error: null,
};

let bookmarks: BookmarkRepository;
let downloads: DownloadRepository;
beforeEach(async () => {
  await freshEnvironment();
  bookmarks = new BookmarkRepository();
  downloads = new DownloadRepository();
});

describe('backup import', () => {
  it('imports history as historical records with no local file binding', async () => {
    const data = validateExport({
      format: 'saved-for-x',
      version: 3,
      exportedAt: '2026-10-02T00:00:00.000Z',
      bookmarks: [],
      collections: [],
      downloads: exportDownloads([completed, { ...completed, id: 'd2', status: 'interrupted' }]),
    });
    expect(await bookmarks.import(data)).toEqual({ imported: 0, downloads: 1 });
    const [record] = await downloads.list();
    expect(record).toMatchObject({ id: 'd1', status: 'historical', chromeId: null, url: null });
    // Importing the same backup again adds nothing.
    expect(await bookmarks.import(data)).toEqual({ imported: 0, downloads: 0 });
    // History alone never brings a bookmark back into All Bookmarks.
    expect(await bookmarks.savedIds()).toEqual([]);
  });

  it('keeps the local bookmark when a backup holds the same post', async () => {
    await bookmarks.save(bookmarkDraft);
    await bookmarks.update(POST, { note: 'local note', tags: ['local'] });
    const data = validateExport({
      format: 'saved-for-x',
      version: 2,
      exportedAt: '2026-10-02T00:00:00.000Z',
      collections: [],
      bookmarks: [
        {
          ...bookmarkDraft,
          id: POST,
          text: 'From backup',
          savedAt: '2020-01-01T00:00:00.000Z',
          collectionId: null,
          tags: ['backup'],
          note: 'backup note',
          schemaVersion: 2,
        },
      ],
    });
    expect((await bookmarks.import(data)).imported).toBe(0);
    expect(await bookmarks.get(POST)).toMatchObject({
      text: 'Local',
      note: 'local note',
      tags: ['local'],
    });
  });

  it('opens a version 1 database and keeps its bookmarks', async () => {
    // Create the original schema (version 1) with one bookmark, then open with the current code.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('better-x', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('bookmarks', { keyPath: 'id' });
        open.result.createObjectStore('collections', { keyPath: 'id' });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction('bookmarks', 'readwrite');
        tx.objectStore('bookmarks').put({
          ...bookmarkDraft,
          id: POST,
          savedAt: '2026-01-01T00:00:00.000Z',
          collectionId: null,
          tags: [],
          note: 'old',
          schemaVersion: 1,
        });
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
      open.onerror = () => reject(open.error);
    });
    expect(await bookmarks.get(POST)).toMatchObject({ note: 'old', media: [] });
    expect(await downloads.list()).toEqual([]);
  });
});
