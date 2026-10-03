import type { DownloadError, DownloadRecord, MediaKind, PostMedia } from '../types/model';

/** Wording shared by the X page and the library, so a state always reads the same way. */

export const KIND_NAMES: Record<MediaKind, string> = { image: 'image', video: 'video', gif: 'GIF' };

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "Download image", "Download video", "Download GIF", or "Download media…" for several. */
export function downloadLabel(media: PostMedia[], quotedOnly = false): string {
  if (quotedOnly) return 'Download quoted media…';
  if (media.length === 1) return `Download ${KIND_NAMES[media[0]!.kind]}`;
  return 'Download media…';
}

/** "Image 2", "Video", "Quoted GIF". */
export function itemLabel(kind: MediaKind, index: number, count: number, quoted: boolean): string {
  const name = quoted ? `Quoted ${KIND_NAMES[kind]}` : capital(KIND_NAMES[kind]);
  return count > 1 ? `${name} ${index + 1}` : name;
}

/** Errors where retrying will not help; the post itself is the way forward. */
export const OPEN_POST_ERRORS: ReadonlySet<DownloadError> = new Set([
  'unavailable',
  'unsupported',
  'needsPost',
]);

export function errorMessage(error: DownloadError | null, kind: MediaKind): string {
  const name = capital(KIND_NAMES[kind]);
  switch (error) {
    case 'unavailable':
    case 'unsupported':
    case 'needsPost':
      return `${name} unavailable to download`;
    case 'network':
      return 'Could not reach X. Check your connection and try again.';
    case 'permission':
      return 'Downloads are not allowed for this extension. Check its permissions in Chrome.';
    default:
      return 'Download did not finish. Try again.';
  }
}

/** A short status for one record. */
export function statusText(record: Pick<DownloadRecord, 'status' | 'error' | 'mediaKind'>) {
  switch (record.status) {
    case 'resolving':
    case 'starting':
    case 'inProgress':
      return 'Downloading…';
    case 'complete':
      return 'Downloaded';
    case 'historical':
      return 'Downloaded previously';
    case 'cancelled':
      return 'Cancelled';
    default:
      return errorMessage(record.error, record.mediaKind);
  }
}
