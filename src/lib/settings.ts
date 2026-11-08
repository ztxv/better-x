/**
 * Customization shared by the side panel, the X content script, and the background worker.
 * Stored in `chrome.storage.local` under one key so every context reads the same values and
 * hears changes live. Invalid or missing fields fall back to defaults field by field.
 * Settings never hold library data, so resetting them never deletes anything.
 */

import { placeKey, resolveSelectable } from '../insights/places';
import { BLACK, WHITE, isHex, mix, readable, toHex, toRgb, type Rgb } from './color';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, isPresetId } from '../themes/presets';
import type { ThemeSeed } from '../themes/types';

export const SETTINGS_KEY = 'bx.settings';
/**
 * Version 2 added `features` (customization toggles); version 3 added `values` (the numbers of
 * slider features); version 4 added `openAs` (whether the toolbar icon opens the side panel or a
 * popup); version 5 added `insights` (how account lookups are triggered) and `filter` (the country
 * filter's list, mode and exceptions). A stored older object lacks them, so it loads with every
 * feature at its default and the side panel, and is rewritten at the current version on the next
 * save; no other field changes meaning, and nothing a user had set is lost. Version 6 added
 * `xTheme` (the palette that re-skins x.com itself, see `src/themes`), off by default.
 */
export const SETTINGS_VERSION = 6;

export type Theme = 'auto' | 'light' | 'dark';
export type AfterSave = 'downloadOffer' | 'confirmationOnly' | 'quiet';
export type AccentId = 'blue' | 'purple' | 'green' | 'orange' | 'pink';
/** A color of the person's own choosing, always written `#rrggbb` (lowercase). */
export type CustomAccent = `#${string}`;
export type Accent = AccentId | CustomAccent;
/** Where the toolbar icon opens Better X. */
export type OpenAs = 'sidepanel' | 'popup' | 'window';
/**
 * How tall the toolbar popup is. Chrome never draws an extension popup taller than 600 px (or
 * wider than 800), so `tall` is the most there is; the side panel is always the window's height.
 */
export type PopupHeight = 'compact' | 'standard' | 'tall';
export const POPUP_HEIGHT_PX: Record<PopupHeight, number> = {
  compact: 480,
  standard: 580,
  tall: 600,
};
/** How tightly library rows are packed. Compact and dense fit more posts on screen. */
export type Density = 'comfortable' | 'compact' | 'dense';

/**
 * When account lookups happen. `manual`: only when a person clicks a badge's lookup control.
 * `hover`: when the pointer rests on one (or it takes focus). `visible`: automatically for posts
 * on screen, at a bounded rate. The country filter needs an account's country to act, so while it
 * is on (with countries chosen) posts on screen are looked up whatever this says.
 */
export type LookupMode = 'manual' | 'hover' | 'visible';
/** What happens to a post (or quote) from a selected country. */
export type FilterMode = 'collapse' | 'hide' | 'highlight';

export interface InsightsSettings {
  lookup: LookupMode;
}

/** An account the country filter never acts on. `id` (X's numeric id) is kept once it is known. */
export interface AlwaysShowEntry {
  handle: string;
  id?: string;
}

export interface FilterSettings {
  /** Country names and region labels, canonical, no duplicates. */
  countries: string[];
  mode: FilterMode;
  /** Act on posts whose author is in a selected place. */
  posts: boolean;
  /** Act on quoted posts whose author is in a selected place (independently of the post). */
  quotes: boolean;
  alwaysShow: AlwaysShowEntry[];
}

/**
 * The theme that re-skins x.com. Not `theme`/`accent`, which are the side panel's own look.
 * `active` is a preset id, `custom`, or null (X's own look, the default). `custom` is always
 * stored, all seven colors `#rrggbb` lowercase, so switching a theme off and on keeps them.
 */
export interface XThemeSettings {
  active: string | null;
  custom: Required<ThemeSeed>;
  /** Experimental: also theme X's Chat, which lives in shadow DOM. */
  chat: boolean;
}

export const MAX_COUNTRIES = 250;
export const MAX_ALWAYS_SHOW = 200;

