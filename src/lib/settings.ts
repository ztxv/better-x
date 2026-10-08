/**
 * Customization shared by the side panel, the X content script, and the background worker.
 * Stored in `chrome.storage.local` under one key so every context reads the same values and
 * hears changes live. Invalid or missing fields fall back to defaults field by field.
 * Settings never hold library data, so resetting them never deletes anything.
 */

export const SETTINGS_KEY = 'bx.settings';
/**
 * Version 2 added `features` (customization toggles); version 3 added `values` (the numbers of
 * slider features). A stored older object lacks them, so it loads with every feature at its
 * default and is rewritten at the current version on the next save; no other field changes
 * meaning, and nothing a user had set is lost.
 */
export const SETTINGS_VERSION = 3;

export type Theme = 'auto' | 'light' | 'dark';
export type AfterSave = 'downloadOffer' | 'confirmationOnly' | 'quiet';
export type AccentId = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

export interface Settings {
  version: typeof SETTINGS_VERSION;
  theme: Theme;
  accent: AccentId;
  /** Shows download offers and actions. Turning it off never removes download history. */
  downloadsEnabled: boolean;
  afterSave: AfterSave;
  /** Optional rows in the saved-post menu. Remove bookmark is always shown. */
  menuActions: { download: boolean; openLibrary: boolean };
  /** Ask where to save each file. Chrome's own "Ask where to save" setting can still prompt. */
  saveAs: boolean;
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
  downloadsEnabled: true,
  afterSave: 'downloadOffer',
  menuActions: { download: true, openLibrary: true },
  saveAs: false,
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

const THEMES = new Set<Theme>(['auto', 'light', 'dark']);
const AFTER_SAVE = new Set<AfterSave>(['downloadOffer', 'confirmationOnly', 'quiet']);

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

export function normalizeSettings(input: unknown): Settings {
  const value = isRecord(input) ? input : {};
  const menu = isRecord(value.menuActions) ? value.menuActions : {};
  const d = DEFAULT_SETTINGS;
  return {
    version: SETTINGS_VERSION,
    theme: pick(value.theme, THEMES, d.theme),
    accent: Object.hasOwn(ACCENTS, value.accent as string) ? (value.accent as AccentId) : d.accent,
    downloadsEnabled: bool(value.downloadsEnabled, d.downloadsEnabled),
    afterSave: pick(value.afterSave, AFTER_SAVE, d.afterSave),
    menuActions: {
      download: bool(menu.download, d.menuActions.download),
      openLibrary: bool(menu.openLibrary, d.menuActions.openLibrary),
    },
    saveAs: bool(value.saveAs, d.saveAs),
    features: normalizeById(value.features, isBoolean),
    values: normalizeById(value.values, isNumber),
  };
}

export type SettingsPatch = Partial<
  Omit<Settings, 'version' | 'menuActions' | 'features' | 'values'>
> & {
  menuActions?: Partial<Settings['menuActions']>;
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
 * Restores appearance and Saved/download preferences. The customization toggles and slider
 * numbers are kept: they change what X looks like, which resetting an accent color should not undo.
 */
export function resetSettings(): Promise<Settings> {
  const write = writes.then(async () => {
    const { features, values } = await loadSettings();
    const next = { ...DEFAULT_SETTINGS, features, values };
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
