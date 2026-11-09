import type { FeatureRegistry } from '../features/registry';
import { resolveValue } from '../features/registry';
import {
  DEFAULT_SETTINGS,
  MAX_ALWAYS_SHOW,
  MAX_COUNTRIES,
  normalizeAlwaysShow,
  normalizeHandle,
  normalizeCountries,
  parseAccent,
  parseThemeId,
  type Accent,
  type AfterSave,
  type AlwaysShowEntry,
  type Density,
  type FilterMode,
  type FilterSettings,
  type LookupMode,
  type OpenAs,
  type PanelMode,
  type PopupHeight,
  type Settings,
  type SettingsPatch,
  type Theme,
  type XThemeSettings,
} from './settings';
import { resolveSelectable } from '../insights/places';
import { isHex } from './color';
import type { ThemeSeed } from '../themes/types';

/**
 * Better X customization backup: every setting a person chooses, in a small JSON file they can
 * carry to another browser: the switches, slider numbers, look (theme, accent, density), Saved and
 * download preferences, how Better X opens (toolbar mode, popup height, panel mode, edge tab),
 * account insights lookup mode, country-filter setup and X theme. It is not the Library backup
 * (`format: "better-x"`: bookmarks, collections, download history) and shares nothing with it.
 * Never written: caches and window state (the account cache, X's last mode, open Customize
 * groups, the floating window's bounds, the overlay's open state and width), and anything private
 * (no session, token, header or request is ever stored).
 *
 *     { "format": "better-x-settings", "version": 2, "exportedAt": "2026-10-09T12:00:00.000Z",
 *       "features": { "cleanup.hideAds": true, "filtering.country": true },
 *       "values": { "appearance.timelineWidth": 800 },
 *       "appearance": { "theme": "dark", "accent": "pink" },
 *       "preferences": { "density": "compact", "downloadsEnabled": true,
 *                        "afterSave": "downloadOffer", "saveAs": false,
 *                        "menuActions": { "download": true, "openLibrary": true } },
 *       "launch": { "openAs": "sidepanel", "popupHeight": "standard",
 *                   "panelMode": "overlay", "panelHandle": false },
 *       "insights": { "lookup": "hover" },
 *       "filter": { "countries": ["Germany"], "mode": "collapse", "posts": true,
 *                   "quotes": true, "alwaysShow": [{ "handle": "someone", "id": "123" }] },
 *       "xTheme": { "active": "nord", "chat": false,
 *                   "custom": { "bg": "#000000", "text": "#e7e9ea", "accent": "#1d9bf0", ... } } }
 *
 * Version 1 files (no `insights` or `filter`) and version 2 files (no `xTheme`) still import.
 * `preferences` and `launch` (1.1.5) are optional sections added without a version change: a file
 * without one leaves those settings alone even on Replace, and an older Better X ignores them. New optional sections may be added
 * without a version change; a change that older readers would misread bumps `version`, and
 * readers refuse versions newer than they know.
 */
export const SETTINGS_BACKUP_FORMAT = 'better-x-settings';
export const SETTINGS_BACKUP_VERSION = 3;
/** Larger than any real file (a few KB); a bigger one is not ours and is not read. */
export const MAX_BACKUP_BYTES = 256 * 1024;
const MAX_ENTRIES = 1024;
const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
const LOOKUPS: readonly LookupMode[] = ['manual', 'hover', 'visible'];
const MODES: readonly FilterMode[] = ['collapse', 'hide', 'highlight'];
const SEED_KEYS = ['bg', 'text', 'accent', 'raised', 'hover', 'border', 'muted'] as const;
const DENSITIES: readonly Density[] = ['comfortable', 'compact', 'dense'];
const AFTER_SAVES: readonly AfterSave[] = ['downloadOffer', 'confirmationOnly', 'quiet'];

/** Saved, download and library-layout preferences: what the Settings dialog sets, per person. */
export type BackupPreferences = Pick<
  Settings,
  'density' | 'downloadsEnabled' | 'afterSave' | 'saveAs' | 'menuActions'
