import { BLACK, contrast, ensureContrast, isHex, mix, toHex, toRgb, type Rgb } from '../lib/color';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, presetById } from './presets';
import type { ThemeDef, ThemeSeed, ThemeTokens } from './types';

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
  return {
    bg: toHex(bg),
    raised: toHex(raised),
    hover: toHex(hover),
    border: toHex(border),
    text: toHex(text),
    muted: toHex(muted),
    accent: toHex(accent),
    accentText: toHex(accentText),
    backdrop: rgba(bg, 0.85),
    scrim: rgba(mix(bg, BLACK, 0.5), 0.6),
  };
}

/** The theme a setting names, or undefined for none / unknown. */
export function resolveTheme(
  active: string | null,
  custom: ThemeSeed,
): Pick<ThemeDef, 'id' | 'base' | 'seed'> | undefined {
  if (active === CUSTOM_THEME_ID) return { id: CUSTOM_THEME_ID, base: 'dark', seed: custom };
  return active ? presetById(active) : undefined;
}

export interface ContrastWarning {
  pair: 'text' | 'accent' | 'border';
  ratio: number;
  minimum: number;
}

/**
 * Pairs the editor warns about (it never blocks): text on background under 4.5:1, accent under
 * 3:1, border under 1.25:1 (dividers that vanish).
 */
export function contrastWarnings(seed: ThemeSeed): ContrastWarning[] {
  const tokens = deriveTokens(seed);
  const bg = toRgb(tokens.bg);
  const checks: Array<[ContrastWarning['pair'], string, number]> = [
    ['text', tokens.text, 4.5],
    ['accent', tokens.accent, 3],
    ['border', tokens.border, 1.25],
  ];
  return checks
    .map(([pair, value, minimum]) => ({ pair, ratio: contrast(toRgb(value), bg), minimum }))
    .filter((warning) => warning.ratio < warning.minimum);
}

/** Every seed color filled in (derived where absent), for "Start from" a preset. */
export function fillSeed(seed: ThemeSeed): Required<ThemeSeed> {
  const tokens = deriveTokens(seed);
  return {
    bg: tokens.bg,
    text: tokens.text,
    accent: tokens.accent,
    raised: tokens.raised,
    hover: tokens.hover,
    border: tokens.border,
    muted: tokens.muted,
  };
}
