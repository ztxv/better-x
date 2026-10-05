import type { MediaKind } from '../types/model';

/** The folder, inside the browser's download directory, that every file is saved under. */
export const DOWNLOAD_FOLDER = 'Better-X';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
};

/** The file extension for a served content type, or the URL's own format when the type is unknown. */
export function extensionFor(kind: MediaKind, contentType: string | null, url: string): string {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (EXTENSIONS[type]) return EXTENSIONS[type];
  if (kind !== 'image') return 'mp4';
  try {
    const format = new URL(url).searchParams.get('format')?.toLowerCase();
    if (format === 'jpeg') return 'jpg';
    if (format && Object.values(EXTENSIONS).includes(format)) return format;
  } catch {
    /* Fall through to the photo default. */
  }
  return 'jpg';
}

const component = (value: string | null, fallback: string) =>
  (value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || fallback;

/**
 * `Better-X/{handle}_{postId}_{n}.{ext}`. Every part is reduced to a safe character set,
 * so the result can never be absolute, contain `..`, or leave the download folder.
 */
export function downloadPath(
  handle: string | null,
  postId: string,
  index: number,
  extension: string,
): string {
  const name = `${component(handle, 'post')}_${component(postId, 'post')}_${index + 1}`;
  return `${DOWNLOAD_FOLDER}/${name}.${component(extension, 'bin').toLowerCase()}`;
}

/** The last path component of a file Chrome reported, for display only. */
export function displayName(path: string): string {
  return (path.split(/[\\/]/).pop() ?? '').slice(0, 200);
}
