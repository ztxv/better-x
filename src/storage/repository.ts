import {
  SCHEMA_VERSION,
  type BulkAction,
  type BulkResult,
  type Bookmark,
  type BookmarkDraft,
  type BookmarkPatch,
  type ClearResult,
  type Collection,
  type DownloadRecord,
  type ExportData,
  type Library,
} from '../types/model';
import { cleanContext, cleanText, safeImageUrl, withContext } from '../lib/context';
import { normalizeTag, validateExport } from '../lib/validation';
import { parsePostUrl } from '../x/url';
import { database, done, downloadsChanged, libraryChanged as changed, result } from './db';

export class BookmarkRepository {
  async bulk(ids: string[], action: BulkAction): Promise<BulkResult> {
    const wanted = new Set(ids);
    const tag = action.type === 'addTag' ? normalizeTag(action.tag) : '';
    if (action.type === 'addTag' && !tag) throw new Error('Enter a tag.');
    const transaction = (await database()).transaction(['bookmarks', 'collections'], 'readwrite');
    const completion = done(transaction);
    const output: BulkResult = { affected: 0, deleted: [] };
    let failure = '';
    const run = () => {
      const cursorRequest = transaction.objectStore('bookmarks').openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const bookmark = cursor.value as Bookmark;
        if (wanted.has(bookmark.id)) {
          if (action.type === 'delete') {
            output.deleted.push(bookmark);
            cursor.delete();
          } else if (action.type === 'move') {
            cursor.update({ ...bookmark, collectionId: action.collectionId });
          } else {
            if (!bookmark.tags.includes(tag) && bookmark.tags.length >= 50) {
              failure = 'A selected bookmark already has 50 tags. No changes were made.';
              transaction.abort();
              return;
            }
            cursor.update({
              ...bookmark,
              tags: [...new Set([...bookmark.tags, tag])],
            });
          }
          output.affected++;
        }
        cursor.continue();
      };
    };
    if (action.type === 'move' && action.collectionId) {
      const collection = transaction.objectStore('collections').get(action.collectionId);
      collection.onsuccess = () => {
        if (!collection.result) {
          failure = 'Collection no longer exists.';
          transaction.abort();
        } else run();
      };
    } else run();
    try {
      await completion;
    } catch (error) {
      throw failure ? new Error(failure) : error;
    }
    if (output.affected) await changed();
    return output;
  }

  async restore(bookmarks: Bookmark[]): Promise<void> {
    const transaction = (await database()).transaction(['bookmarks', 'collections'], 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('bookmarks');
    for (const input of bookmarks) {
      const bookmark: Bookmark = {
        ...input,
        ...cleanContext(input as unknown as Record<string, unknown>),
      };
      const existing = store.get(bookmark.id);
      existing.onsuccess = () => {
        if (existing.result) return;
        if (!bookmark.collectionId) {
          store.put(bookmark);
          return;
        }
        const collection = transaction.objectStore('collections').get(bookmark.collectionId);
        collection.onsuccess = () =>
          store.put({
            ...bookmark,
            collectionId: collection.result ? bookmark.collectionId : null,
          });
      };
    }
    await completion;
    await changed();
  }

  async list(): Promise<Library> {
    const db = await database();
    const transaction = db.transaction(['bookmarks', 'collections'], 'readonly');
    const bookmarks = await result<Bookmark[]>(transaction.objectStore('bookmarks').getAll());
    const collections = await result<Collection[]>(transaction.objectStore('collections').getAll());
    return {
      bookmarks: bookmarks.map(withContext).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      collections: collections.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async get(id: string): Promise<Bookmark | null> {
    const transaction = (await database()).transaction('bookmarks', 'readonly');
    const bookmark = await result<Bookmark | undefined>(
      transaction.objectStore('bookmarks').get(id),
    );
    return bookmark ? withContext(bookmark) : null;
  }

  /**
   * Saves a post, or returns the existing bookmark. Reading and writing happen in one
   * transaction, so a duplicate save from another tab can never replace a bookmark (and its
   * notes, tags, collection, or save date). An existing bookmark only gains author details
   * that were missing when it was first saved.
   */
  async save(draft: BookmarkDraft): Promise<Bookmark> {
    const identity = parsePostUrl(draft.url);
    if (!identity || identity.tweetId !== draft.tweetId) throw new Error('Invalid post URL.');
    const fresh: Bookmark = {
      ...draft,
      ...cleanContext(draft as unknown as Record<string, unknown>),
      id: identity.tweetId,
      tweetId: identity.tweetId,
      url: identity.url,
      authorHandle: identity.handle,
      authorDisplayName: cleanText(draft.authorDisplayName, 160),
      authorAvatarUrl: safeImageUrl(draft.authorAvatarUrl),
      text: cleanText(draft.text, 20000),
      createdAt: typeof draft.createdAt === 'string' ? draft.createdAt.slice(0, 40) : null,
      savedAt: new Date().toISOString(),
      collectionId: null,
      tags: [],
      note: '',
      schemaVersion: SCHEMA_VERSION,
    };
    const transaction = (await database()).transaction('bookmarks', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('bookmarks');
    const request = store.get(identity.tweetId);
    let saved = fresh;
    let modified = false;
    request.onsuccess = () => {
      const current = request.result as Bookmark | undefined;
      if (!current) {
        store.put(fresh);
        modified = true;
        return;
      }
      saved = withContext(current);
      const avatar = fresh.authorAvatarUrl;
      const name = fresh.authorDisplayName;
      if ((!current.authorAvatarUrl && avatar) || (!current.authorDisplayName && name)) {
        saved = {
          ...saved,
          authorAvatarUrl: current.authorAvatarUrl || avatar,
          authorDisplayName: current.authorDisplayName || name,
        };
        store.put(saved);
        modified = true;
      }
    };
    await completion;
    if (modified) await changed();
    return saved;
  }

  /** Just the saved post IDs: what the X page needs, without transferring the whole library. */
  async savedIds(): Promise<string[]> {
    const transaction = (await database()).transaction('bookmarks', 'readonly');
    return (await result(transaction.objectStore('bookmarks').getAllKeys())).map(String);
  }

  async update(id: string, patch: BookmarkPatch): Promise<Bookmark> {
    const existing = await this.get(id);
    if (!existing) throw new Error('Bookmark not found.');
    if (patch.collectionId) {
      const collection = await result<Collection | undefined>(
        (await database())
          .transaction('collections')
          .objectStore('collections')
          .get(patch.collectionId),
      );
      if (!collection) throw new Error('Collection not found.');
    }
    const bookmark: Bookmark = {
      ...existing,
      collectionId: patch.collectionId === undefined ? existing.collectionId : patch.collectionId,
      note: patch.note === undefined ? existing.note : patch.note.slice(0, 10000),
      tags:
        patch.tags === undefined
          ? existing.tags
          : [...new Set(patch.tags.map(normalizeTag).filter(Boolean))].slice(0, 50),
    };
    const transaction = (await database()).transaction('bookmarks', 'readwrite');
    transaction.objectStore('bookmarks').put(bookmark);
    await done(transaction);
    await changed();
    return bookmark;
  }

  /**
   * Deletes every bookmark in one transaction and publishes one revision. Collections and
   * settings are kept. Returns the removed rows so the panel can offer a short Undo.
   */
  async clearBookmarks(): Promise<ClearResult> {
    const transaction = (await database()).transaction('bookmarks', 'readwrite');
    const completion = done(transaction);
    const store = transaction.objectStore('bookmarks');
    const all = store.getAll();
    let deleted: Bookmark[] = [];
    all.onsuccess = () => {
      deleted = all.result as Bookmark[];
      store.clear();
    };
    await completion;
    if (deleted.length) await changed();
    return { deleted };
  }

  async delete(id: string): Promise<void> {
    const transaction = (await database()).transaction('bookmarks', 'readwrite');
    transaction.objectStore('bookmarks').delete(id);
    await done(transaction);
    await changed();
  }

  async createCollection(name: string): Promise<Collection> {
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new Error('Enter a collection name.');
    const collection = {
      id: crypto.randomUUID(),
      name: clean,
      createdAt: new Date().toISOString(),
    };
    const transaction = (await database()).transaction('collections', 'readwrite');
    transaction.objectStore('collections').put(collection);
    await done(transaction);
    await changed();
    return collection;
  }

  async renameCollection(id: string, name: string): Promise<Collection> {
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new Error('Enter a collection name.');
    const db = await database();
    const existing = await result<Collection | undefined>(
      db.transaction('collections').objectStore('collections').get(id),
    );
    if (!existing) throw new Error('Collection not found.');
    const updated = { ...existing, name: clean };
    const transaction = db.transaction('collections', 'readwrite');
    transaction.objectStore('collections').put(updated);
    await done(transaction);
    await changed();
    return updated;
  }

  async deleteCollection(id: string): Promise<void> {
    const db = await database();
    const transaction = db.transaction(['bookmarks', 'collections'], 'readwrite');
    const bookmarks = await result<Bookmark[]>(transaction.objectStore('bookmarks').getAll());
    for (const bookmark of bookmarks)
      if (bookmark.collectionId === id)
        transaction.objectStore('bookmarks').put({ ...bookmark, collectionId: null });
    transaction.objectStore('collections').delete(id);
    await done(transaction);
    await changed();
  }

  /**
   * Adds what the backup has and this browser does not. Existing bookmarks win entirely: an
   * imported duplicate never changes local notes, tags, or collection placement. Imported
   * download history becomes `historical` (no local file), and is skipped if already present.
   */
  async import(data: ExportData): Promise<{ imported: number; downloads: number }> {
    const safe = validateExport(data);
    const current = await this.list();
    const bookmarkIds = new Set(current.bookmarks.map((bookmark) => bookmark.id));
    const collectionIds = new Set(current.collections.map((collection) => collection.id));
    const newBookmarks = safe.bookmarks.filter((bookmark) => {
      if (bookmarkIds.has(bookmark.id)) return false;
      bookmarkIds.add(bookmark.id);
      return true;
    });
    const newCollections = safe.collections.filter((collection) => {
      if (collectionIds.has(collection.id)) return false;
      collectionIds.add(collection.id);
      return true;
    });
    const transaction = (await database()).transaction(
      ['bookmarks', 'collections', 'downloads'],
      'readwrite',
    );
    const completion = done(transaction);
    for (const collection of newCollections) transaction.objectStore('collections').put(collection);
    for (const bookmark of newBookmarks) transaction.objectStore('bookmarks').put(bookmark);
    const downloads = transaction.objectStore('downloads');
    const now = new Date().toISOString();
    let importedDownloads = 0;
    for (const record of safe.downloads) {
      const existing = downloads.getKey(record.id);
      existing.onsuccess = () => {
        if (existing.result !== undefined) return;
        importedDownloads++;
        downloads.put({
          ...record,
          status: 'historical',
          chromeId: null,
          url: null,
          error: null,
          updatedAt: now,
        } satisfies DownloadRecord);
      };
    }
    await completion;
    if (newBookmarks.length || newCollections.length) await changed();
    if (importedDownloads) await downloadsChanged();
    return { imported: newBookmarks.length, downloads: importedDownloads };
  }
}
