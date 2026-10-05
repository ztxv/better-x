import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DownloadRepository } from '../downloads/repository';
import { BookmarkRepository } from '../storage/repository';
import { freshEnvironment } from '../test/fakes';
import type { DownloadRecord } from '../types/model';
import { createBackup, identifyBackup, IMPORTABLE_BACKUPS } from './backup';
import { validateExport } from './validation';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`./fixtures/backups/${name}.json`, import.meta.url), 'utf8'));

const A = '1700000000000000001';
const B = '1700000000000000002';
const QUOTED = '1690000000000000009';

const LEGACY = ['saved-for-x-v1', 'saved-for-x-v2', 'saved-for-x-v3'] as const;
const ALL = [...LEGACY, 'better-x-v1'] as const;

describe('importable backups', () => {
  it('accepts exactly saved-for-x 1-3 and better-x 1', () => {
    expect(IMPORTABLE_BACKUPS).toEqual({ 'better-x': [1], 'saved-for-x': [1, 2, 3] });
    for (const name of ALL) expect(() => identifyBackup(fixture(name))).not.toThrow();
  });

  it.each(ALL)('%s becomes a current Better X backup with its library intact', (name) => {
    const result = validateExport(fixture(name));
    expect(result.format).toBe('better-x');
    expect(result.version).toBe(1);
    expect(result.collections).toEqual([
      { id: 'col-reading', name: 'Reading list', createdAt: '2026-01-02T10:00:00.000Z' },
    ]);
    const [a, b] = result.bookmarks;
    expect(a).toMatchObject({
      id: A,
      tweetId: A,
      url: `https://x.com/example_author/status/${A}`,
      authorHandle: 'example_author',
      authorDisplayName: 'Example Author',
      authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/example_normal.jpg',
      text: 'A synthetic post with a photo, a quote, and a link.',
      collectionId: 'col-reading',
      tags: ['fixtures', 'testing'],
      note: 'Synthetic note.',
      schemaVersion: 3,
    });
    expect(b).toMatchObject({ id: B, collectionId: null, tags: [], note: '' });
  });

  it('gives saved-for-x 1 bookmarks empty context and no history', () => {
    const result = validateExport(fixture('saved-for-x-v1'));
    for (const bookmark of result.bookmarks)
      expect(bookmark).toMatchObject({ media: [], quote: null, replyTo: null, card: null });
    expect(result.downloads).toEqual([]);
  });

  it('keeps saved-for-x 2 post context, without media sources it never recorded', () => {
    const [a, b] = validateExport(fixture('saved-for-x-v2')).bookmarks;
    expect(a!.media).toEqual([
      {
        kind: 'image',
        thumbnailUrl: 'https://pbs.twimg.com/media/FixturePhoto1?format=jpg&name=small',
        sourceUrl: null,
        alt: 'A synthetic photo',
      },
    ]);
    expect(a!.quote).toMatchObject({
      tweetId: QUOTED,
      authorHandle: 'example_quoted',
      text: 'The quoted post.',
      media: [{ kind: 'gif', sourceUrl: null }],
    });
    expect(a!.card).toMatchObject({
      kind: 'link',
      domain: 'example.com',
      title: 'An example headline',
    });
    expect(b!.replyTo).toMatchObject({ authorHandle: 'example_author', text: 'The parent post.' });
    expect(validateExport(fixture('saved-for-x-v2')).downloads).toEqual([]);
  });

  it.each(['saved-for-x-v3', 'better-x-v1'])(
    '%s keeps media sources and completed history',
    (name) => {
      const result = validateExport(fixture(name));
      expect(result.bookmarks[0]!.media[0]!.sourceUrl).toBe(
        'https://pbs.twimg.com/media/FixturePhoto1?format=jpg&name=orig',
      );
      expect(result.downloads.map((d) => [d.id, d.scope, d.sourceTweetId, d.mediaKey])).toEqual([
        ['dl-photo', 'post', A, `${A}:img:FixturePhoto1`],
        ['dl-quoted-gif', 'quote', QUOTED, `${QUOTED}:gif:FixtureGif1`],
      ]);
    },
  );

  it('ignores history in versions that never had it instead of trusting it', () => {
    const history = fixture('saved-for-x-v3').downloads;
    for (const version of [1, 2])
      expect(
        validateExport({ ...fixture('saved-for-x-v2'), version, downloads: history }).downloads,
      ).toEqual([]);
  });
});

