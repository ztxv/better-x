import {
  BLACK,
  WHITE,
  contrast,
  ensureContrast,
  isHex,
  mix,
  toHex,
  toRgb,
  type Rgb,
} from '../lib/color';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, presetById } from './presets';
import { EXTRA_SEED_KEYS } from './types';
import type { FullSeed, ThemeDef, ThemeSeed, ThemeTokens } from './types';

/** A seed color, or the fallback when it is missing or not `#rrggbb`. */
const color = (value: string | undefined, fallback: string): Rgb =>
  toRgb(isHex(value) ? value : fallback);

const rgba = ([r, g, b]: Rgb, alpha: number) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

/**
 * Every token a theme needs, from a seed. Missing colors are mixed from `bg` and `text`.
 * `muted` and `accentText` always end at 4.5:1 or better on `bg`, whether supplied or derived;
 * the guard only ever moves those derived tokens, never the person's `bg`, `text` or `accent`.
 */
export function deriveTokens(seed: ThemeSeed): ThemeTokens {
  const bg = color(seed.bg, LIGHTS_OUT_SEED.bg);
  const text = color(seed.text, LIGHTS_OUT_SEED.text);
  const accent = color(seed.accent, LIGHTS_OUT_SEED.accent);
  const pick = (value: string | undefined, derived: Rgb): Rgb =>
    isHex(value) ? toRgb(value) : derived;
  const raised = pick(seed.raised, mix(bg, text, 0.08));
  const hover = pick(seed.hover, mix(bg, text, 0.04));
  const border = pick(seed.border, mix(bg, text, 0.16));
  const muted = ensureContrast(pick(seed.muted, mix(bg, text, 0.62)), bg, 4.5, text);
  const accentText = ensureContrast(accent, bg, 4.5, text);
  // The extras follow the accent unless the person chose their own; their choice is used as is.
  const mention = pick(seed.mention, accentText);
  const badge = pick(seed.badge, accent);
  const badgeText = pick(
    seed.badgeText,
    contrast(WHITE, badge) >= 2.2 ? WHITE : ([15, 20, 25] as Rgb),
  );
  return {
    bg: toHex(bg),
    raised: toHex(raised),
    hover: toHex(hover),
    border: toHex(border),
    text: toHex(text),
    muted: toHex(muted),
    accent: toHex(accent),
    accentText: toHex(accentText),
    accentHover: toHex(mix(accent, BLACK, 0.1)),
    accentActive: toHex(mix(accent, BLACK, 0.2)),
    ring: toHex(mix(accent, WHITE, 0.5)),
    accentTint: rgba(accent, 0.1),
    backdrop: rgba(bg, 0.85),
    scrim: rgba(mix(bg, BLACK, 0.5), 0.6),
    mention: toHex(mention),
    badge: toHex(badge),
    badgeText: toHex(badgeText),
  };
}

/** The theme a setting names, or undefined for none / unknown. */
export function resolveTheme(
  active: string | null,
  custom: ThemeSeed,
  saved: ReadonlyArray<{ id: string; seed: ThemeSeed }> = [],
): Pick<ThemeDef, 'id' | 'base' | 'seed'> | undefined {
  if (active === CUSTOM_THEME_ID) return { id: CUSTOM_THEME_ID, base: 'dark', seed: custom };
  if (!active) return undefined;
  const own = saved.find((theme) => theme.id === active);
  return own ? { id: own.id, base: 'dark', seed: own.seed } : presetById(active);
}

export interface ContrastWarning {
  pair: 'text' | 'accent' | 'border' | 'label';
  ratio: number;
  minimum: number;
}

/**
 * Pairs the editor warns about (it never blocks): text on background under 4.5:1, accent under
 * 3:1, border under 1.25:1 (dividers that vanish), and white button labels on the accent under 2.2:1.
 */
export function contrastWarnings(seed: ThemeSeed): ContrastWarning[] {
  const tokens = deriveTokens(seed);
  const bg = toRgb(tokens.bg);
  const checks: Array<[ContrastWarning['pair'], string, number]> = [
    ['text', tokens.text, 4.5],
    ['accent', tokens.accent, 3],
    ['border', tokens.border, 1.25],
  ];
  const warnings = checks
    .map(([pair, value, minimum]) => ({ pair, ratio: contrast(toRgb(value), bg), minimum }))
    .filter((warning) => warning.ratio < warning.minimum);
  // X writes its button labels (Post, "Show 12 posts", Follow back) in white on the accent. X's
  // own blue is 3:1 against white, so only a clearly lighter accent (yellow, lime) is flagged.
  const label = contrast(WHITE, toRgb(tokens.accent));
  if (label < 2.2) warnings.push({ pair: 'label', ratio: label, minimum: 2.2 });
  return warnings;
}

/**
 * Every core seed color filled in (derived where absent), for "Start from" a preset. Extras the
 * seed sets are kept; absent ones stay absent so they keep following the accent.
 */
export function fillSeed(seed: ThemeSeed): FullSeed {
  const tokens = deriveTokens(seed);
  const extras: Partial<FullSeed> = {};
  for (const key of EXTRA_SEED_KEYS) if (isHex(seed[key])) extras[key] = seed[key];
  return {
    ...extras,
    bg: tokens.bg,
    text: tokens.text,
    accent: tokens.accent,
    raised: tokens.raised,
    hover: tokens.hover,
    border: tokens.border,
    muted: tokens.muted,
  };
}
