import { beforeEach, describe, expect, it } from 'vitest';
import type { BookmarkDraft, MediaTarget, StartResult } from '../types/model';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { BookmarkRepository } from '../storage/repository';
import { fakeFetch, freshEnvironment, ok } from '../test/fakes';
import { applyChromeState, DownloadRepository } from './repository';
import { DownloadService, validateTargets, type Downloader } from './service';

const POST = '1770825760162353449';
const photo = (id: string) => ({
  kind: 'image' as const,
  thumbnailUrl: `https://pbs.twimg.com/media/${id}?format=jpg&name=small`,
  sourceUrl: `https://pbs.twimg.com/media/${id}?format=jpg&name=orig`,
  alt: null,
});
const orig = (id: string) => `https://pbs.twimg.com/media/${id}?format=jpg&name=orig`;

const draft = (media = [photo('P1')]): BookmarkDraft => ({
  tweetId: POST,
  url: `https://x.com/author/status/${POST}`,
  authorHandle: 'author',
  authorDisplayName: 'Author',
  authorAvatarUrl: null,
  text: 'Parent',
  createdAt: null,
  media,
  quote: null,
  replyTo: null,
  card: null,
});

/** A scripted `chrome.downloads`: each download gets the next ID and a controllable state. */
function fakeDownloader() {
  let next = 1;
  const items = new Map<number, chrome.downloads.DownloadItem>();
  const started: chrome.downloads.DownloadOptions[] = [];
  let beforeReturn: ((id: number) => void) | null = null;
  const api: Downloader = {
    async download(options) {
      const id = next++;
      started.push(options);
      items.set(id, {
        id,
        url: options.url,
        state: 'in_progress',
        filename: '',
        startTime: new Date().toISOString(),
      } as chrome.downloads.DownloadItem);
      beforeReturn?.(id);
      return id;
    },
    async search(query) {
      return [...items.values()].filter(
        (item) =>
          (query.id === undefined || item.id === query.id) &&
          (!query.url || item.url === query.url),
      );
    },
    async cancel(id) {
      const item = items.get(id);
      if (item) Object.assign(item, { state: 'interrupted', error: 'USER_CANCELED' });
    },
  };
  return {
    api,
    items,
    started,
    finish(id: number, filename = `/Users/me/Downloads/Saved-for-X/file_${id}.jpg`) {
      Object.assign(items.get(id)!, { state: 'complete', filename });
    },
    fail(id: number, error: string) {
      Object.assign(items.get(id)!, { state: 'interrupted', error });
    },
    onDownload(callback: (id: number) => void) {
      beforeReturn = callback;
    },
  };
}

let bookmarks: BookmarkRepository;
let downloads: DownloadRepository;

function service(downloader: Downloader | null, fetcher: typeof fetch) {
  return new DownloadService({
    downloads,
    bookmark: (id) => bookmarks.get(id),
    downloader: () => downloader,
    settings: async () => DEFAULT_SETTINGS,
    fetcher,
  });
}

const target = (
  index: number,
  key: string | null = null,
  scope: MediaTarget['scope'] = 'post',
) => ({
  tweetId: POST,
  scope,
  index,
  key,
});

beforeEach(async () => {
  await freshEnvironment();
  bookmarks = new BookmarkRepository();
  downloads = new DownloadRepository();
});

describe('request validation', () => {
  it('accepts media identities only, for a single post', () => {
    expect(validateTargets([target(0, 'img:A')])).toEqual([target(0, 'img:A')]);
    for (const bad of [
      [],
      [{ ...target(0), index: 4 }],
      [{ ...target(0), key: 'https://evil.example/a.mp4' }],
      [{ ...target(0), url: 'https://evil.example/a.mp4', tweetId: 'abc' }],
      [{ ...target(0), scope: 'page' }],
      [target(0), { ...target(1), tweetId: '99' }],
      Array.from({ length: 9 }, () => target(0)),
    ])
      expect(() => validateTargets(bad)).toThrow();
  });
});