export interface Settings {
  version: typeof SETTINGS_VERSION;
  theme: Theme;
  accent: Accent;
  density: Density;
  /** Shows download offers and actions. Turning it off never removes download history. */
  downloadsEnabled: boolean;
  afterSave: AfterSave;
  /** Optional rows in the saved-post menu. Remove bookmark is always shown. */
  menuActions: { download: boolean; openLibrary: boolean };
  /** Ask where to save each file. Chrome's own "Ask where to save" setting can still prompt. */
  saveAs: boolean;
  /** What the toolbar icon opens. Applied by the background worker; see `src/lib/launch-mode.ts`. */
  openAs: OpenAs;
  /** The toolbar popup's height (only used in popup mode). */
  popupHeight: PopupHeight;
  /** How account lookups are triggered. The Account insights toggles live in `features`. */
  insights: InsightsSettings;
  /** The country filter's list and behavior. Whether it runs is the `filtering.country` toggle. */
  filter: FilterSettings;
  xTheme: XThemeSettings;
  /**
   * Customization toggles by feature id, only for those the user has set. A feature missing here
   * is at its default; ids the extension does not know are kept (a newer or older build may) but
   * ignored. The feature registry decides what each id means; see `src/features`.
   */
  features: Record<string, boolean>;
  /**
   * Slider numbers by feature id, only for those the user has moved. Like `features`, unknown ids
   * are kept; the registry validates each against its feature's range and step when it reads it.
   */
  values: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  theme: 'auto',
  accent: 'blue',
  density: 'comfortable',
  downloadsEnabled: true,
  afterSave: 'downloadOffer',
  menuActions: { download: true, openLibrary: true },
  saveAs: false,
  openAs: 'sidepanel',
  popupHeight: 'standard',
  insights: { lookup: 'hover' },
  filter: { countries: [], mode: 'collapse', posts: true, quotes: true, alwaysShow: [] },
  xTheme: { active: null, custom: { ...LIGHTS_OUT_SEED }, chat: false },
  features: {},
  values: {},
};

/**
 * Preset accents. `brand` marks the injected icon and fills; `text` is the darker shade used for
 * small text on light surfaces and `textDark` on dark ones (both at least 4.5:1); `soft*` are
 * tinted backgrounds.
 * None of them is the destructive red, which stays distinct.
 */
export const ACCENTS: Record<
  AccentId,
  {
    label: string;
    brand: string;
    text: string;
    textDark: string;
    softLight: string;
    softDark: string;
  }
> = {
  blue: {
    label: 'Blue',
    brand: '#1d9bf0',
    text: '#006fd6',
    textDark: '#1d9bf0',
    softLight: '#eef7fe',
    softDark: '#0a1f30',
  },
  purple: {
    label: 'Purple',
    brand: '#7856ff',
    text: '#5b37e6',
    textDark: '#9b85ff',
    softLight: '#f3f0ff',
    softDark: '#1b1540',
  },
  green: {
    label: 'Green',
    brand: '#00ba7c',
    text: '#00704a',
    textDark: '#00ba7c',
    softLight: '#e8f8f1',
    softDark: '#07261b',
  },
  orange: {
    label: 'Orange',
    brand: '#ff7a00',
    text: '#a84f00',
    textDark: '#ff7a00',
    softLight: '#fff3e8',
    softDark: '#2e1b07',
  },
  pink: {
    label: 'Pink',
    brand: '#f91880',
    text: '#c0095f',
    textDark: '#f91880',
    softLight: '#feeef5',
    softDark: '#300a1d',
  },
};

const CUSTOM_ACCENT = /^#[0-9a-f]{6}$/i;
/** A preset's id or a `#rrggbb` color (any case) as the accent it names, else null. */
export function parseAccent(value: unknown): Accent | null {
  if (typeof value !== 'string') return null;
  if (Object.hasOwn(ACCENTS, value)) return value as AccentId;
  return CUSTOM_ACCENT.test(value) ? (value.toLowerCase() as CustomAccent) : null;
}
export const normalizeAccent = (value: unknown, fallback: Accent): Accent =>
  parseAccent(value) ?? fallback;

export interface AccentPalette {
  brand: string;
  text: string;
  textDark: string;
  softLight: string;
  softDark: string;
}

const DARK_SURFACE: Rgb = [15, 20, 25];

/**
 * The shades the side panel and X need for an accent. A preset has them written out; a custom
 * color gets them worked out: a text shade dark enough for 4.5:1 on white, one light enough for
 * 4.5:1 on the dark surface (so the label on a filled button stays readable in both themes), and
 * faint tints for backgrounds.
 */
export function accentPalette(accent: Accent): AccentPalette {
  if (Object.hasOwn(ACCENTS, accent)) return ACCENTS[accent as AccentId];
  const brand = toRgb(accent);
  return {
    brand: accent,
    text: toHex(readable(brand, BLACK, WHITE)),
    textDark: toHex(readable(brand, WHITE, DARK_SURFACE)),
    softLight: toHex(mix(brand, WHITE, 0.92)),
    softDark: toHex(mix(brand, BLACK, 0.85)),
  };
}

