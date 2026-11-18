import type { XThemeSettings } from '../lib/settings';
import { BLACK, WHITE, contrast, mix, toHex, toRgb } from '../lib/color';
import { deriveTokens, resolveTheme } from './derive';
import { LIGHTS_OUT_SEED } from './presets';

/** The panel's own color variables (src/sidepanel/styles.css), as the X theme fills them. */
export interface PanelTokens {
  '--bg': string;
  '--surface': string;
  '--surface-muted': string;
  '--hover': string;
  '--text': string;
  '--muted': string;
  '--border': string;
  '--brand': string;
  '--accent': string;
  '--accent-soft': string;
  '--on-accent': string;
}

/**
 * Better X's own panel painted with the X theme that is on, for "Match Better X to my X theme".
 * Null when the switch is off. With no theme chosen, X's own Lights out is matched. Every value
 * comes from `deriveTokens`, so it is a `#rrggbb` color and nothing else.
 */
export function panelTokens(theme: XThemeSettings): PanelTokens | null {
  if (!theme.matchPanel) return null;
  const seed = resolveTheme(theme.active, theme.custom, theme.saved)?.seed ?? LIGHTS_OUT_SEED;
  const t = deriveTokens(seed);
  const bg = toRgb(t.bg);
  const accent = toRgb(t.accent);
  // The label on accent buttons: white when it reads, else the darkest of bg and near-black.
  const onAccent = contrast(WHITE, accent) >= 3 ? '#ffffff' : toHex(mix(bg, BLACK, 0.5));
  return {
    '--bg': t.bg,
    '--surface': t.raised,
    '--surface-muted': toHex(mix(bg, toRgb(t.raised), 0.6)),
    '--hover': t.hover,
    '--text': t.text,
    '--muted': t.muted,
    '--border': t.border,
    '--brand': t.accent,
    '--accent': t.accentText,
    '--accent-soft': toHex(mix(bg, accent, 0.16)),
    '--on-accent': onAccent,
  };
}
