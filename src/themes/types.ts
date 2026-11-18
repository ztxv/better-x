/**
 * X themes: palettes that re-skin x.com. A theme is a seed of a few colors a person can edit;
 * `deriveTokens` fills in the rest and guards contrast; `buildThemeCss` paints X's surfaces from
 * the tokens. Every color here is `#rrggbb` lowercase; nothing else ever reaches the page.
 */

/** X's own display mode. A theme applies only while X is in its `base` mode. */
export type XMode = 'dark' | 'light';

/** What a person edits. `bg`, `text` and `accent` are required; the rest are derived when absent. */
export interface CoreSeed {
  bg: string;
  text: string;
  accent: string;
  raised?: string;
  hover?: string;
  border?: string;
  muted?: string;
}

/**
 * Fine-tuning a theme may add on top of its core colors. Unlike the core colors these are never
 * filled in: absent means "follow the accent", so changing the accent keeps moving them too.
 */
export interface SeedExtras {
  /** @mentions, #hashtags and links inside posts and bios. Absent: the accent (as text). */
  mention?: string;
  /** The unread count bubble on Notifications and Messages. Absent: the accent. */
  badge?: string;
  /** The number inside that bubble. Absent: white, or black on a light badge. */
  badgeText?: string;
}

export type ThemeSeed = CoreSeed & SeedExtras;
/** Every core color present; extras only where the person set them. */
export type FullSeed = Required<CoreSeed> & SeedExtras;

export const CORE_SEED_KEYS = [
  'bg',
  'text',
  'accent',
  'raised',
  'hover',
  'border',
  'muted',
] as const;
export const EXTRA_SEED_KEYS = ['mention', 'badge', 'badgeText'] as const;

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
  /**
   * The accent under the pointer and while pressed: 10% and 20% toward black, which is exactly
   * how X derives its own (rgb(29,155,240) → rgb(26,140,216) → rgb(23,124,192)).
   */
  accentHover: string;
  accentActive: string;
  /** The keyboard focus ring: the accent halfway to white, as X's rgb(142,205,248) is to its blue. */
  ring: string;
  /** The accent at 10% opacity, for the tinted circles behind icons and light hovers. */
  accentTint: string;
  /** `bg` at 85% opacity, for X's translucent sticky bars. */
  backdrop: string;
  /** Behind modals. */
  scrim: string;
  /** Links, mentions and hashtags in posts. */
  mention: string;
  /** The unread count bubble, and the number in it. */
  badge: string;
  badgeText: string;
}