>;
const PREFERENCE_FLAGS = ['downloadsEnabled', 'saveAs'] as const;

/** How the toolbar icon opens Better X, so a second browser opens it the same way. */
export type BackupLaunch = Pick<Settings, 'openAs' | 'popupHeight' | 'panelMode' | 'panelHandle'>;
const OPEN_AS: readonly OpenAs[] = ['sidepanel', 'popup', 'window'];
const POPUP_HEIGHTS: readonly PopupHeight[] = ['compact', 'standard', 'tall'];
const PANEL_MODES: readonly PanelMode[] = ['native', 'overlay'];
/** The launch fields that are one of a fixed set of words, with the words each allows. */
const LAUNCH_CHOICES = [
  ['openAs', OPEN_AS],
  ['popupHeight', POPUP_HEIGHTS],
  ['panelMode', PANEL_MODES],
] as const;
const MENU_ACTIONS = ['download', 'openLibrary'] as const;

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme: Theme; accent: Accent };
  preferences: BackupPreferences;
  launch: BackupLaunch;
  insights: { lookup: LookupMode };
  filter: FilterSettings;
  /** `custom` holds only the colors that differ from Lights Out (where Custom starts). */
  xTheme: Pick<XThemeSettings, 'active' | 'chat'> & { custom?: Partial<ThemeSeed> };
}

/** What a file may set, after validation: only known features, in range, of the right type. */
export interface ValidatedBackup {
  features: Record<string, boolean>;
  values: Record<string, number>;
  appearance: { theme?: Theme; accent?: Accent };
  /** True when the file has a `preferences` section, so Replace may reset what it leaves out. */
  prefs: boolean;
  preferences: Partial<Omit<BackupPreferences, 'menuActions'>> & {
    menuActions?: Partial<BackupPreferences['menuActions']>;
  };
  /** True when the file has a `launch` section, so Replace may reset what it leaves out. */
  hasLaunch: boolean;
  launch: Partial<BackupLaunch>;
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
  /** True when the file's version (3+) knows about X themes, so Replace may reset them. */
  themes: boolean;
  xTheme: { active?: string | null; chat?: boolean; custom?: Partial<ThemeSeed> };
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
  Partial<Pick<Settings, 'insights' | 'filter' | 'xTheme'>> &
  Partial<BackupPreferences> &
  Partial<BackupLaunch>;

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
    preferences: preferencesOf(settings),
    launch: launchOf(settings),
    insights: { lookup: (settings.insights ?? DEFAULT_SETTINGS.insights).lookup },
    filter: {
      countries: [...filter.countries],
      mode: filter.mode,
      posts: filter.posts,
      quotes: filter.quotes,
      alwaysShow: filter.alwaysShow.map((entry) => ({ ...entry })),
    },
    xTheme: themeForBackup(settings.xTheme ?? DEFAULT_SETTINGS.xTheme),
  };
}

/** The preferences a file carries, defaults filled in for a caller that has none. */
function preferencesOf(settings: BackupSource): BackupPreferences {
  const d = DEFAULT_SETTINGS;
  const menu = settings.menuActions ?? d.menuActions;
  return {
    density: settings.density ?? d.density,
    downloadsEnabled: settings.downloadsEnabled ?? d.downloadsEnabled,
    afterSave: settings.afterSave ?? d.afterSave,
    saveAs: settings.saveAs ?? d.saveAs,
    menuActions: { download: menu.download, openLibrary: menu.openLibrary },
  };
}

/** How Better X opens, defaults filled in for a caller that has none. */
function launchOf(settings: BackupSource): BackupLaunch {
  const d = DEFAULT_SETTINGS;
  return {
    openAs: settings.openAs ?? d.openAs,
    popupHeight: settings.popupHeight ?? d.popupHeight,
    panelMode: settings.panelMode ?? d.panelMode,
    panelHandle: settings.panelHandle ?? d.panelHandle,
  };
}