const THEMES = new Set<Theme>(['auto', 'light', 'dark']);
const AFTER_SAVE = new Set<AfterSave>(['downloadOffer', 'confirmationOnly', 'quiet']);
const DENSITIES = new Set<Density>(['comfortable', 'compact', 'dense']);
const OPEN_AS = new Set<OpenAs>(['sidepanel', 'popup', 'window']);
const POPUP_HEIGHTS = new Set<PopupHeight>(['compact', 'standard', 'tall']);
const LOOKUPS = new Set<LookupMode>(['manual', 'hover', 'visible']);
const FILTER_MODES = new Set<FilterMode>(['collapse', 'hide', 'highlight']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const pick = <T>(value: unknown, allowed: Set<T>, fallback: T): T =>
  allowed.has(value as T) ? (value as T) : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const FEATURE_ID = /^[a-z][A-Za-z0-9]{0,31}\.[a-z][A-Za-z0-9]{0,47}$/;
const MAX_FEATURES = 256;

/** Keeps only well-formed ids whose value passes `valid`, so storage can never hold junk. */
function normalizeById<T>(input: unknown, valid: (value: unknown) => value is T) {
  const result: Record<string, T> = {};
  if (!isRecord(input)) return result;
  for (const [id, value] of Object.entries(input).slice(0, MAX_FEATURES))
    if (FEATURE_ID.test(id) && valid(value)) result[id] = value;
  return result;
}
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Selected places as canonical names: only real countries and region labels, once each. */
export function normalizeCountries(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input.slice(0, MAX_COUNTRIES * 2)) {
    const place = resolveSelectable(item);
    if (!place || seen.has(placeKey(place))) continue;
    seen.add(placeKey(place));
    result.push(place.name);
    if (result.length >= MAX_COUNTRIES) break;
  }
  return result;
}

/** A handle as people type it ("@Name" or "Name"), lowercase, or null when X could not have it. */
export function normalizeHandle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const handle = input.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

export function normalizeAlwaysShow(input: unknown): AlwaysShowEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: AlwaysShowEntry[] = [];
  for (const item of input.slice(0, MAX_ALWAYS_SHOW * 2)) {
    const entry: Record<string, unknown> = isRecord(item) ? item : { handle: item };
    const handle = normalizeHandle(entry.handle);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    const id = typeof entry.id === 'string' && /^\d{1,25}$/.test(entry.id) ? entry.id : undefined;
    result.push(id ? { handle, id } : { handle });
    if (result.length >= MAX_ALWAYS_SHOW) break;
  }
  return result;
}

function normalizeFilter(input: unknown): FilterSettings {
  const value = isRecord(input) ? input : {};
  const d = DEFAULT_SETTINGS.filter;
  return {
    countries: normalizeCountries(value.countries),
    mode: pick(value.mode, FILTER_MODES, d.mode),
    posts: bool(value.posts, d.posts),
    quotes: bool(value.quotes, d.quotes),
    alwaysShow: normalizeAlwaysShow(value.alwaysShow),
  };
}

const SEED_KEYS = ['bg', 'text', 'accent', 'raised', 'hover', 'border', 'muted'] as const;

/** An X theme id a setting may name: a preset, `custom`, or null for none. Anything else is null. */
export const parseThemeId = (value: unknown): string | null =>
  typeof value === 'string' && (value === CUSTOM_THEME_ID || isPresetId(value)) ? value : null;

/** Every custom color `#rrggbb` lowercase; a missing or malformed one falls back to Lights Out's. */
function normalizeSeed(input: unknown): Required<ThemeSeed> {
  const value = isRecord(input) ? input : {};
  const seed = { ...LIGHTS_OUT_SEED };
  for (const key of SEED_KEYS) {
    const color = value[key];
    if (isHex(color)) seed[key] = color.toLowerCase();
  }
  return seed;
}

function normalizeXTheme(input: unknown): XThemeSettings {
  const value = isRecord(input) ? input : {};
  return {
    active: parseThemeId(value.active),
    custom: normalizeSeed(value.custom),
    chat: bool(value.chat, DEFAULT_SETTINGS.xTheme.chat),
  };
}

