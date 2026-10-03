import type { BookmarkDraft, DownloadRecord, ExportedDownload } from '../types/model';
import { ACTIVE, DONE } from './repository';

/** Completed history in backup form: no Chrome IDs, file URLs, statuses, or folders. */
export function exportDownloads(records: DownloadRecord[]): ExportedDownload[] {
  return records
    .filter((record) => DONE.has(record.status) && record.completedAt)
    .map((record) => ({
      id: record.id,
      batchId: record.batchId,
      tweetId: record.tweetId,
      sourceTweetId: record.sourceTweetId,
      scope: record.scope,
      mediaIndex: record.mediaIndex,
      mediaKind: record.mediaKind,
      mediaKey: record.mediaKey,
      previewUrl: record.previewUrl,
      snapshot: record.snapshot,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
      filename: record.filename,
    }));
}

/** What the library shows for one post's downloads. */
export interface PostDownloads {
  tweetId: string;
  /** Distinct media items with a completed (or imported) download. */
  done: Set<string>;
  /** Media items attempted, from either list (post or quote). */
  attempted: Set<string>;
  active: DownloadRecord[];
  failed: DownloadRecord[];
  lastCompletedAt: string | null;
  /** Every record for this post (newest first). */
  records: DownloadRecord[];
  snapshot: BookmarkDraft;
  /** True when every completed record was imported from another browser. */
  historicalOnly: boolean;
}

/** Groups history by saved post. Only posts with something to show are included. */
export function groupByPost(records: DownloadRecord[]): Map<string, PostDownloads> {
  const groups = new Map<string, PostDownloads>();
  const sorted = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const record of sorted) {
    let group = groups.get(record.tweetId);
    if (!group) {
      group = {
        tweetId: record.tweetId,
        done: new Set(),
        attempted: new Set(),
        active: [],
        failed: [],
        lastCompletedAt: null,
        records: [],
        snapshot: record.snapshot,
        historicalOnly: true,
      };
      groups.set(record.tweetId, group);
    }
    group.records.push(record);
    group.attempted.add(record.mediaKey);
    if (DONE.has(record.status)) {
      group.done.add(record.mediaKey);
      if (record.status === 'complete') group.historicalOnly = false;
      if (
        record.completedAt &&
        (!group.lastCompletedAt || record.completedAt > group.lastCompletedAt)
      )
        group.lastCompletedAt = record.completedAt;
    } else if (ACTIVE.has(record.status)) group.active.push(record);
    else group.failed.push(record);
  }
  // A failure is only worth showing while that item has not been downloaded since.
  for (const group of groups.values())
    group.failed = group.failed.filter((record) => !group.done.has(record.mediaKey));
  return groups;
}

/** The latest record for each media item of a post. */
export function latestByMedia(records: DownloadRecord[]): Map<string, DownloadRecord> {
  const latest = new Map<string, DownloadRecord>();
  for (const record of records) {
    const current = latest.get(record.mediaKey);
    const better =
      !current ||
      (DONE.has(record.status) && !DONE.has(current.status)) ||
      (DONE.has(record.status) === DONE.has(current.status) &&
        record.updatedAt > current.updatedAt);
    if (better) latest.set(record.mediaKey, record);
  }
  return latest;
}