/** The theme as a file carries it: custom colors only where they differ from where Custom starts. */
function themeForBackup(theme: XThemeSettings): SettingsBackup['xTheme'] {
  const start = DEFAULT_SETTINGS.xTheme.custom;
  const custom: Partial<ThemeSeed> = {};
  for (const key of SEED_KEYS)
    if (theme.custom[key] !== start[key]) custom[key] = theme.custom[key];
  return {
    active: theme.active,
    chat: theme.chat,
    ...(Object.keys(custom).length ? { custom } : {}),
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
  for (const section of [
    'features',
    'values',
    'appearance',
    'preferences',
    'launch',
    'insights',
    'filter',
    'xTheme',
  ] as const)
    if (data[section] !== undefined && !isRecord(data[section]))
      return fail(`That settings backup is damaged: “${section}” is not what it should be.`);
  const features = (data.features ?? {}) as Record<string, unknown>;
  const values = (data.values ?? {}) as Record<string, unknown>;
  const appearance = (data.appearance ?? {}) as Record<string, unknown>;
  const preferences = (data.preferences ?? {}) as Record<string, unknown>;
  const launch = (data.launch ?? {}) as Record<string, unknown>;
  const insights = (data.insights ?? {}) as Record<string, unknown>;
  const filter = (data.filter ?? {}) as Record<string, unknown>;
  const xTheme = (data.xTheme ?? {}) as Record<string, unknown>;
  if (Object.keys(features).length + Object.keys(values).length > MAX_ENTRIES)
    return fail('That settings backup has too many entries.');

  const smart = data.version >= 2;
  const backup: ValidatedBackup = {
    features: {},
    values: {},
    appearance: {},
    prefs: data.preferences !== undefined,
    preferences: {},
    hasLaunch: data.launch !== undefined,
    launch: {},
    smart,
    insights: {},
    filter: {},
    themes: data.version >= 3,
    xTheme: {},
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
    const accent = parseAccent(appearance.accent);
    if (accent) backup.appearance.accent = accent;
    else invalid++;
  }

  if (preferences.density !== undefined) {
    found++;
    if (DENSITIES.includes(preferences.density as Density))
      backup.preferences.density = preferences.density as Density;
    else invalid++;
  }
  if (preferences.afterSave !== undefined) {
    found++;
    if (AFTER_SAVES.includes(preferences.afterSave as AfterSave))
      backup.preferences.afterSave = preferences.afterSave as AfterSave;
    else invalid++;
  }
  for (const key of PREFERENCE_FLAGS) {
    if (preferences[key] === undefined) continue;
    found++;
    if (typeof preferences[key] === 'boolean')
      backup.preferences[key] = preferences[key] as boolean;
    else invalid++;
  }
  if (preferences.menuActions !== undefined) {
    if (!isRecord(preferences.menuActions)) {
      found++;
      invalid++;
    } else {
      const menu = preferences.menuActions;
      for (const key of MENU_ACTIONS) {
        if (menu[key] === undefined) continue;
        found++;
        if (typeof menu[key] === 'boolean')
          (backup.preferences.menuActions ??= {})[key] = menu[key] as boolean;
        else invalid++;
      }
    }
  }

  for (const [key, allowed] of LAUNCH_CHOICES) {
    if (launch[key] === undefined) continue;
    found++;
    if ((allowed as readonly unknown[]).includes(launch[key]))
      (backup.launch as Record<string, unknown>)[key] = launch[key];
    else invalid++;
  }
  if (launch.panelHandle !== undefined) {
    found++;
    if (typeof launch.panelHandle === 'boolean') backup.launch.panelHandle = launch.panelHandle;
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

  if (xTheme.active !== undefined) {
    found++;
    const id = xTheme.active === null ? null : parseThemeId(xTheme.active);
    if (xTheme.active === null || id) backup.xTheme.active = id;
    else unsupported++;
  }
  if (xTheme.chat !== undefined) {
    found++;
    if (typeof xTheme.chat === 'boolean') backup.xTheme.chat = xTheme.chat;
    else invalid++;
  }
  if (xTheme.custom !== undefined) {
    if (!isRecord(xTheme.custom)) {
      found++;
      invalid++;
    } else {
      const custom: Partial<ThemeSeed> = {};
      for (const key of SEED_KEYS) {
        const color = xTheme.custom[key];
        if (color === undefined) continue;
        found++;
        if (isHex(color)) custom[key] = color.toLowerCase();
        else invalid++;
      }
      if (Object.keys(custom).length) backup.xTheme.custom = custom;
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
 * country filter (the last three only for a file new enough to name them), and the Saved and
 * download preferences and how Better X opens (each only for a file that has them).
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

  const prefsReset = mode === 'replace' && backup.prefs;
  const dp = DEFAULT_SETTINGS;
  const prefs = backup.preferences;
  const density = prefs.density ?? (prefsReset ? dp.density : undefined);
  if (density) patch.density = density;
  const afterSave = prefs.afterSave ?? (prefsReset ? dp.afterSave : undefined);
  if (afterSave) patch.afterSave = afterSave;
  for (const key of PREFERENCE_FLAGS) {
    const value = prefs[key] ?? (prefsReset ? dp[key] : undefined);
    if (value !== undefined) patch[key] = value;
  }
  const menu = { ...(prefsReset ? dp.menuActions : {}), ...prefs.menuActions };
  if (Object.keys(menu).length) patch.menuActions = menu;

  const launchReset = mode === 'replace' && backup.hasLaunch;
  const launchDefaults = launchOf({} as BackupSource);
  for (const key of ['openAs', 'popupHeight', 'panelMode', 'panelHandle'] as const) {
    const value = backup.launch[key] ?? (launchReset ? launchDefaults[key] : undefined);
    if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
  }

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

  const themeResets = mode === 'replace' && backup.themes;
  const d = DEFAULT_SETTINGS.xTheme;
  const xTheme: NonNullable<SettingsPatch['xTheme']> = {};
  if (backup.xTheme.active !== undefined) xTheme.active = backup.xTheme.active;
  else if (themeResets) xTheme.active = d.active;
  if (backup.xTheme.chat !== undefined) xTheme.chat = backup.xTheme.chat;
  else if (themeResets) xTheme.chat = d.chat;
  if (backup.xTheme.custom || themeResets)
    xTheme.custom = { ...(themeResets ? d.custom : {}), ...backup.xTheme.custom };
  if (Object.keys(xTheme).length) patch.xTheme = xTheme;
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
  const prefs = preferencesOf(current);
  if (patch.density !== undefined && patch.density !== prefs.density) changes++;
  if (patch.afterSave !== undefined && patch.afterSave !== prefs.afterSave) changes++;
  for (const key of PREFERENCE_FLAGS)
    if (patch[key] !== undefined && patch[key] !== prefs[key]) changes++;
  for (const key of MENU_ACTIONS) {
    const value = patch.menuActions?.[key];
    if (value !== undefined && value !== prefs.menuActions[key]) changes++;
  }
  const launch = launchOf(current);
  for (const key of ['openAs', 'popupHeight', 'panelMode', 'panelHandle'] as const)
    if (patch[key] !== undefined && patch[key] !== launch[key]) changes++;

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
  const theme = current.xTheme ?? DEFAULT_SETTINGS.xTheme;
  const nextTheme = patch.xTheme;
  if (nextTheme) {
    if (nextTheme.active !== undefined && nextTheme.active !== theme.active) changes++;
    if (nextTheme.chat !== undefined && nextTheme.chat !== theme.chat) changes++;
    for (const key of SEED_KEYS) {
      const color = nextTheme.custom?.[key];
      if (color !== undefined && color !== theme.custom[key]) changes++;
    }
  }
  return changes;
}
