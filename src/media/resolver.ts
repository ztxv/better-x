import type { MediaKind, PostMedia } from '../types/model';
import { extensionFor } from '../downloads/filename';
import { fetchSyndication, type SyndicatedMedia } from './syndication';
import { gifVideoUrl, isDownloadableUrl, originalPhotoUrl, safeVideoUrl } from './urls';

/**
 * Turns a saved media item into a file the browser can download.
 *
 * - `available`: a verified file on X's CDN, with the extension of what X actually serves.
 * - `needsPost`: X's public metadata could not be read for this post (protected, deleted,
 *   age-restricted, or the endpoint changed). The post may still play on x.com.
 * - `unsupported`: the media exists but has no single downloadable file (for example a video
 *   offered only as an HLS stream). Never substitutes the poster image for the video.
 * - `unavailable`: X reports the media as removed or withheld, or the file is gone.
 * - `network`: the request itself failed (offline, rate limited); worth retrying later.
 */
export type Resolution =
  | { status: 'available'; url: string; extension: string }
  | { status: 'needsPost' | 'unsupported' | 'unavailable' | 'network' };

export interface ResolveInput {
  /** The post that owns the media (the quoted post for quoted media). */
  sourceTweetId: string;
  index: number;
  kind: MediaKind;
  key: string;
  item: PostMedia | null;
}

const COMPATIBLE: Record<MediaKind, MediaKind[]> = {
  image: ['image'],
  gif: ['gif', 'video'],
  video: ['video', 'gif'],
};

/** Finds the metadata entry for a saved item: by media ID first, then by position and kind. */
export function matchSyndicated(
  media: SyndicatedMedia[],
  input: Pick<ResolveInput, 'index' | 'kind' | 'key'>,
): SyndicatedMedia | null {
  if (!input.key.startsWith('n:')) {
    const byKey = media.find((item) => item.key === input.key);
    if (byKey) return byKey;
  }
  const byIndex = media[input.index];
  return byIndex && COMPATIBLE[input.kind].includes(byIndex.kind) ? byIndex : null;
}

/** A direct file URL known without any request, from what was saved with the bookmark. */
export function directUrl(kind: MediaKind, item: PostMedia | null): string | null {
  if (!item) return null;
  if (kind === 'image')
    return originalPhotoUrl(item.sourceUrl) ?? originalPhotoUrl(item.thumbnailUrl);
  if (kind === 'gif') return safeVideoUrl(item.sourceUrl) ?? gifVideoUrl(item.thumbnailUrl);
  return safeVideoUrl(item.sourceUrl);
}

/** Confirms the file exists and is the expected type, and reads its real extension. */
export async function probe(
  url: string,
  kind: MediaKind,
  fetcher: typeof fetch = fetch,
): Promise<Resolution> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'HEAD',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  } catch {
    return { status: 'network' };
  }
  if (response.status === 429 || response.status >= 500) return { status: 'network' };
  if (!response.ok) return { status: 'unavailable' };
  const type = response.headers.get('content-type');
  const expected = kind === 'image' ? /^image\//i : /^video\/mp4/i;
  if (type && !expected.test(type)) return { status: 'unsupported' };
  return { status: 'available', url, extension: extensionFor(kind, type, url) };
}

export async function resolveMedia(
  input: ResolveInput,
  fetcher: typeof fetch = fetch,
): Promise<Resolution> {
  // Videos are resolved fresh from post metadata; photos and GIFs have stable derived URLs.
  const direct = input.kind === 'video' ? null : directUrl(input.kind, input.item);
  if (direct) return probe(direct, input.kind, fetcher);

  const metadata = await fetchSyndication(input.sourceTweetId, fetcher);
  if (metadata.status === 'found') {
    const match = matchSyndicated(metadata.media, input);
    if (match && !match.available) return { status: 'unavailable' };
    const url = match?.photoUrl ?? match?.videoUrl ?? null;
    if (url && isDownloadableUrl(url)) return probe(url, input.kind, fetcher);
    if (match) return { status: 'unsupported' };
  }
  // A direct MP4 the page exposed when the post was saved is the last resort for videos.
  const saved = directUrl(input.kind, input.item);
  if (saved) return probe(saved, input.kind, fetcher);
  if (metadata.status === 'failed') return { status: 'network' };
  return { status: metadata.status === 'missing' ? 'needsPost' : 'unsupported' };
}
