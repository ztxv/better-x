/**
 * X themes: palettes that re-skin x.com. A theme is a seed of a few colors a person can edit;
 * `deriveTokens` fills in the rest and guards contrast; `buildThemeCss` paints X's surfaces from
 * the tokens. Every color here is `#rrggbb` lowercase; nothing else ever reaches the page.
 */

/** X's own display mode. A theme applies only while X is in its `base` mode. */
export type XMode = 'dark' | 'light';

/** What a person edits. `bg`, `text` and `accent` are required; the rest are derived when absent. */
export interface ThemeSeed {
  bg: string;
  text: string;
  accent: string;
  raised?: string;
  hover?: string;
  border?: string;
  muted?: string;
}

export interface ThemeDef {
  /** Stored in settings: never renamed once shipped. */
  id: string;
  title: string;
  description: string;
  /** Applies only while X's mode is this (v1 ships dark themes only). */
  base: XMode;
  seed: ThemeSeed;
}

/** Every color the CSS uses, all `#rrggbb` except the two translucent ones. */
export interface ThemeTokens {
  bg: string;
  raised: string;
  hover: string;
  border: string;
  text: string;
  /** Secondary text; always at least 4.5:1 on `bg`. */
  muted: string;
  /** Fills, rings and marks. The person's color, never changed. */
  accent: string;
  /** The accent nudged to 4.5:1 on `bg`, for accent-colored text (links). */
  accentText: string;
  /** `bg` at 85% opacity, for X's translucent sticky bars. */
  backdrop: string;
  /** Behind modals. */
  scrim: string;
}