export function normalizeSettings(input: unknown): Settings {
  const value = isRecord(input) ? input : {};
  const menu = isRecord(value.menuActions) ? value.menuActions : {};
  const d = DEFAULT_SETTINGS;
  return {
    version: SETTINGS_VERSION,
    theme: pick(value.theme, THEMES, d.theme),
    accent: normalizeAccent(value.accent, d.accent),
    density: pick(value.density, DENSITIES, d.density),
    downloadsEnabled: bool(value.downloadsEnabled, d.downloadsEnabled),
    afterSave: pick(value.afterSave, AFTER_SAVE, d.afterSave),
    menuActions: {
      download: bool(menu.download, d.menuActions.download),
      openLibrary: bool(menu.openLibrary, d.menuActions.openLibrary),
    },
    saveAs: bool(value.saveAs, d.saveAs),
    openAs: pick(value.openAs, OPEN_AS, d.openAs),
    popupHeight: pick(value.popupHeight, POPUP_HEIGHTS, d.popupHeight),
    insights: {
      lookup: pick(
        isRecord(value.insights) ? value.insights.lookup : undefined,
        LOOKUPS,
        d.insights.lookup,
      ),
    },
    filter: normalizeFilter(value.filter),
    xTheme: normalizeXTheme(value.xTheme),
    features: normalizeById(value.features, isBoolean),
    values: normalizeById(value.values, isNumber),
  };
}

export type SettingsPatch = Partial<
  Omit<
    Settings,
    'version' | 'menuActions' | 'features' | 'values' | 'insights' | 'filter' | 'xTheme'
  >
> & {
  /** Merged field by field; `custom` is merged color by color. */
  xTheme?: Partial<Pick<XThemeSettings, 'active' | 'chat'>> & { custom?: Partial<ThemeSeed> };
  menuActions?: Partial<Settings['menuActions']>;
  /** Merged field by field into the stored insights settings. */
  insights?: Partial<InsightsSettings>;
  /** Merged field by field; a list given here replaces the stored list. */
  filter?: Partial<FilterSettings>;
  /**
   * Merged into the stored toggles: ids not mentioned keep their value, and `null` forgets an id
   * (so the feature is back at its default).
   */
  features?: Record<string, boolean | null>;
  /** Merged into the stored slider numbers, the same way. */
  values?: Record<string, number | null>;
};

export function applyPatch(current: Settings, patch: SettingsPatch): Settings {
  return normalizeSettings({
    ...current,
    ...patch,
    menuActions: { ...current.menuActions, ...patch.menuActions },
    insights: { ...current.insights, ...patch.insights },
    filter: { ...current.filter, ...patch.filter },
    xTheme: {
      ...current.xTheme,
      ...patch.xTheme,
      custom: { ...current.xTheme.custom, ...patch.xTheme?.custom },
    },
    features: { ...current.features, ...patch.features },
    values: { ...current.values, ...patch.values },
  });
}

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(stored[SETTINGS_KEY]);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Writes happen one at a time: each is a read, a merge and a write, so two that overlapped (a
 * slider written while the previous number is still being stored) could each read the old value
 * and the earlier one could be stored last. Chained on one promise, the later patch always wins.
 */
let writes: Promise<unknown> = Promise.resolve();

export function saveSettings(patch: SettingsPatch): Promise<Settings> {
  const write = writes.then(async () => {
    const next = applyPatch(await loadSettings(), patch);
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  });
  writes = write.catch(() => {});
  return write;
}

/**
 * Changes settings from what is stored right now: `change` receives the current settings and
 * returns a patch (or null for none). Use it, not `saveSettings`, when the patch replaces a list
 * that another tab may have changed since this one read it.
 */
export function updateSettings(
  change: (current: Settings) => SettingsPatch | null,
): Promise<Settings> {
  const write = writes.then(async () => {
    const current = await loadSettings();
    const patch = change(current);
    if (!patch) return current;
    const next = applyPatch(current, patch);
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  });
  writes = write.catch(() => {});
  return write;
}

/**
 * Restores appearance and Saved/download preferences. The customization toggles and slider
 * numbers are kept (they change what X looks like, which resetting an accent color should not
 * undo), and so are how the toolbar icon opens Better X (and the popup's height), the account insights and country
 * filter settings, and the X theme (it changes how X looks, like the toggles).
 */
export function resetSettings(): Promise<Settings> {
  const write = writes.then(async () => {
    const { features, values, openAs, popupHeight, insights, filter, xTheme } =
      await loadSettings();
    // How the toolbar icon opens, and what the country filter is set to, are not appearance:
    // resetting a look must not change them.
    const next = {
      ...DEFAULT_SETTINGS,
      features,
      values,
      openAs,
      popupHeight,
      insights,
      filter,
      xTheme,
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  });
  writes = write.catch(() => {});
  return write;
}

/** Calls `listener` whenever any context changes settings. Returns an unsubscribe function. */
export function watchSettings(listener: (settings: Settings) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[SETTINGS_KEY])
      listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
