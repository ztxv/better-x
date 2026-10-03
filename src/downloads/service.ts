import type {
  Bookmark,
  BookmarkDraft,
  DownloadError,
  DownloadRecord,
  MediaTarget,
  PostMedia,
  StartOutcome,
  StartResult,
} from '../types/model';
import { cleanSnapshot } from '../lib/context';
import type { Settings } from '../lib/settings';
import { resolveMedia, type Resolution } from '../media/resolver';
import { isMediaKey, mediaKey } from '../media/urls';
import { downloadPath } from './filename';
import { ACTIVE, applyChromeState, type ChromeState, type DownloadRepository } from './repository';

/** The subset of `chrome.downloads` the service uses, so tests can supply a fake. */
export interface Downloader {
  download(options: chrome.downloads.DownloadOptions): Promise<number>;
  search(query: chrome.downloads.DownloadQuery): Promise<chrome.downloads.DownloadItem[]>;
  cancel(id: number): Promise<void>;
}

export interface ServiceDeps {
  downloads: DownloadRepository;
  /** The saved bookmark for a post, if it is still in the library. */
  bookmark: (tweetId: string) => Promise<Bookmark | null>;
  downloader: () => Downloader | null;
  settings: () => Promise<Settings>;
  fetcher?: typeof fetch;
  now?: () => string;
  uuid?: () => string;
}

const POST_ID = /^\d{1,25}$/;

/** Rejects anything but a list of media identities for one post. Never accepts a URL. */
export function validateTargets(input: unknown): MediaTarget[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8)
    throw new Error('Choose media to download.');
  const targets = input.map((value): MediaTarget => {
    const target = value as Partial<MediaTarget> | null;
    if (
      !target ||
      typeof target.tweetId !== 'string' ||
      !POST_ID.test(target.tweetId) ||
      (target.scope !== 'post' && target.scope !== 'quote') ||
      !Number.isInteger(target.index) ||
      target.index! < 0 ||
      target.index! > 3 ||
      !(target.key === null || isMediaKey(target.key))
    )
      throw new Error('Invalid download request.');
    return { tweetId: target.tweetId, scope: target.scope, index: target.index!, key: target.key };
  });
  if (new Set(targets.map((target) => target.tweetId)).size !== 1)
    throw new Error('Invalid download request.');
  return targets;
}

/** The media list a target points into, with the post that owns it. */
function mediaList(post: BookmarkDraft, scope: MediaTarget['scope']) {
  if (scope === 'post') return { sourceTweetId: post.tweetId, media: post.media };
  return { sourceTweetId: post.quote?.tweetId ?? null, media: post.quote?.media ?? [] };
}

/** Finds the saved item for a target by stable key first, then by position. */
export function findItem(
  media: PostMedia[],
  target: MediaTarget,
): { item: PostMedia; index: number } | null {
  if (target.key && !target.key.startsWith('n:')) {
    const index = media.findIndex((item, position) => mediaKey(item, position) === target.key);
    if (index >= 0) return { item: media[index]!, index };
  }
  const item = media[target.index];
  return item ? { item, index: target.index } : null;
}

const ERRORS: Partial<Record<Resolution['status'], DownloadError>> = {
  needsPost: 'needsPost',
  unsupported: 'unsupported',
  unavailable: 'unavailable',
  network: 'network',
};

/**
 * Owns starting downloads and following them through Chrome. Intent is stored before the
 * browser is asked to download, the Chrome ID is bound as soon as it is known, and every later
 * state comes from Chrome's own events or a search, never from assumptions. A start whose
 * outcome is uncertain after a restart is reported, never repeated automatically.
 */
export class DownloadService {
  /** Records this worker instance is actively resolving or starting. */
  private readonly inFlight = new Set<string>();
  private readonly now: () => string;
  private readonly uuid: () => string;

  constructor(private readonly deps: ServiceDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
    this.uuid = deps.uuid ?? (() => crypto.randomUUID());
  }

  /** The post to download from: the bookmark, or the snapshot kept with its download history. */
  private async post(tweetId: string): Promise<BookmarkDraft | null> {
    const bookmark = await this.deps.bookmark(tweetId);
    if (bookmark) return bookmark;
    const records = await this.deps.downloads.forPost(tweetId);
    const latest = records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest ? cleanSnapshot(latest.snapshot) : null;
  }

