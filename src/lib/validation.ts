import {
  EXPORT_VERSION,
  SCHEMA_VERSION,
  type Bookmark,
  type Collection,
  type ExportData,
} from '../types/model';
import { parsePostUrl } from '../x/url';
import { cleanContext } from './context';

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

export function validateExport(input: unknown): ExportData {
  if (
    !isRecord(input) ||
    input.format !== 'saved-for-x' ||
    // Version 1 files predate post context; their bookmarks import with empty context.
    (input.version !== 1 && input.version !== EXPORT_VERSION) ||
    !Array.isArray(input.bookmarks) ||
    !Array.isArray(input.collections) ||
    input.bookmarks.length > 100000 ||
    input.collections.length > 10000
  ) {
    throw new Error('This is not a valid Saved for X export.');
  }
  const collections: Collection[] = input.collections.map((value) => {
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
  const bookmarks: Bookmark[] = input.bookmarks.map((value) => {
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
    format: 'saved-for-x',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
    collections,
  };
}
