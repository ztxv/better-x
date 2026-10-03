import type { MediaKind } from '../types/model';
import { mediaKey, originalPhotoUrl, safeVideoUrl } from './urls';

/**
 * Post media metadata from X's embed CDN, the endpoint X's own embedded-post widget
 * (platform.twitter.com) reads. It is the only source used for regular videos, because the
 * player on x.com plays a `blob:` stream and never exposes a file.
 *
 * Dependency notes (verified 2026-10-03, see DEVELOPMENT.md):
 * - Undocumented and unauthenticated. It can change or be withdrawn without notice; every
 *   field is validated and any surprise degrades to "open the post on X".
 * - Public posts only. Protected, deleted, age-restricted, or withheld posts return a 404 or a
 *   tombstone. It is called only from an explicit Download click, one request per post.
 * - The `token` query parameter must be non-empty. The value below is the one X's widget uses.
 */

export interface SyndicatedMedia {
  kind: MediaKind;
  key: string;
  /** Original photo URL (photos only). */
  photoUrl: string | null;
  /** Highest-bitrate progressive MP4 (videos and GIFs only). */
  videoUrl: string | null;
  available: boolean;
}

export type SyndicationResult =
  { status: 'found'; media: SyndicatedMedia[] } | { status: 'missing' } | { status: 'failed' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function syndicationUrl(tweetId: string): string {
  const token = ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '') || '1';
  return `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
}

const KINDS: Record<string, MediaKind> = {
  photo: 'image',
  video: 'video',
  animated_gif: 'gif',
};

/** Validates the endpoint's JSON for `tweetId`. Anything unexpected yields an empty result. */
export function parseSyndication(tweetId: string, body: unknown): SyndicationResult {
  if (!isRecord(body) || body.__typename !== 'Tweet' || body.id_str !== tweetId)
    return { status: 'missing' };
  const details = Array.isArray(body.mediaDetails) ? body.mediaDetails : [];
  const media = details.slice(0, 4).flatMap((detail, index): SyndicatedMedia[] => {
    if (!isRecord(detail)) return [];
    const kind = KINDS[detail.type as string];
    if (!kind) return [];
    const preview = typeof detail.media_url_https === 'string' ? detail.media_url_https : null;
    const info = isRecord(detail.video_info) ? detail.video_info : {};
    const variants = Array.isArray(info.variants) ? info.variants : [];
    const best = variants
      .filter(isRecord)
      .filter((variant) => variant.content_type === 'video/mp4')
      .map((variant) => ({
        url: safeVideoUrl(variant.url),
        bitrate: typeof variant.bitrate === 'number' ? variant.bitrate : 0,
      }))
      .filter((variant): variant is { url: string; bitrate: number } => !!variant.url)
      .sort((a, b) => b.bitrate - a.bitrate)[0];
    const availability = isRecord(detail.ext_media_availability)
      ? detail.ext_media_availability.status
      : undefined;
    return [
      {
        kind,
        key: mediaKey({ thumbnailUrl: preview, sourceUrl: best?.url ?? null }, index),
        photoUrl: kind === 'image' ? originalPhotoUrl(preview) : null,
        videoUrl: kind === 'image' ? null : (best?.url ?? null),
        available: availability === undefined || availability === 'Available',
      },
    ];
  });
  return { status: 'found', media };
}

export async function fetchSyndication(
  tweetId: string,
  fetcher: typeof fetch = fetch,
): Promise<SyndicationResult> {
  if (!/^\d{1,25}$/.test(tweetId)) return { status: 'missing' };
  let response: Response;
  try {
    response = await fetcher(syndicationUrl(tweetId), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  } catch {
    return { status: 'failed' };
  }
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) return { status: 'failed' };
  try {
    return parseSyndication(tweetId, await response.json());
  } catch {
    return { status: 'missing' };
  }
}
