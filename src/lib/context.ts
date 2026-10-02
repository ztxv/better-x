import type {
  Bookmark,
  LinkCard,
  MediaKind,
  PostContext,
  PostMedia,
  QuotedPost,
  ReplyContext,
} from '../types/model';
import { parsePostUrl } from '../x/url';

/**
 * Lenient sanitizers for post context. Context is optional enrichment: a malformed or
 * unsafe field is dropped (null/empty) instead of rejecting the bookmark that holds it.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

/** Images are only loaded from X's own CDN, so a saved post cannot embed arbitrary trackers. */
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)twimg\.com$/i.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const cleanHandle = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(value) ? value : null;
const cleanDate = (value: unknown): string | null =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
    ? value
    : null;
const MEDIA_KINDS = new Set<MediaKind>(['image', 'video', 'gif']);

export function cleanMedia(value: unknown): PostMedia[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((item) => MEDIA_KINDS.has(item.kind as MediaKind))
    .slice(0, 4)
    .map((item) => ({
      kind: item.kind as MediaKind,
      thumbnailUrl: safeImageUrl(item.thumbnailUrl),
      alt: cleanText(item.alt, 1000),
    }));
}

/** Returns a canonical post URL and ID, or nulls when the pair is missing or inconsistent. */
function cleanPostRef(tweetId: unknown, url: unknown) {
  const identity = typeof url === 'string' ? parsePostUrl(url) : null;
  if (identity && (tweetId == null || tweetId === identity.tweetId))
    return { tweetId: identity.tweetId, url: identity.url, handle: identity.handle };
  const id = typeof tweetId === 'string' && /^\d{1,32}$/.test(tweetId) ? tweetId : null;
  return { tweetId: id, url: null, handle: null };
}

export function cleanQuote(value: unknown): QuotedPost | null {
  if (!isRecord(value)) return null;
  const ref = cleanPostRef(value.tweetId, value.url);
  const quote: QuotedPost = {
    tweetId: ref.tweetId,
    url: ref.url,
    authorHandle: cleanHandle(value.authorHandle) ?? ref.handle,
    authorDisplayName: cleanText(value.authorDisplayName, 160),
    authorAvatarUrl: safeImageUrl(value.authorAvatarUrl),
    text: cleanText(value.text, 20000),
    createdAt: cleanDate(value.createdAt),
    media: cleanMedia(value.media),
  };
  return quote.authorHandle || quote.text || quote.media.length || quote.url ? quote : null;
}

export function cleanReply(value: unknown): ReplyContext | null {
  if (!isRecord(value)) return null;
  const ref = cleanPostRef(value.tweetId, value.url);
  const reply: ReplyContext = {
    tweetId: ref.tweetId,
    url: ref.url,
    authorHandle: cleanHandle(value.authorHandle) ?? ref.handle,
    authorDisplayName: cleanText(value.authorDisplayName, 160),
    text: cleanText(value.text, 1000),
  };
  return reply.authorHandle || reply.url ? reply : null;
}

export function cleanCard(value: unknown): LinkCard | null {
  if (!isRecord(value)) return null;
  const url = safeWebUrl(value.url);
  if (!url) return null;
  return {
    kind: value.kind === 'article' ? 'article' : 'link',
    url,
    domain: cleanText(value.domain, 253),
    title: cleanText(value.title, 300),
    description: cleanText(value.description, 500),
    imageUrl: safeImageUrl(value.imageUrl),
  };
}

export function cleanContext(value: Record<string, unknown>): PostContext {
  return {
    media: cleanMedia(value.media),
    quote: cleanQuote(value.quote),
    replyTo: cleanReply(value.replyTo),
    card: cleanCard(value.card),
  };
}

/** Gives rows saved before schema 2 (no context fields) safe defaults on read. */
export function withContext(bookmark: Bookmark): Bookmark {
  if (bookmark.schemaVersion >= 2 && Array.isArray(bookmark.media)) return bookmark;
  return { ...bookmark, ...cleanContext(bookmark as unknown as Record<string, unknown>) };
}
