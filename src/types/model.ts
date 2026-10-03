export const SCHEMA_VERSION = 3;
export const EXPORT_VERSION = 3;

export type MediaKind = 'image' | 'video' | 'gif';

/**
 * One visible photo, video, or GIF. `thumbnailUrl` is a small preview and is null when X
 * showed none. `sourceUrl` is the original file when X exposed one: the full-size photo, or a
 * direct MP4 for a GIF or video (never a `blob:` player URL or a poster image).
 */
export interface PostMedia {
  kind: MediaKind;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
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
  /** Completed download history (metadata only, never files or local file paths). */
  downloads: ExportedDownload[];
}

/* ------------------------------------------------------------------------- downloads */

/** Which media list a download target comes from: the saved post itself, or its quoted post. */
export type MediaScope = 'post' | 'quote';

/** A media item identified by its saved post, never by an arbitrary URL. */
export interface MediaTarget {
  tweetId: string;
  scope: MediaScope;
  index: number;
  /** Stable media key (see `mediaKey`); used to find the item if the list order changed. */
  key: string | null;
}

/**
 * `historical` records come from an import: they were completed in another browser or
 * profile, so there is no local file binding.
 */
export type DownloadStatus =
  'resolving' | 'starting' | 'inProgress' | 'complete' | 'interrupted' | 'cancelled' | 'historical';

export type DownloadError =
  | 'unavailable'
  | 'unsupported'
  | 'needsPost'
  | 'network'
  | 'permission'
  | 'interrupted'
  | 'unknown';

export interface DownloadRecord {
  id: string;
  batchId: string;
  /** The saved post the download was started from. */
  tweetId: string;
  /** The post that owns the media: the saved post, or the quoted post for `scope: 'quote'`. */
  sourceTweetId: string;
  scope: MediaScope;
  mediaIndex: number;
  mediaKind: MediaKind;
  /** `${sourceTweetId}:${mediaKey}`, stable across preview and source quality changes. */
  mediaKey: string;
  previewUrl: string | null;
  /** Enough of the post to show it in Downloaded after the bookmark itself is removed. */
  snapshot: BookmarkDraft;
  /** Chrome's download ID, only while bound to a download in this browser profile. */
  chromeId: number | null;
  status: DownloadStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** File name only (no folders or absolute path). */
  filename: string;
  /** The resolved file URL, kept locally to reconcile after a restart. Never exported. */
  url: string | null;
  error: DownloadError | null;
}

export type ExportedDownload = Pick<
  DownloadRecord,
  | 'id'
  | 'batchId'
  | 'tweetId'
  | 'sourceTweetId'
  | 'scope'
  | 'mediaIndex'
  | 'mediaKind'
  | 'mediaKey'
  | 'previewUrl'
  | 'snapshot'
  | 'createdAt'
  | 'completedAt'
  | 'filename'
>;

/** The outcome of asking to download one target. */
export type StartOutcome =
  | { target: MediaTarget; status: 'started'; recordId: string }
  | { target: MediaTarget; status: 'pending'; recordId: string }
  | { target: MediaTarget; status: 'failed'; error: DownloadError; recordId: string | null };

export interface StartResult {
  batchId: string;
  outcomes: StartOutcome[];
}

export interface ClearDownloadsResult {
  deleted: DownloadRecord[];
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
  | { type: 'savedIds' }
  | { type: 'downloads' }
  | { type: 'downloadsFor'; tweetId: string }
  | { type: 'startDownload'; targets: MediaTarget[] }
  | { type: 'cancelDownload'; recordId: string }
  | { type: 'reconcileDownloads' }
  | { type: 'clearDownloads' }
  | { type: 'restoreDownloads'; records: DownloadRecord[] }
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