describe('download lifecycle', () => {
  it('records completion only when Chrome reports it, with the real file name', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    const result = await svc.start([target(0, 'img:P1')]);
    expect(result.outcomes).toMatchObject([{ status: 'started' }]);
    expect(chrome.started[0]).toMatchObject({
      url: orig('P1'),
      filename: `Saved-for-X/author_${POST}_1.jpg`,
      conflictAction: 'uniquify',
      saveAs: false,
    });
    let [record] = await downloads.list();
    expect(record).toMatchObject({ status: 'inProgress', chromeId: 1, completedAt: null });

    chrome.finish(1, '/Users/me/Downloads/Saved-for-X/author_1_1 (1).jpg');
    await svc.onChanged({ id: 1, state: { current: 'complete', previous: 'in_progress' } });
    [record] = await downloads.list();
    expect(record).toMatchObject({ status: 'complete', filename: 'author_1_1 (1).jpg' });
    expect(record!.completedAt).not.toBeNull();
    const completedAt = record!.completedAt;

    // Duplicate and late events are idempotent and never downgrade a completed download.
    await svc.onChanged({ id: 1, state: { current: 'complete', previous: 'in_progress' } });
    chrome.fail(1, 'NETWORK_FAILED');
    await svc.onChanged({ id: 1, state: { current: 'interrupted', previous: 'complete' } });
    [record] = await downloads.list();
    expect(record).toMatchObject({ status: 'complete', completedAt });
  });

  it('catches a completion that happens before the Chrome ID is stored', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    // Chrome finishes and fires its event before `download()` has even returned.
    chrome.onDownload((id) => {
      chrome.finish(id);
      void svc.onChanged({ id, state: { current: 'complete', previous: 'in_progress' } });
    });
    await svc.start([target(0)]);
    expect((await downloads.list())[0]).toMatchObject({ status: 'complete', chromeId: 1 });
  });

  it('does not start a second download of an item that is still pending', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    const [first, second] = await Promise.all([
      svc.start([target(0, 'img:P1')]),
      svc.start([target(0, 'img:P1')]),
    ]);
    const statuses = [...first!.outcomes, ...second!.outcomes].map((outcome) => outcome.status);
    expect(statuses.sort()).toEqual(['pending', 'started']);
    expect(chrome.started).toHaveLength(1);
    expect(await downloads.list()).toHaveLength(1);
  });

  it('keeps partial batches: completed items count, failed ones can be retried', async () => {
    await bookmarks.save(draft(['P1', 'P2', 'P3', 'P4'].map(photo)));
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({
      [orig('P1')]: ok('image/jpeg'),
      [orig('P2')]: ok('image/jpeg'),
      [orig('P3')]: () => new Response(null, { status: 404 }),
    });
    const svc = service(chrome.api, fetcher);
    const result: StartResult = await svc.start([0, 1, 2, 3].map((index) => target(index)));
    expect(result.outcomes.map((outcome) => outcome.status).sort()).toEqual([
      'failed',
      'failed',
      'started',
      'started',
    ]);
    expect(
      result.outcomes
        .filter((o) => o.status === 'failed')
        .map((o) => o.status === 'failed' && o.error)
        .sort(),
    ).toEqual(['network', 'unavailable']);
    chrome.finish(1);
    await svc.onChanged({ id: 1, state: { current: 'complete', previous: 'in_progress' } });
    chrome.fail(2, 'USER_CANCELED');
    await svc.onChanged({ id: 2, state: { current: 'interrupted', previous: 'in_progress' } });
    const statuses = (await downloads.list()).map((record) => record.status).sort();
    expect(statuses).toEqual(['cancelled', 'complete', 'interrupted', 'interrupted']);

    // Retrying replaces the failed attempt instead of adding to history.
    const retry = fakeFetch({ [orig('P4')]: ok('image/jpeg') });
    await service(chrome.api, retry.fetcher).start([target(3)]);
    const p4 = (await downloads.list()).filter((record) => record.mediaKey.endsWith('img:P4'));
    expect(p4).toHaveLength(1);
    expect(p4[0]!.status).toBe('inProgress');
  });

  it('reports a missing downloads permission without starting anything', async () => {
    await bookmarks.save(draft());
    const result = await service(null, fakeFetch({}).fetcher).start([target(0)]);
    expect(result.outcomes).toMatchObject([{ status: 'failed', error: 'permission' }]);
  });

  it('downloads quoted media only when asked, from the quoted post', async () => {
    await bookmarks.save({
      ...draft([]),
      quote: {
        tweetId: '42',
        url: 'https://x.com/quoted/status/42',
        authorHandle: 'quoted',
        authorDisplayName: null,
        authorAvatarUrl: null,
        text: null,
        createdAt: null,
        media: [photo('Q1')],
      },
    });
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('Q1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    expect((await svc.start([target(0)])).outcomes).toMatchObject([
      { status: 'failed', error: 'needsPost' },
    ]);
    expect(chrome.started).toHaveLength(0);
    await svc.start([target(0, 'img:Q1', 'quote')]);
    expect(chrome.started[0]!.filename).toBe('Saved-for-X/quoted_42_1.jpg');
    expect((await downloads.list())[0]).toMatchObject({
      sourceTweetId: '42',
      mediaKey: '42:img:Q1',
    });
  });

  it('keeps history and can redownload after the bookmark is removed', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    await svc.start([target(0)]);
    chrome.finish(1);
    await svc.onChanged({ id: 1, state: { current: 'complete', previous: 'in_progress' } });
    await bookmarks.delete(POST);
    expect(await bookmarks.get(POST)).toBeNull();
    const [record] = await downloads.list();
    expect(record).toMatchObject({
      status: 'complete',
      snapshot: { tweetId: POST, text: 'Parent' },
    });
    expect((await svc.start([target(0)])).outcomes).toMatchObject([{ status: 'started' }]);
    expect(await bookmarks.get(POST)).toBeNull();
  });
});

