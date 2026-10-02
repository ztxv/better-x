export const SCHEMA_VERSION = 2;
export const EXPORT_VERSION = 2;

export type MediaKind = 'image' | 'video' | 'gif';

/** One visible photo, video, or GIF. `thumbnailUrl` is null when X showed no preview. */
export interface PostMedia {
  kind: MediaKind;
  thumbnailUrl: string | null;
  alt: string | null;
}

/** A link preview card, or an X Article preview, as shown under the post. */
export interface LinkCard {
  kind: 'link' | 'article';
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

/** The post quoted inside the saved post. Some fields are unavailable in X's compact quotes. */
export interface QuotedPost {
  tweetId: string | null;
  url: string | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  text: string | null;
  createdAt: string | null;
  media: PostMedia[];
}

/** What the saved post replies to. A timeline may expose only the handle. */
export interface ReplyContext {
  tweetId: string | null;
  url: string | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  text: string | null;
}

export interface PostContext {
  media: PostMedia[];
  quote: QuotedPost | null;
  replyTo: ReplyContext | null;
  card: LinkCard | null;
}

export interface Bookmark extends PostContext {
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
  version: typeof EXPORT_VERSION;
  exportedAt: string;
}

export type BulkAction =
  | { type: 'delete' }
  | { type: 'move'; collectionId: string | null }
  | { type: 'addTag'; tag: string };
export interface BulkResult {
  affected: number;
  deleted: Bookmark[];
}
export interface ClearResult {
  deleted: Bookmark[];
}

export type Request =
  | { type: 'bulk'; ids: string[]; action: BulkAction }
  | { type: 'restore'; bookmarks: Bookmark[] }
  | { type: 'clearBookmarks' }
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
