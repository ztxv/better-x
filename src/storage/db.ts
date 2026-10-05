/**
 * The extension's one IndexedDB database. Version history:
 * 1. `bookmarks` and `collections` (keyed by `id`).
 * 2. `downloads` (keyed by `id`) with indexes on `tweetId`, `chromeId`, and `status`.
 * Upgrades only add stores and indexes, so existing bookmarks and collections are untouched.
 * The schema is the one Saved for X used; Better X opens it under its own name, so it starts
 * empty and receives existing libraries through backup import.
 */
const DB_NAME = 'better-x';

/** `chrome.storage.local` keys that tell every open view the library or history changed. */
export const LIBRARY_REVISION_KEY = 'bx.libraryRevision';
export const DOWNLOADS_REVISION_KEY = 'bx.downloadsRevision';
export const DB_VERSION = 2;
let opening: Promise<IDBDatabase> | null = null;

export function database(): Promise<IDBDatabase> {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('bookmarks'))
          db.createObjectStore('bookmarks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('collections'))
          db.createObjectStore('collections', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('downloads')) {
          const downloads = db.createObjectStore('downloads', { keyPath: 'id' });
          downloads.createIndex('tweetId', 'tweetId');
          downloads.createIndex('chromeId', 'chromeId');
          downloads.createIndex('status', 'status');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another context (an updated worker) needs a newer schema: let it upgrade.
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        opening = null;
        reject(request.error);
      };
    });
  return opening;
}

/** Closes and forgets the connection (tests use this between fresh databases). */
export async function resetConnection(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) (await current.catch(() => null))?.close();
}

export function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Database transaction aborted.'));
  });
}

/** Tells every open view that bookmarks or collections changed. */
export async function libraryChanged(): Promise<void> {
  await chrome.storage.local.set({ [LIBRARY_REVISION_KEY]: Date.now() + Math.random() });
}

/** Tells every open view that download history changed (kept separate from the library). */
export async function downloadsChanged(): Promise<void> {
  await chrome.storage.local.set({ [DOWNLOADS_REVISION_KEY]: Date.now() + Math.random() });
}