describe('restart reconciliation', () => {
  it('binds an uncertain start by searching Chrome, and never starts it again', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    // Simulate the worker stopping right after Chrome accepted the download.
    const crashing = service(
      {
        ...chrome.api,
        download: async (options) => {
          await chrome.api.download(options);
          throw new Error('worker stopped');
        },
      },
      fetcher,
    );
    await crashing.start([target(0)]).catch(() => {});
    // The failed-to-bind record is marked interrupted by the crashing flow; reset it to the
    // state a real restart would find: intent stored, ID never bound.
    const [stored] = await downloads.list();
    await downloads.transition(stored!.id, (record) => ({
      ...record,
      status: 'starting',
      error: null,
    }));

    chrome.finish(1);
    const restarted = service(chrome.api, fetcher);
    await restarted.reconcile();
    expect(chrome.started).toHaveLength(1);
    expect((await downloads.list())[0]).toMatchObject({ status: 'complete', chromeId: 1 });
  });

  it('marks downloads Chrome no longer knows as unknown instead of guessing', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    await service(chrome.api, fetcher).start([target(0)]);
    chrome.items.clear(); // Erased from Chrome's download list while the worker was stopped.
    await service(chrome.api, fetcher).reconcile();
    expect((await downloads.list())[0]).toMatchObject({ status: 'interrupted', error: 'unknown' });
  });

  it('cancels through Chrome without touching history of other items', async () => {
    await bookmarks.save(draft());
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({ [orig('P1')]: ok('image/jpeg') });
    const svc = service(chrome.api, fetcher);
    const result = await svc.start([target(0)]);
    await svc.cancel(result.outcomes[0]!.recordId!);
    expect((await downloads.list())[0]).toMatchObject({ status: 'cancelled' });
  });
});

describe('Chrome state rules', () => {
  const base = {
    status: 'inProgress',
    completedAt: null,
    error: null,
    filename: 'a.jpg',
  } as unknown as Parameters<typeof applyChromeState>[0];
  it('maps Chrome errors to readable categories', () => {
    expect(
      applyChromeState(base, { state: 'interrupted', error: 'NETWORK_FAILED' }, 't'),
    ).toMatchObject({ status: 'interrupted', error: 'network' });
    expect(
      applyChromeState(base, { state: 'interrupted', error: 'SERVER_FORBIDDEN' }, 't'),
    ).toMatchObject({ error: 'unavailable' });
    expect(
      applyChromeState(base, { state: 'interrupted', error: 'USER_CANCELED' }, 't'),
    ).toMatchObject({ status: 'cancelled' });
    expect(applyChromeState(base, { state: 'in_progress' }, 't')).toBeNull();
  });
});

describe('download history', () => {
  it('clearing keeps active downloads and never deletes bookmarks', async () => {
    await bookmarks.save(draft(['P1', 'P2'].map(photo)));
    const chrome = fakeDownloader();
    const { fetcher } = fakeFetch({
      [orig('P1')]: ok('image/jpeg'),
      [orig('P2')]: ok('image/jpeg'),
    });
    const svc = service(chrome.api, fetcher);
    await svc.start([target(0), target(1)]);
    chrome.finish(1);
    await svc.onChanged({ id: 1, state: { current: 'complete', previous: 'in_progress' } });
    const deleted = await downloads.clear();
    expect(deleted.map((record) => record.status)).toEqual(['complete']);
    expect((await downloads.list()).map((record) => record.status)).toEqual(['inProgress']);
    expect(await bookmarks.get(POST)).not.toBeNull();
    await downloads.restore(deleted);
    expect(await downloads.list()).toHaveLength(2);
  });
});

describe('saving', () => {
  it('a duplicate save from another tab never erases notes, tags, or collection', async () => {
    await bookmarks.save(draft());
    const collection = await bookmarks.createCollection('Downloaded');
    await bookmarks.update(POST, { collectionId: collection.id, tags: ['keep'], note: 'mine' });
    const before = await bookmarks.get(POST);
    const results = await Promise.all([bookmarks.save(draft()), bookmarks.save(draft())]);
    for (const saved of results) expect(saved).toMatchObject({ note: 'mine', tags: ['keep'] });
    expect(await bookmarks.get(POST)).toEqual(before);
  });

  it('two tabs saving a new post at once create one bookmark', async () => {
    const [a, b] = await Promise.all([bookmarks.save(draft()), bookmarks.save(draft())]);
    expect(a.savedAt).toBe(b.savedAt);
    expect(await bookmarks.savedIds()).toEqual([POST]);
  });

  it('repairs only missing author details on re-save', async () => {
    await bookmarks.save({ ...draft(), authorAvatarUrl: null, authorDisplayName: null });
    await bookmarks.update(POST, { note: 'mine' });
    const saved = await bookmarks.save({
      ...draft(),
      authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
      text: 'edited text is not copied',
    });
    expect(saved).toMatchObject({
      authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/a.jpg',
      authorDisplayName: 'Author',
      text: 'Parent',
      note: 'mine',
    });
  });

  it('fills media that was missing when an old bookmark was saved, never replacing any', async () => {
    await bookmarks.save(draft([]));
    expect((await bookmarks.save(draft([photo('P1')]))).media).toHaveLength(1);
    expect((await bookmarks.save(draft([photo('P2'), photo('P3')]))).media).toEqual([photo('P1')]);
  });
});
