import { isHex } from '../lib/color';
import { MAX_THEME_NAME, normalizeThemeName } from '../lib/settings';
import { fillSeed } from './derive';
import type { FullSeed, ThemeSeed } from './types';

/**
 * One X theme as a file, to share or keep: `{ format, version, name, colors }`, colors `#rrggbb`.
 * Background, text and accent are required; the other four are derived when a file leaves them
 * out. Read defensively, like the settings backup: size, JSON, format, version, then each color.
 * Nothing but a name and seven validated colors ever leaves this module.
 */
export const THEME_FILE_FORMAT = 'better-x-theme';
export const THEME_FILE_VERSION = 1;
export const MAX_THEME_FILE_BYTES = 20_000;

const REQUIRED = ['bg', 'text', 'accent'] as const;
const OPTIONAL = ['raised', 'hover', 'border', 'muted', 'mention', 'badge', 'badgeText'] as const;

export interface ThemeFile {
  format: typeof THEME_FILE_FORMAT;
  version: typeof THEME_FILE_VERSION;
  name: string;
  colors: FullSeed;
}

export const createThemeFile = (name: string, seed: FullSeed): ThemeFile => ({
  format: THEME_FILE_FORMAT,
  version: THEME_FILE_VERSION,
  name,
  colors: { ...seed },
});

/** `My theme` → `better-x-theme-my-theme.json`. */
export function themeFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_THEME_NAME);
  return `better-x-theme-${slug || 'custom'}.json`;
}

export type ParsedThemeFile =
  { ok: true; name: string; seed: FullSeed } | { ok: false; error: string };

export function parseThemeFile(text: string): ParsedThemeFile {
  const fail = (error: string): ParsedThemeFile => ({ ok: false, error });
  if (text.length > MAX_THEME_FILE_BYTES) return fail('That file is too large to be a theme.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('That file is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return fail('That file is not a Better X theme.');
  const file = data as Record<string, unknown>;
  if (file.format !== THEME_FILE_FORMAT)
    return fail(
      file.format === 'better-x-settings'
        ? 'That is a settings backup. Import it from Settings instead.'
        : 'That file is not a Better X theme.',
    );
  if (file.version !== THEME_FILE_VERSION)
    return fail('That theme was made by a newer version of Better X.');
  const colors = file.colors;
  if (typeof colors !== 'object' || colors === null || Array.isArray(colors))
    return fail('That theme has no colors.');
  const source = colors as Record<string, unknown>;
  const seed: Partial<ThemeSeed> = {};
  for (const key of REQUIRED) {
    const color = source[key];
    if (!isHex(color)) return fail(`That theme's ${key} color is missing or not a #rrggbb color.`);
    seed[key] = color.toLowerCase();
  }
  for (const key of OPTIONAL) {
    const color = source[key];
    if (color === undefined) continue;
    if (!isHex(color)) return fail(`That theme's ${key} color is not a #rrggbb color.`);
    seed[key] = color.toLowerCase();
  }
  return {
    ok: true,
    name: normalizeThemeName(file.name) ?? 'Imported theme',
    // Colors the file gives are kept exactly; only the ones it leaves out are derived.
    seed: { ...fillSeed(seed as ThemeSeed), ...seed },
  };
}

/** A new saved theme's id: `my-` and eight random letters and digits. */
export function newThemeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `my-${[...bytes].map((byte) => (byte % 36).toString(36)).join('')}`;
}

/** `name`, or `name 2`, `name 3`… when a theme is already called that. */
export function uniqueThemeName(name: string, taken: readonly string[]): string {
  const base = normalizeThemeName(name) ?? 'My theme';
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = base.slice(0, MAX_THEME_NAME - suffix.length) + suffix;
    if (!taken.includes(candidate)) return candidate;
  }
}
