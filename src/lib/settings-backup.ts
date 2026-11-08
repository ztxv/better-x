import type { FeatureRegistry } from '../features/registry';
import { resolveValue } from '../features/registry';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  MAX_ALWAYS_SHOW,
  MAX_COUNTRIES,
  normalizeAlwaysShow,
  normalizeHandle,
  normalizeCountries,
  type AccentId,
  type AlwaysShowEntry,
  type FilterMode,
  type FilterSettings,
  type LookupMode,
  type Settings,
  type SettingsPatch,
  type Theme,
} from './settings';
import { resolveSelectable } from '../insights/places';

/**
 * Better X customization backup: the switches, slider numbers, look (theme, accent), account
 * insights lookup mode and country-filter setup a person has chosen, in a small JSON file they
 * can carry to another browser. It is not the Library backup (`format: "better-x"`: bookmarks,
 * collections, download history) and shares nothing with it. Saved and download preferences, the
 * launch mode (popup or side panel), the cached public account data, and anything private (no
 * session, token, header or request is ever stored) are never written.
 *
 *     { "format": "better-x-settings", "version": 2, "exportedAt": "2026-10-09T12:00:00.000Z",
 *       "features": { "cleanup.hideAds": true, "filtering.country": true },
 *       "values": { "appearance.timelineWidth": 800 },
 *       "appearance": { "theme": "dark", "accent": "pink" },
 *       "insights": { "lookup": "hover" },
 *       "filter": { "countries": ["Germany"], "mode": "collapse", "posts": true,
 *                   "quotes": true, "alwaysShow": [{ "handle": "someone", "id": "123" }] } }
 *
 * Version 1 files (no `insights` or `filter`) still import. New optional sections may be added
 * without a version change; a change that older readers would misread bumps `version`, and
 * readers refuse versions newer than they know.
 */
export const SETTINGS_BACKUP_FORMAT = 'better-x-settings';
export const SETTINGS_BACKUP_VERSION = 2;
/** Larger than any real file (a few KB); a bigger one is not ours and is not read. */
export const MAX_BACKUP_BYTES = 256 * 1024;
const MAX_ENTRIES = 1024;
const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
const LOOKUPS: readonly LookupMode[] = ['manual', 'hover', 'visible'];
const MODES: readonly FilterMode[] = ['collapse', 'hide', 'highlight'];

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme: Theme; accent: AccentId };
  insights: { lookup: LookupMode };
  filter: FilterSettings;
}

/** What a file may set, after validation: only known features, in range, of the right type. */
export interface ValidatedBackup {
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme?: Theme; accent?: AccentId };
  /**
   * True when the file's version knows about account insights and the country filter, so
   * Replace may reset them. A version 1 file cannot name them and leaves them alone.
   */
  smart: boolean;
  insights: { lookup?: LookupMode };
  filter: {
    countries?: string[];
    mode?: FilterMode;
    posts?: boolean;
    quotes?: boolean;
    alwaysShow?: AlwaysShowEntry[];
  };
}

