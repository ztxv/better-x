import type { FeatureRegistry } from '../features/registry';
import { resolveSliderValue } from '../features/registry';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  type AccentId,
  type Settings,
  type SettingsPatch,
  type Theme,
} from './settings';

/**
 * Better X customization backup: the switches, slider numbers and look (theme, accent) a person
 * has set, in a small JSON file they can carry to another browser. It is not the Library backup
 * (`format: "better-x"`: bookmarks, collections, download history) and shares nothing with it;
 * Saved and download preferences, the launch mode (popup or side panel), and anything private
 * are never written.
 *
 *     { "format": "better-x-settings", "version": 1, "exportedAt": "2026-10-08T12:00:00.000Z",
 *       "features": { "cleanup.hideAds": true },
 *       "values": { "appearance.timelineWidth": 800 },
 *       "appearance": { "theme": "dark", "accent": "pink" } }
 *
 * New optional sections may be added without a version change; a change that older readers
 * would misread bumps `version`, and readers refuse versions newer than they know.
 */
export const SETTINGS_BACKUP_FORMAT = 'better-x-settings';
export const SETTINGS_BACKUP_VERSION = 1;
/** Larger than any real file (a few KB); a bigger one is not ours and is not read. */
export const MAX_BACKUP_BYTES = 256 * 1024;
const MAX_ENTRIES = 1024;
const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme: Theme; accent: AccentId };
}

/** What a file may set, after validation: only known features, in range, of the right type. */
export interface ValidatedBackup {
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme?: Theme; accent?: AccentId };
}

export interface ImportPreview {
  /** Settings the file names (switches, numbers and appearance fields). */
  found: number;
  /** Of those, the ones this version of Better X knows and can apply. */
  recognized: number;
  /** Names this version does not have (a newer build's features, or a typo). Ignored. */
  unsupported: number;
  /** Known names with a value that is not allowed (wrong type, outside a slider's range). Ignored. */
  invalid: number;
  /** How many settings would differ from now if the file were merged in. */
  mergeChanges: number;
  /** How many would differ if the file replaced the customization settings. */
  replaceChanges: number;
}

export type ImportMode = 'merge' | 'replace';

export type ParsedBackup =
  { ok: true; backup: ValidatedBackup; preview: ImportPreview } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The file for these settings: what the user set, for features this build knows. */
export function createSettingsBackup(
  settings: Pick<Settings, 'features' | 'values' | 'theme' | 'accent'>,
  registry: FeatureRegistry,
  now: Date = new Date(),
): SettingsBackup {
  const features: Record<string, boolean> = {};
  const values: Record<string, number> = {};
  for (const def of registry.list()) {
    const on = settings.features[def.id];
    if (typeof on === 'boolean') features[def.id] = on;
    if (def.kind === 'slider' && settings.values[def.id] !== undefined)
      values[def.id] = registry.values(settings.values)[def.id]!;
  }
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    features,
    values,
    appearance: { theme: settings.theme, accent: settings.accent },
  };
}

export const settingsBackupFilename = (now: Date = new Date()) =>
  `better-x-settings-${now.toISOString().slice(0, 10)}.json`;

const fail = (error: string): ParsedBackup => ({ ok: false, error });

/**
 * Reads a backup file's text without trusting it. Refuses (and changes nothing) when it is not
 * JSON, not a Better X settings backup, from a newer version, or structurally wrong. Inside a
 * valid file each entry is judged on its own: unknown ids are `unsupported`, known ids with a bad
 * value are `invalid`, and neither stops the rest. A slider number must be a finite number inside
 * its range and on its step; one that is not is `invalid` and left alone rather than bent into
 * range, so an import never sets something the slider could not.
 */
