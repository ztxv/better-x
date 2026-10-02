export const SCHEMA_VERSION = 1;

export interface Bookmark {
  id: string;
  tweetId: string;
  url: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  text: string | null;
  createdAt: string | null;
  savedAt: string;
  collectionId: string | null;
  tags: string[];
  note: string;
  schemaVersion: number;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
}

export type BookmarkDraft = Omit<
  Bookmark,
  'id' | 'savedAt' | 'collectionId' | 'tags' | 'note' | 'schemaVersion'
>;
export type BookmarkPatch = Partial<Pick<Bookmark, 'collectionId' | 'tags' | 'note'>>;
export interface Library {
  bookmarks: Bookmark[];
  collections: Collection[];
}
export interface ExportData extends Library {
  format: 'saved-for-x';
  version: 1;
  exportedAt: string;
}

export type Request =
  | { type: 'openPanel' }
  | { type: 'list' }
  | { type: 'get'; id: string }
  | { type: 'save'; draft: BookmarkDraft }
  | { type: 'update'; id: string; patch: BookmarkPatch }
  | { type: 'delete'; id: string }
  | { type: 'createCollection'; name: string }
  | { type: 'renameCollection'; id: string; name: string }
  | { type: 'deleteCollection'; id: string }
  | { type: 'import'; data: ExportData };

export type Response = { ok: true; data: unknown } | { ok: false; error: string };