export interface ImportPreview {
  /** Settings the file names (switches, numbers, appearance fields, list entries). */
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

/** The settings an import compares against. The smart fields default when a caller has none. */
export type BackupSource = Pick<Settings, 'features' | 'values' | 'theme' | 'accent'> &
  Partial<Pick<Settings, 'insights' | 'filter'>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The file for these settings: what the user set, for features this build knows. */
export function createSettingsBackup(
  settings: BackupSource,
  registry: FeatureRegistry,
  now: Date = new Date(),
): SettingsBackup {
  const features: Record<string, boolean> = {};
  const values: Record<string, number> = {};
  for (const def of registry.list()) {
    const on = settings.features[def.id];
    if (typeof on === 'boolean') features[def.id] = on;
    if (def.kind !== 'toggle' && settings.values[def.id] !== undefined)
      values[def.id] = registry.values(settings.values)[def.id]!;
  }
  const filter = settings.filter ?? DEFAULT_SETTINGS.filter;
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    features,
    values,
    appearance: { theme: settings.theme, accent: settings.accent },
    insights: { lookup: (settings.insights ?? DEFAULT_SETTINGS.insights).lookup },
    filter: {
      countries: [...filter.countries],
      mode: filter.mode,
      posts: filter.posts,
      quotes: filter.quotes,
      alwaysShow: filter.alwaysShow.map((entry) => ({ ...entry })),
    },
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
 * range, so an import never sets something the slider could not. A country that is not a real
 * country or a region label Better X offers, and an Always Show entry that is not an X username
 * (with, if given, a numeric id), are `invalid` too.
 */
export function parseSettingsBackup(
  text: string,
  registry: FeatureRegistry,
  current: BackupSource,
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
  for (const section of ['features', 'values', 'appearance', 'insights', 'filter'] as const)
    if (data[section] !== undefined && !isRecord(data[section]))
      return fail(`That settings backup is damaged: “${section}” is not what it should be.`);
  const features = (data.features ?? {}) as Record<string, unknown>;
  const values = (data.values ?? {}) as Record<string, unknown>;
  const appearance = (data.appearance ?? {}) as Record<string, unknown>;
  const insights = (data.insights ?? {}) as Record<string, unknown>;
  const filter = (data.filter ?? {}) as Record<string, unknown>;
  if (Object.keys(features).length + Object.keys(values).length > MAX_ENTRIES)
    return fail('That settings backup has too many entries.');

  const smart = data.version >= 2;
  const backup: ValidatedBackup = {
    features: {},
    values: {},
    appearance: {},
    smart,
    insights: {},
    filter: {},
  };
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
    else if (def.kind === 'toggle') invalid++;
    else if (typeof value !== 'number' || !Number.isFinite(value)) invalid++;
    else if (resolveValue(def, value) !== value) invalid++;
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

  if (insights.lookup !== undefined) {
    found++;
    if (LOOKUPS.includes(insights.lookup as LookupMode))
      backup.insights.lookup = insights.lookup as LookupMode;
    else invalid++;
  }
  if (filter.mode !== undefined) {
    found++;
    if (MODES.includes(filter.mode as FilterMode)) backup.filter.mode = filter.mode as FilterMode;
    else invalid++;
  }
  for (const key of ['posts', 'quotes'] as const) {
    if (filter[key] === undefined) continue;
    found++;
    if (typeof filter[key] === 'boolean') backup.filter[key] = filter[key] as boolean;
    else invalid++;
  }
  if (filter.countries !== undefined) {
    if (!Array.isArray(filter.countries)) {
      found++;
      invalid++;
    } else {
      const names: string[] = [];
      for (const item of filter.countries.slice(0, MAX_COUNTRIES * 2)) {
        found++;
        if (resolveSelectable(item)) names.push(item as string);
        else invalid++;
      }
      backup.filter.countries = normalizeCountries(names);
    }
  }
  if (filter.alwaysShow !== undefined) {
    if (!Array.isArray(filter.alwaysShow)) {
      found++;
      invalid++;
    } else {
      const good: unknown[] = [];
      for (const item of filter.alwaysShow.slice(0, MAX_ALWAYS_SHOW * 2)) {
        found++;
        const entry: Record<string, unknown> = isRecord(item) ? item : { handle: item };
        const idOk =
          entry.id === undefined || (typeof entry.id === 'string' && /^\d{1,25}$/.test(entry.id));
        if (normalizeHandle(entry.handle) && idOk) good.push(entry);
        else invalid++;
      }
      backup.filter.alwaysShow = normalizeAlwaysShow(good);
    }
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
      mergeChanges: countChanges(
        current,
        importPatch(backup, 'merge', registry, current),
        registry,
      ),
      replaceChanges: countChanges(
        current,
        importPatch(backup, 'replace', registry, current),
        registry,
      ),
    },
  };
}

/**
 * The settings change that applies a validated file. Merge sets what the file names and leaves
 * everything else as it is; the file's countries and Always Show accounts are added to the lists
 * already there. Replace makes the file the whole customization: every switch and slider it does
 * not name goes back to its default (`null`), and so do theme, accent, the lookup mode and the
 * country filter (the last three only for a file new enough to name them). Saved, download and
 * launch preferences are in neither.
 */
export function importPatch(
  backup: ValidatedBackup,
  mode: ImportMode,
  registry: FeatureRegistry,
  current: Partial<Pick<Settings, 'insights' | 'filter'>> = {},
): SettingsPatch {
  const features: Record<string, boolean | null> = {};
  const values: Record<string, number | null> = {};
  if (mode === 'replace')
    for (const def of registry.list()) {
      features[def.id] = null;
      if (def.kind !== 'toggle') values[def.id] = null;
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

  const resets = mode === 'replace' && backup.smart;
  const lookup = backup.insights.lookup ?? (resets ? DEFAULT_SETTINGS.insights.lookup : undefined);
  if (lookup) patch.insights = { lookup };

  const base = current.filter ?? DEFAULT_SETTINGS.filter;
  const merging = mode === 'merge';
  const next: Partial<FilterSettings> = {};
  const defaults = DEFAULT_SETTINGS.filter;
  const mode_ = backup.filter.mode ?? (resets ? defaults.mode : undefined);
  if (mode_) next.mode = mode_;
  const posts = backup.filter.posts ?? (resets ? defaults.posts : undefined);
  if (posts !== undefined) next.posts = posts;
  const quotes = backup.filter.quotes ?? (resets ? defaults.quotes : undefined);
  if (quotes !== undefined) next.quotes = quotes;
  if (backup.filter.countries !== undefined)
    next.countries = merging
      ? normalizeCountries([...base.countries, ...backup.filter.countries])
      : backup.filter.countries;
  else if (resets) next.countries = [];
  if (backup.filter.alwaysShow !== undefined)
    next.alwaysShow = merging
      ? normalizeAlwaysShow([...base.alwaysShow, ...backup.filter.alwaysShow])
      : backup.filter.alwaysShow;
  else if (resets) next.alwaysShow = [];
  if (Object.keys(next).length) patch.filter = next;
  return patch;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/** How many settings a patch would change, comparing what each would be after it (defaults filled in). */
function countChanges(
  current: BackupSource,
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
    if (def.kind !== 'toggle' && wasValues[def.id] !== willValues[def.id]) changes++;
  }
  if (patch.theme !== undefined && patch.theme !== current.theme) changes++;
  if (patch.accent !== undefined && patch.accent !== current.accent) changes++;

  const insights = current.insights ?? DEFAULT_SETTINGS.insights;
  if (patch.insights?.lookup !== undefined && patch.insights.lookup !== insights.lookup) changes++;
  const filter = current.filter ?? DEFAULT_SETTINGS.filter;
  const next = patch.filter;
  if (next) {
    if (next.mode !== undefined && next.mode !== filter.mode) changes++;
    if (next.posts !== undefined && next.posts !== filter.posts) changes++;
    if (next.quotes !== undefined && next.quotes !== filter.quotes) changes++;
    if (next.countries && !sameList(next.countries, filter.countries)) {
      // One change per country added or removed.
      const before = new Set(filter.countries);
      const after = new Set(next.countries);
      changes += [...after].filter((c) => !before.has(c)).length;
      changes += [...before].filter((c) => !after.has(c)).length;
    }
    if (next.alwaysShow) {
      const before = new Set(filter.alwaysShow.map((entry) => entry.handle));
      const after = new Set(next.alwaysShow.map((entry) => entry.handle));
      changes += [...after].filter((h) => !before.has(h)).length;
      changes += [...before].filter((h) => !after.has(h)).length;
    }
  }
  return changes;
}
