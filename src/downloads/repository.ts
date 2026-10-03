import type { DownloadError, DownloadRecord, DownloadStatus } from '../types/model';
import { database, done, downloadsChanged, result } from '../storage/db';

/**
 * Download history. Every change is a read-modify-write inside one IndexedDB transaction, so
 * two tabs, a Chrome event, and the worker's own flow can never overwrite each other.
 */

export const ACTIVE: ReadonlySet<DownloadStatus> = new Set(['resolving', 'starting', 'inProgress']);
/** Statuses that count a post as Downloaded. */
export const DONE: ReadonlySet<DownloadStatus> = new Set(['complete', 'historical']);

/** The state Chrome reports for a download, reduced to what the history needs. */
export interface ChromeState {
  state: 'in_progress' | 'interrupted' | 'complete';
  error?: string;
  filename?: string;
}

function chromeError(code: string | undefined): DownloadError {
  if (!code) return 'interrupted';
  if (code.startsWith('NETWORK_')) return 'network';
  if (code === 'SERVER_FORBIDDEN' || code === 'SERVER_BAD_CONTENT' || code === 'SERVER_GONE')
    return 'unavailable';
  if (code.startsWith('SERVER_')) return 'network';
  return 'interrupted';
}

/**
 * The next record for a Chrome state change, or null when nothing changes. Idempotent: the
 * same event applied twice changes nothing, and a completed download is never downgraded.
 */
export function applyChromeState(
  record: DownloadRecord,
  change: ChromeState,
  now: string,
): DownloadRecord | null {
  if (DONE.has(record.status)) return null;
  const filename = change.filename ? (change.filename.split(/[\\/]/).pop() ?? '') : '';
  let next: DownloadRecord;
  if (change.state === 'complete')
    next = { ...record, status: 'complete', completedAt: record.completedAt ?? now, error: null };
  else if (change.state === 'interrupted')
    next =
      change.error === 'USER_CANCELED'
        ? { ...record, status: 'cancelled', error: null }
        : { ...record, status: 'interrupted', error: chromeError(change.error) };
  // A resumed download (from Chrome's own download list) becomes active again.
  else next = { ...record, status: 'inProgress', error: null };
  if (filename) next.filename = filename.slice(0, 200);
  if (
    next.status === record.status &&
    next.error === record.error &&
    next.filename === record.filename
  )
    return null;
  return { ...next, updatedAt: now };
}

export class DownloadRepository {
  async list(): Promise<DownloadRecord[]> {
    const transaction = (await database()).transaction('downloads', 'readonly');
    const records = await result<DownloadRecord[]>(transaction.objectStore('downloads').getAll());
    return records.sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
    );
  }

  async get(id: string): Promise<DownloadRecord | null> {
    const transaction = (await database()).transaction('downloads', 'readonly');
    return (await result(transaction.objectStore('downloads').get(id))) ?? null;
  }

  async forPost(tweetId: string): Promise<DownloadRecord[]> {
    const transaction = (await database()).transaction('downloads', 'readonly');
    const index = transaction.objectStore('downloads').index('tweetId');
    return result<DownloadRecord[]>(index.getAll(tweetId));
  }

  async byChromeId(chromeId: number): Promise<DownloadRecord | null> {
    const transaction = (await database()).transaction('downloads', 'readonly');
    const index = transaction.objectStore('downloads').index('chromeId');
    return (await result<DownloadRecord | undefined>(index.get(chromeId))) ?? null;
  }

  async active(): Promise<DownloadRecord[]> {
    return (await this.list()).filter((record) => ACTIVE.has(record.status));
  }

  /**
   * Records the intent to download each item before anything is requested. An item that
   * already has an active download is not started again; its record ID is returned instead.
   * Earlier failed or cancelled attempts at the same item are replaced, so history never
   * fills with retries.
   */
  async begin(
    records: DownloadRecord[],
  ): Promise<{ created: DownloadRecord[]; pending: Map<string, string> }> {
    const created: DownloadRecord[] = [];
    const pending = new Map<string, string>();
    if (!records.length) return { created, pending };
    const transaction = (await database()).transaction('downloads', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('downloads');
    const existing = store.index('tweetId').getAll(records[0]!.tweetId);
    existing.onsuccess = () => {
      const rows = existing.result as DownloadRecord[];
      for (const record of records) {
        const same = rows.filter((row) => row.mediaKey === record.mediaKey);
        const busy = same.find((row) => ACTIVE.has(row.status));
        if (busy || pending.has(record.mediaKey)) {
          pending.set(record.mediaKey, busy?.id ?? pending.get(record.mediaKey)!);
          continue;
        }
        for (const row of same)
          if (row.status === 'interrupted' || row.status === 'cancelled') store.delete(row.id);
        store.put(record);
        created.push(record);
        pending.set(record.mediaKey, record.id);
      }
      // `pending` now also holds the new IDs; keep only the duplicates for the caller.
      for (const record of created) pending.delete(record.mediaKey);
    };
    await completion;
    if (created.length) await downloadsChanged();
    return { created, pending };
  }

  /** Atomically replaces a record with `update(current)`; null from `update` leaves it as is. */
  async transition(
    id: string,
    update: (current: DownloadRecord) => DownloadRecord | null,
  ): Promise<DownloadRecord | null> {
    const transaction = (await database()).transaction('downloads', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('downloads');
    const request = store.get(id);
    let next: DownloadRecord | null = null;
    request.onsuccess = () => {
      const current = request.result as DownloadRecord | undefined;
      if (!current) return;
      next = update(current);
      if (next) store.put(next);
    };
    await completion;
    if (next) await downloadsChanged();
    return next;
  }

  /**
   * Clears finished history (completed, imported, failed, cancelled). Downloads still in
   * progress are kept so their outcome is not lost. Files on disk are never touched.
   */
  async clear(): Promise<DownloadRecord[]> {
    const transaction = (await database()).transaction('downloads', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('downloads');
    const all = store.getAll();
    const deleted: DownloadRecord[] = [];
    all.onsuccess = () => {
      for (const record of all.result as DownloadRecord[])
        if (!ACTIVE.has(record.status)) {
          deleted.push(record);
          store.delete(record.id);
        }
    };
    await completion;
    if (deleted.length) await downloadsChanged();
    return deleted;
  }

  /** Puts back cleared records (Undo). Records that exist again are left alone. */
  async restore(records: DownloadRecord[]): Promise<void> {
    const transaction = (await database()).transaction('downloads', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('downloads');
    for (const record of records) {
      const existing = store.getKey(record.id);
      existing.onsuccess = () => {
        if (existing.result === undefined) store.put(record);
      };
    }
    await completion;
    await downloadsChanged();
  }
}