export function parseSettingsBackup(
  text: string,
  registry: FeatureRegistry,
  current: Pick<Settings, 'features' | 'values' | 'theme' | 'accent'>,
): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES)
    return fail('That file is too large to be a settings backup.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('That file is not valid JSON.');
  }
  if (!isRecord(data)) return fail('That file is not a Better X settings backup.');
  if (data.format === 'better-x' || data.format === 'saved-for-x')
    return fail('That is a Library backup. Use Import Library for it.');
  if (data.format !== SETTINGS_BACKUP_FORMAT)
    return fail('That file is not a Better X settings backup.');
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1)
    return fail('That settings backup has no valid version.');
  if (data.version > SETTINGS_BACKUP_VERSION)
    return fail(
      `That backup is from a newer Better X (settings backup version ${data.version}). Update Better X to read it.`,
    );
  for (const section of ['features', 'values', 'appearance'] as const)
    if (data[section] !== undefined && !isRecord(data[section]))
      return fail(`That settings backup is damaged: “${section}” is not what it should be.`);
  const features = (data.features ?? {}) as Record<string, unknown>;
  const values = (data.values ?? {}) as Record<string, unknown>;
  const appearance = (data.appearance ?? {}) as Record<string, unknown>;
  if (Object.keys(features).length + Object.keys(values).length > MAX_ENTRIES)
    return fail('That settings backup has too many entries.');

  const backup: ValidatedBackup = { features: {}, values: {}, appearance: {} };
  let found = 0;
  let unsupported = 0;
  let invalid = 0;
  for (const [id, value] of Object.entries(features)) {
    found++;
    if (!registry.get(id)) unsupported++;
    else if (typeof value !== 'boolean') invalid++;
    else backup.features[id] = value;
  }
  for (const [id, value] of Object.entries(values)) {
    found++;
    const def = registry.get(id);
    if (!def) unsupported++;
    else if (def.kind !== 'slider') invalid++;
    else if (typeof value !== 'number' || !Number.isFinite(value)) invalid++;
    else if (resolveSliderValue(def, value) !== value) invalid++;
    else backup.values[id] = value;
  }
  if (appearance.theme !== undefined) {
    found++;
    if (THEMES.includes(appearance.theme as Theme))
      backup.appearance.theme = appearance.theme as Theme;
    else invalid++;
  }
  if (appearance.accent !== undefined) {
    found++;
    if (typeof appearance.accent === 'string' && Object.hasOwn(ACCENTS, appearance.accent))
      backup.appearance.accent = appearance.accent as AccentId;
    else invalid++;
  }
  const recognized = found - unsupported - invalid;
  return {
    ok: true,
    backup,
    preview: {
      found,
      recognized,
      unsupported,
      invalid,
      mergeChanges: countChanges(current, importPatch(backup, 'merge', registry), registry),
      replaceChanges: countChanges(current, importPatch(backup, 'replace', registry), registry),
    },
  };
}

/**
 * The settings change that applies a validated file. Merge sets what the file names and leaves
 * everything else as it is. Replace makes the file the whole customization: every switch and
 * slider it does not name goes back to its default (`null`), and so do theme and accent. Saved,
 * download and launch preferences are in neither.
 */
export function importPatch(
  backup: ValidatedBackup,
  mode: ImportMode,
  registry: FeatureRegistry,
): SettingsPatch {
  const features: Record<string, boolean | null> = {};
  const values: Record<string, number | null> = {};
  if (mode === 'replace')
    for (const def of registry.list()) {
      features[def.id] = null;
      if (def.kind === 'slider') values[def.id] = null;
    }
  Object.assign(features, backup.features);
  Object.assign(values, backup.values);
  const patch: SettingsPatch = { features, values };
  const theme =
    backup.appearance.theme ?? (mode === 'replace' ? DEFAULT_SETTINGS.theme : undefined);
  const accent =
    backup.appearance.accent ?? (mode === 'replace' ? DEFAULT_SETTINGS.accent : undefined);
  if (theme) patch.theme = theme;
  if (accent) patch.accent = accent;
  return patch;
}

/** How many settings a patch would change, comparing what each would be after it (defaults filled in). */
function countChanges(
  current: Pick<Settings, 'features' | 'values' | 'theme' | 'accent'>,
  patch: SettingsPatch,
  registry: FeatureRegistry,
): number {
  const nextFeatures = { ...current.features, ...patch.features };
  const nextValues = { ...current.values, ...patch.values };
  const was = registry.enabled(current.features);
  const will = registry.enabled(nextFeatures as Record<string, boolean>);
  const wasValues = registry.values(current.values);
  const willValues = registry.values(nextValues as Record<string, number>);
  let changes = 0;
  for (const def of registry.list()) {
    if (was[def.id] !== will[def.id]) changes++;
    if (def.kind === 'slider' && wasValues[def.id] !== willValues[def.id]) changes++;
  }
  if (patch.theme !== undefined && patch.theme !== current.theme) changes++;
  if (patch.accent !== undefined && patch.accent !== current.accent) changes++;
  return changes;
}