  async start(input: unknown): Promise<StartResult> {
    const targets = validateTargets(input);
    const tweetId = targets[0]!.tweetId;
    const post = await this.post(tweetId);
    if (!post) throw new Error('This post is no longer in your library.');
    const snapshot = cleanSnapshot(post)!;
    const batchId = this.uuid();
    const now = this.now();
    const outcomes: StartOutcome[] = [];
    const planned: Array<{ target: MediaTarget; record: DownloadRecord; item: PostMedia }> = [];

    for (const target of targets) {
      const { sourceTweetId, media } = mediaList(post, target.scope);
      const found = findItem(media, target);
      if (!sourceTweetId || !found) {
        outcomes.push({ target, status: 'failed', error: 'needsPost', recordId: null });
        continue;
      }
      const key = `${sourceTweetId}:${mediaKey(found.item, found.index)}`;
      if (planned.some((entry) => entry.record.mediaKey === key)) continue;
      const handle =
        target.scope === 'post' ? post.authorHandle : (post.quote?.authorHandle ?? null);
      planned.push({
        target,
        item: found.item,
        record: {
          id: this.uuid(),
          batchId,
          tweetId,
          sourceTweetId,
          scope: target.scope,
          mediaIndex: found.index,
          mediaKind: found.item.kind,
          mediaKey: key,
          previewUrl: found.item.thumbnailUrl,
          snapshot,
          chromeId: null,
          status: 'resolving',
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          // Placeholder until the real extension is known.
          filename: downloadPath(handle, sourceTweetId, found.index, 'bin').split('/').pop()!,
          url: null,
          error: null,
        },
      });
    }

    const { created, pending } = await this.deps.downloads.begin(
      planned.map((entry) => entry.record),
    );
    for (const entry of planned) {
      const existing = pending.get(entry.record.mediaKey);
      if (existing) outcomes.push({ target: entry.target, status: 'pending', recordId: existing });
    }
    const createdIds = new Set(created.map((record) => record.id));
    const settings = await this.deps.settings();
    const runs = planned
      .filter((entry) => createdIds.has(entry.record.id))
      .map((entry) => this.run(entry.record, entry.item, entry.target, settings.saveAs));
    outcomes.push(...(await Promise.all(runs)));
    return { batchId, outcomes };
  }

  private async fail(record: DownloadRecord, error: DownloadError): Promise<void> {
    await this.deps.downloads.transition(record.id, (current) =>
      ACTIVE.has(current.status)
        ? { ...current, status: 'interrupted', error, updatedAt: this.now() }
        : null,
    );
  }

  private async run(
    record: DownloadRecord,
    item: PostMedia,
    target: MediaTarget,
    saveAs: boolean,
  ): Promise<StartOutcome> {
    this.inFlight.add(record.id);
    const failed = async (error: DownloadError): Promise<StartOutcome> => {
      await this.fail(record, error);
      return { target, status: 'failed', error, recordId: record.id };
    };
    try {
      const downloader = this.deps.downloader();
      if (!downloader) return await failed('permission');
      const resolution = await resolveMedia(
        {
          sourceTweetId: record.sourceTweetId,
          index: record.mediaIndex,
          kind: record.mediaKind,
          key: record.mediaKey.slice(record.mediaKey.indexOf(':') + 1),
          item,
        },
        this.deps.fetcher,
      );
      if (resolution.status !== 'available')
        return await failed(ERRORS[resolution.status] ?? 'unknown');

      const handle =
        record.scope === 'post'
          ? record.snapshot.authorHandle
          : (record.snapshot.quote?.authorHandle ?? null);
      const path = downloadPath(
        handle,
        record.sourceTweetId,
        record.mediaIndex,
        resolution.extension,
      );
      // Persist the intent before asking Chrome, so a restart can find what was started.
      const starting = await this.deps.downloads.transition(record.id, (current) =>
        current.status === 'resolving'
          ? {
              ...current,
              status: 'starting',
              url: resolution.url,
              filename: path.split('/').pop()!,
              updatedAt: this.now(),
            }
          : null,
      );
      if (!starting) return { target, status: 'failed', error: 'interrupted', recordId: record.id };

      let chromeId: number;
      try {
        chromeId = await downloader.download({
          url: resolution.url,
          filename: path,
          conflictAction: 'uniquify',
          saveAs,
        });
      } catch {
        return await failed('unknown');
      }
      await this.deps.downloads.transition(record.id, (current) =>
        current.status === 'starting' || current.status === 'resolving'
          ? { ...current, chromeId, status: 'inProgress', updatedAt: this.now() }
          : current.chromeId === null
            ? { ...current, chromeId, updatedAt: this.now() }
            : null,
      );
      // Chrome may have finished (or failed) before the ID was stored; catch up now.
      await this.syncChrome(record.id, chromeId, downloader);
      return { target, status: 'started', recordId: record.id };
    } catch {
      return await failed('unknown');
    } finally {
      this.inFlight.delete(record.id);
    }
  }