describe('rejected backups', () => {
  it('rejects other formats by name', () => {
    for (const format of ['x-bookmarker', 'Better-X', 'saved_for_x', '', undefined, 3])
      expect(() => validateExport({ ...fixture('better-x-v1'), format })).toThrow(
        'This file is not a Better X or Saved for X backup.',
      );
  });

  it('rejects versions this release does not know', () => {
    expect(() => validateExport({ ...fixture('better-x-v1'), version: 2 })).toThrow(
      'This Better X backup is version 2, which Better X cannot import.',
    );
    for (const version of [0, 4, '3', 2.5, null, undefined])
      expect(() => validateExport({ ...fixture('saved-for-x-v3'), version })).toThrow(
        /^This Saved for X backup is version .*, which Better X cannot import\.$/,
      );
  });

  it('rejects malformed backups', () => {
    for (const input of [null, [], 'better-x', 42])
      expect(() => validateExport(input)).toThrow('not a Better X or Saved for X backup');
    expect(() => validateExport({ ...fixture('better-x-v1'), bookmarks: undefined })).toThrow(
      'This backup is damaged',
    );
    expect(() => validateExport({ ...fixture('saved-for-x-v1'), collections: {} })).toThrow(
      'This backup is damaged',
    );
    const [first] = fixture('saved-for-x-v3').bookmarks as Record<string, unknown>[];
    expect(() =>
      validateExport({ ...fixture('saved-for-x-v3'), bookmarks: [{ ...first, tweetId: '999' }] }),
    ).toThrow('Export contains an invalid bookmark.');
    expect(() =>
      validateExport({ ...fixture('better-x-v1'), collections: [{ id: 'c', name: 7 }] }),
    ).toThrow('Export contains an invalid collection.');
  });
});

describe('Better X export', () => {
  const record: DownloadRecord = {
    id: 'local-1',
    batchId: 'batch',
    tweetId: A,
    sourceTweetId: A,
    scope: 'post',
    mediaIndex: 0,
    mediaKind: 'image',
    mediaKey: `${A}:img:FixturePhoto1`,
    previewUrl: null,
    snapshot: {
      tweetId: A,
      url: `https://x.com/example_author/status/${A}`,
      authorHandle: 'example_author',
      authorDisplayName: null,
      authorAvatarUrl: null,
      text: null,
      createdAt: null,
      media: [],
      quote: null,
      replyTo: null,
      card: null,
    },
    chromeId: 4,
    status: 'complete',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:01.000Z',
    completedAt: '2026-02-01T00:00:01.000Z',
    filename: 'example_author_1700000000000000001_1.jpg',
    url: 'https://pbs.twimg.com/media/FixturePhoto1?format=jpg&name=orig',
    error: null,
  };

  it('uses format "better-x" version 1 and leaves local-only download fields out', () => {
    const library = validateExport(fixture('saved-for-x-v2'));
    const backup = createBackup(
      library,
      [record, { ...record, id: 'failed', status: 'interrupted' }],
      new Date('2026-02-02T00:00:00.000Z'),
    );
    expect(backup).toMatchObject({
      format: 'better-x',
      version: 1,
      exportedAt: '2026-02-02T00:00:00.000Z',
    });
    expect(backup.downloads.map((d) => d.id)).toEqual(['local-1']);
    expect(backup.downloads[0]).not.toHaveProperty('chromeId');
    expect(backup.downloads[0]).not.toHaveProperty('url');
    expect(backup.downloads[0]).not.toHaveProperty('status');
  });

  it('round-trips through import unchanged', () => {
    const library = validateExport(fixture('saved-for-x-v3'));
    const backup = createBackup(library, [record]);
    const again = validateExport(JSON.parse(JSON.stringify(backup)) as unknown);
    expect(again.bookmarks).toEqual(backup.bookmarks);
    expect(again.collections).toEqual(backup.collections);
    expect(again.downloads).toEqual(backup.downloads);
  });
});

describe('importing into the library', () => {
  let bookmarks: BookmarkRepository;
  let downloads: DownloadRepository;
  beforeEach(async () => {
    await freshEnvironment();
    bookmarks = new BookmarkRepository();
    downloads = new DownloadRepository();
  });

  it.each(ALL)('%s imports into an empty library', async (name) => {
    const result = await bookmarks.import(validateExport(fixture(name)));
    const hasHistory = name === 'saved-for-x-v3' || name === 'better-x-v1';
    expect(result).toEqual({ imported: 2, downloads: hasHistory ? 2 : 0 });
    const library = await bookmarks.list();
    expect(library.bookmarks.map((b) => b.id)).toEqual([B, A]);
    expect(library.collections.map((c) => c.id)).toEqual(['col-reading']);
  });

  it('keeps local bookmarks unchanged when a legacy backup holds the same post', async () => {
    await bookmarks.import(validateExport(fixture('saved-for-x-v3')));
    await bookmarks.update(A, { note: 'My newer note', tags: ['mine'], collectionId: null });
    const result = await bookmarks.import(validateExport(fixture('saved-for-x-v1')));
    expect(result).toEqual({ imported: 0, downloads: 0 });
    const local = await bookmarks.get(A);
    expect(local).toMatchObject({ note: 'My newer note', tags: ['mine'], collectionId: null });
    // The richer local copy keeps its context; the poorer v1 copy never replaces it.
    expect(local!.media).toHaveLength(1);
    expect(local!.quote?.tweetId).toBe(QUOTED);
  });

  it('turns legacy history into historical records once, with no local file binding', async () => {
    await bookmarks.import(validateExport(fixture('saved-for-x-v3')));
    const records = await downloads.list();
    expect(records).toHaveLength(2);
    for (const record of records)
      expect(record).toMatchObject({
        status: 'historical',
        chromeId: null,
        url: null,
        error: null,
      });
    // The same history in a Better X backup is not imported twice.
    expect((await bookmarks.import(validateExport(fixture('better-x-v1')))).downloads).toBe(0);
    expect(await downloads.list()).toHaveLength(2);
  });
});
