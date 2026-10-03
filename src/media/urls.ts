import type { MediaKind } from '../types/model';

/**
 * Pure URL rules for X media. Nothing here fetches; every function returns null for anything
 * that is not a recognised file on X's own media CDNs, so callers never pass through an
 * arbitrary URL.
 *
 * Verified against live CDN responses (2026-10-03):
 * - Photos: `https://pbs.twimg.com/media/{id}?format={jpg|png|webp}&name=orig` is the original
 *   upload. The format must stay the one X served; asking for another returns 404.
 * - GIFs: X stores them as MP4. A `tweet_video_thumb/{id}` preview maps to
 *   `https://video.twimg.com/tweet_video/{id}.mp4`.
 * - Videos: progressive MP4 variants live at `video.twimg.com/{ext_tw_video|amplify_video}/
 *   {mediaId}/…/vid/…/*.mp4`. The page player itself uses `blob:` URLs (MSE/HLS), so a video's
 *   MP4 must come from post metadata, not from the player element.
 */

const PHOTO_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const VIDEO_PATH = /^\/(tweet_video|ext_tw_video|amplify_video)\/[A-Za-z0-9_/-]{1,200}\.mp4$/;

function parse(value: unknown, host: string): URL | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.username && !url.port
      ? url
      : null;
  } catch {
    return null;
  }
}

/** The original-resolution rendition of an X photo, keeping the format X served. */
export function originalPhotoUrl(value: unknown): string | null {
  const url = parse(value, 'pbs.twimg.com');
  const match = url?.pathname.match(/^\/media\/([A-Za-z0-9_-]{1,64})(?:\.([a-z]{3,4}))?$/);
  if (!url || !match) return null;
  const format = (url.searchParams.get('format') ?? match[2] ?? '').toLowerCase();
  if (!PHOTO_FORMATS.has(format)) return null;
  return `https://pbs.twimg.com/media/${match[1]}?format=${format}&name=orig`;
}

/** The MP4 behind a GIF preview (`tweet_video_thumb/{id}`). */
export function gifVideoUrl(value: unknown): string | null {
  const url = parse(value, 'pbs.twimg.com');
  const id = url?.pathname.match(
    /^\/tweet_video_thumb\/([A-Za-z0-9_-]{1,64})(?:\.[a-z]{3,4})?$/,
  )?.[1];
  return id ? `https://video.twimg.com/tweet_video/${id}.mp4` : null;
}

/** A direct, progressive MP4 on X's video CDN. HLS playlists (`.m3u8`) and `blob:` are rejected. */
export function safeVideoUrl(value: unknown): string | null {
  const url = parse(value, 'video.twimg.com');
  if (!url || !VIDEO_PATH.test(url.pathname) || url.pathname.includes('..')) return null;
  return url.href;
}

/** Sanitizes a stored original-file URL for a media item of `kind`. */
export function safeMediaSource(kind: MediaKind, value: unknown): string | null {
  return kind === 'image' ? originalPhotoUrl(value) : safeVideoUrl(value);
}

/** True when `url` is a file this extension may hand to the browser's downloader. */
export function isDownloadableUrl(url: string): boolean {
  return originalPhotoUrl(url) === url || safeVideoUrl(url) === url;
}

/**
 * A stable identity for a media item, derived from X's media ID in either the preview or the
 * source URL, so the same item matches across preview sizes, sources, and list order.
 * Falls back to the position when X exposed no media URL at all.
 */
export function mediaKey(
  item: { thumbnailUrl: string | null; sourceUrl?: string | null },
  index: number,
): string {
  for (const value of [item.sourceUrl, item.thumbnailUrl]) {
    if (!value) continue;
    let path: string;
    try {
      const url = new URL(value);
      if (!/(^|\.)twimg\.com$/.test(url.hostname)) continue;
      path = url.pathname;
    } catch {
      continue;
    }
    const photo = path.match(/^\/media\/([A-Za-z0-9_-]+)/)?.[1];
    if (photo) return `img:${photo}`;
    const gif = path.match(/^\/tweet_video(?:_thumb)?\/([A-Za-z0-9_-]+)/)?.[1];
    if (gif) return `gif:${gif}`;
    const video = path.match(/^\/(?:ext_tw_video|amplify_video)(?:_thumb)?\/(\d+)\//)?.[1];
    if (video) return `vid:${video}`;
  }
  return `n:${index}`;
}

export const isMediaKey = (value: unknown): value is string =>
  typeof value === 'string' && /^(img|gif|vid):[A-Za-z0-9_-]{1,64}$|^n:[0-3]$/.test(value);
