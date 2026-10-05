import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  SCHEMA_VERSION,
  type Bookmark,
  type Collection,
  type ExportData,
  type ExportedDownload,
  type MediaKind,
} from '../types/model';
import { displayName } from '../downloads/filename';
import { upgradeBackup } from './backup';
import { isMediaKey } from '../media/urls';
import { parsePostUrl } from '../x/url';
import { cleanContext, cleanSnapshot, safeImageUrl } from './context';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const validOptionalText = (value: unknown, max: number) => value === null || validText(value, max);
const validDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const safeAvatar = (value: string | null): string | null =>
  value && /^https:\/\/([a-z0-9.-]+\.)?twimg\.com\//i.test(value) ? value : null;

export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, 40).toLowerCase();
}

/**
 * Checks a backup of any importable format (see `src/lib/backup.ts`) and returns it as a current
 * Better X backup. Format and version problems, then malformed lists or records, are rejected
 * with a message; unsafe optional fields and invalid history entries are dropped instead.
 */
export function validateExport(input: unknown): ExportData {
  const upgraded = upgradeBackup(isRecord(input) ? input : {});
  const { bookmarks: rawBookmarks, collections: rawCollections } = upgraded;
  if (
    !Array.isArray(rawBookmarks) ||
    !Array.isArray(rawCollections) ||
    rawBookmarks.length > 100000 ||
    rawCollections.length > 10000
  ) {
    throw new Error('This backup is damaged: its bookmark or collection list is missing.');
  }
  const collections: Collection[] = rawCollections.map((value) => {
    if (
      !isRecord(value) ||
      !validText(value.id, 100) ||
      !validText(value.name, 80) ||
      !validDate(value.createdAt)
    )
      throw new Error('Export contains an invalid collection.');
    return {
      id: value.id as string,
      name: value.name as string,
      createdAt: value.createdAt as string,
    };
  });
  const bookmarks: Bookmark[] = rawBookmarks.map((value) => {
    if (
      !isRecord(value) ||
      !validText(value.id, 100) ||
      !validText(value.tweetId, 32) ||
      !/^\d+$/.test(value.tweetId as string) ||
      !validText(value.url, 500) ||
      parsePostUrl(value.url as string)?.tweetId !== value.tweetId ||
      !validOptionalText(value.authorHandle, 40) ||
      !validOptionalText(value.authorDisplayName, 160) ||
      !validOptionalText(value.authorAvatarUrl, 1000) ||
      !validOptionalText(value.text, 20000) ||
      !(value.createdAt === null || validDate(value.createdAt)) ||
      !validDate(value.savedAt) ||
      !(value.collectionId === null || validText(value.collectionId, 100)) ||
      !Array.isArray(value.tags) ||
      value.tags.length > 50 ||
      !value.tags.every((tag) => validText(tag, 40)) ||
      !validText(value.note, 10000)
    )
      throw new Error('Export contains an invalid bookmark.');
    const identity = parsePostUrl(value.url as string)!;
    return {
      id: identity.tweetId,
      tweetId: identity.tweetId,
      url: identity.url,
      authorHandle: value.authorHandle as string | null,
      authorDisplayName: value.authorDisplayName as string | null,
      authorAvatarUrl: safeAvatar(value.authorAvatarUrl as string | null),
      text: value.text as string | null,
      createdAt: value.createdAt as string | null,
      savedAt: value.savedAt as string,
      collectionId: value.collectionId as string | null,
      tags: [...new Set((value.tags as string[]).map(normalizeTag).filter(Boolean))],
      note: value.note as string,
      ...cleanContext(value),
      schemaVersion: SCHEMA_VERSION,
    };
  });
  const known = new Set(collections.map((collection) => collection.id));
  for (const bookmark of bookmarks)
    if (bookmark.collectionId && !known.has(bookmark.collectionId)) bookmark.collectionId = null;
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
    collections,
    downloads: cleanDownloads(upgraded.downloads),
  };
}

const KINDS = new Set<MediaKind>(['image', 'video', 'gif']);
const POST_ID = /^\d{1,32}$/;

/**
 * Download history is metadata about files in another browser, so it is lenient: an invalid
 * entry is skipped instead of rejecting the backup. Only completed downloads are accepted.
 */
export function cleanDownloads(input: unknown): ExportedDownload[] {
  if (!Array.isArray(input)) return [];
  const output: ExportedDownload[] = [];
  for (const value of input.slice(0, 100000)) {
    if (!isRecord(value)) continue;
    const snapshot = cleanSnapshot(value.snapshot);
    const sourceTweetId = value.sourceTweetId;
    const key = typeof value.mediaKey === 'string' ? value.mediaKey : '';
    const separator = key.indexOf(':');
    if (
      !snapshot ||
      !validText(value.id, 100) ||
      !validText(value.batchId, 100) ||
      value.tweetId !== snapshot.tweetId ||
      typeof sourceTweetId !== 'string' ||
      !POST_ID.test(sourceTweetId) ||
      (value.scope !== 'post' && value.scope !== 'quote') ||
      !Number.isInteger(value.mediaIndex) ||
      (value.mediaIndex as number) < 0 ||
      (value.mediaIndex as number) > 3 ||
      !KINDS.has(value.mediaKind as MediaKind) ||
      key.slice(0, separator) !== sourceTweetId ||
      !isMediaKey(key.slice(separator + 1)) ||
      !validDate(value.createdAt) ||
      !validDate(value.completedAt) ||
      !validText(value.filename, 1000)
    )
      continue;
    output.push({
      id: value.id as string,
      batchId: value.batchId as string,
      tweetId: snapshot.tweetId,
      sourceTweetId,
      scope: value.scope,
      mediaIndex: value.mediaIndex as number,
      mediaKind: value.mediaKind as MediaKind,
      mediaKey: key,
      previewUrl: safeImageUrl(value.previewUrl),
      snapshot,
      createdAt: value.createdAt as string,
      completedAt: value.completedAt as string,
      filename: displayName(value.filename as string),
    });
  }
  return output;
}