  private async syncChrome(recordId: string, chromeId: number, downloader: Downloader) {
    const [item] = await downloader.search({ id: chromeId }).catch(() => []);
    if (!item) return;
    await this.deps.downloads.transition(recordId, (current) =>
      applyChromeState(
        current,
        { state: item.state, error: item.error, filename: item.filename },
        this.now(),
      ),
    );
  }

  /** Handles `chrome.downloads.onChanged`. Unknown IDs (not ours, or not yet bound) are ignored. */
  async onChanged(delta: chrome.downloads.DownloadDelta): Promise<void> {
    if (!delta.state?.current && !delta.filename?.current) return;
    const record = await this.deps.downloads.byChromeId(delta.id);
    if (!record) return;
    const downloader = this.deps.downloader();
    // Read the full current item, so a filename-only delta never guesses the state.
    const [item] = downloader ? await downloader.search({ id: delta.id }).catch(() => []) : [];
    const change: ChromeState | null = item
      ? { state: item.state, error: item.error, filename: item.filename }
      : delta.state?.current
        ? {
            state: delta.state.current as ChromeState['state'],
            error: delta.error?.current,
            filename: delta.filename?.current,
          }
        : null;
    if (!change) return;
    await this.deps.downloads.transition(record.id, (current) =>
      applyChromeState(current, change, this.now()),
    );
  }

  /**
   * Brings active records up to date after a worker restart or when a view opens. Records
   * this worker is still working on are skipped.
   */
  async reconcile(): Promise<void> {
    const downloader = this.deps.downloader();
    for (const record of await this.deps.downloads.active()) {
      if (this.inFlight.has(record.id)) continue;
      if (!downloader) {
        await this.fail(record, 'permission');
        continue;
      }
      if (record.chromeId !== null) {
        const [item] = await downloader.search({ id: record.chromeId }).catch(() => []);
        if (item) await this.syncChrome(record.id, record.chromeId, downloader);
        // Chrome no longer knows this download (erased from its list); its outcome is unknown.
        else await this.fail(record, 'unknown');
        continue;
      }
      if (record.status === 'starting' && record.url) {
        // The worker stopped between asking Chrome and storing the ID. Look for the download
        // instead of starting it again.
        const matches = await downloader
          .search({ url: record.url, startedAfter: record.createdAt })
          .catch(() => []);
        if (matches.length === 1) {
          const chromeId = matches[0]!.id;
          await this.deps.downloads.transition(record.id, (current) =>
            current.chromeId === null && ACTIVE.has(current.status)
              ? { ...current, chromeId, status: 'inProgress', updatedAt: this.now() }
              : null,
          );
          await this.syncChrome(record.id, chromeId, downloader);
          continue;
        }
      }
      await this.fail(record, 'unknown');
    }
  }

  /** Cancels a download in Chrome. The file is never deleted by this extension. */
  async cancel(recordId: string): Promise<void> {
    const record = await this.deps.downloads.get(recordId);
    if (!record || !ACTIVE.has(record.status)) return;
    const downloader = this.deps.downloader();
    if (record.chromeId !== null && downloader) {
      await downloader.cancel(record.chromeId);
      await this.syncChrome(record.id, record.chromeId, downloader);
      return;
    }
    // Not handed to Chrome yet: the running flow sees the status and stops before starting.
    await this.deps.downloads.transition(record.id, (current) =>
      current.status === 'resolving'
        ? { ...current, status: 'cancelled', updatedAt: this.now() }
        : null,
    );
  }
}
