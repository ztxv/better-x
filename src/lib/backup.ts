import { exportDownloads } from '../downloads/history';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  type DownloadRecord,
  type ExportData,
  type Library,
} from '../types/model';

/**
 * Backup formats Better X can import, and how each becomes the current Better X format.
 *
 * Better X's own format is `better-x` version 1. Saved for X backups (`saved-for-x` versions
 * 1-3) are legacy input from the extension Better X grew out of; Better X version 1 keeps the
 * Saved for X version 3 structure under the new format name, so upgrading only fills in what
 * older versions did not have:
 *
 * - `saved-for-x` 1: bookmarks and collections only. Post context and download history did
 *   not exist yet: bookmarks import with empty context and there is no history.
 * - `saved-for-x` 2: adds post context (media, quote, reply, card) to bookmarks. No history.
 * - `saved-for-x` 3: adds completed download history. Same structure as `better-x` 1.
 *
 * Context lives on each bookmark row and is read leniently whatever the file version, so only
 * the history list depends on the version. Everything here is format-level; record-level
 * validation stays in `validateExport`.
 */
export const IMPORTABLE_BACKUPS = {
  [EXPORT_FORMAT]: [EXPORT_VERSION],
  'saved-for-x': [1, 2, 3],
} as const satisfies Record<string, readonly number[]>;

export type BackupFormat = keyof typeof IMPORTABLE_BACKUPS;

const PRODUCT: Record<BackupFormat, string> = {
  [EXPORT_FORMAT]: 'Better X',
  'saved-for-x': 'Saved for X',
};

/** Whether a backup of this format and version can contain download history. */
const HAS_HISTORY: Record<BackupFormat, (version: number) => boolean> = {
  [EXPORT_FORMAT]: () => true,
  'saved-for-x': (version) => version >= 3,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads and checks a backup's format and version. Throws a message the user can act on. */
export function identifyBackup(input: unknown): { format: BackupFormat; version: number } {
  if (!isRecord(input) || typeof input.format !== 'string')
    throw new Error('This file is not a Better X or Saved for X backup.');
  const format = input.format;
  if (!Object.hasOwn(IMPORTABLE_BACKUPS, format))
    throw new Error('This file is not a Better X or Saved for X backup.');
  const known = format as BackupFormat;
  const versions: readonly number[] = IMPORTABLE_BACKUPS[known];
  if (typeof input.version !== 'number' || !versions.includes(input.version))
    throw new Error(
      `This ${PRODUCT[known]} backup is version ${String(input.version)}, which Better X cannot import.`,
    );
  return { format: known, version: input.version };
}

/**
 * The backup's lists in the shape of the current format, before record-level validation.
 * Download history from a format that never had it is dropped rather than trusted.
 */
export function upgradeBackup(input: Record<string, unknown>): {
  bookmarks: unknown;
  collections: unknown;
  downloads: unknown;
} {
  const { format, version } = identifyBackup(input);
  return {
    bookmarks: input.bookmarks,
    collections: input.collections,
    downloads: HAS_HISTORY[format](version) ? input.downloads : [],
  };
}

/** A Better X backup of the library and its completed download history. */
export function createBackup(
  library: Library,
  history: DownloadRecord[],
  now = new Date(),
): ExportData {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    bookmarks: library.bookmarks,
    collections: library.collections,
    downloads: exportDownloads(history),
  };
}
