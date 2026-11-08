import { isHex, toHslComponents, toRgb } from '../lib/color';
import { deriveTokens } from './derive';
import { LIGHTS_OUT_SEED } from './presets';
import { SURFACES, type Surface } from './surfaces';
import type { ThemeTokens } from './types';

/** Every theme rule hangs off this; removing the attribute switches the whole theme off at once. */
export const THEME_ATTR = 'data-bx-theme';
const ROOT = `html[${THEME_ATTR}]`;

const RGBA = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d{1,3})\)$/;
const HEX_KEYS = [
  'bg',
  'raised',
  'hover',
  'border',
  'text',
  'muted',
  'accent',
  'accentText',
] as const;

/**
 * The tokens, checked again at the last moment: every color must be exactly `#rrggbb` or the
 * `rgba()` this module writes itself. Tokens come from `deriveTokens`, which only produces those,
 * so this never fires in practice; it is what makes "nothing but colors reaches the page" a
 * property of this function rather than of every caller.
 */
function safeTokens(tokens: ThemeTokens): ThemeTokens {
  const fallback = deriveTokens(LIGHTS_OUT_SEED);
  const result = { ...tokens };
  for (const key of HEX_KEYS) if (!isHex(result[key])) result[key] = fallback[key];
  for (const key of ['backdrop', 'scrim'] as const)
    if (!RGBA.test(result[key])) result[key] = fallback[key];
  return result;
}

/** The custom-properties block: the only part that changes when the palette changes. */
export function themeVars(input: ThemeTokens): string {
  const t = safeTokens(input);
  const hsl = (hex: string) => toHslComponents(toRgb(hex));
  const lines = [
    `--bx-t-bg: ${t.bg};`,
    `--bx-t-raised: ${t.raised};`,
    `--bx-t-hover: ${t.hover};`,
    `--bx-t-border: ${t.border};`,
    `--bx-t-text: ${t.text};`,
    `--bx-t-muted: ${t.muted};`,
    `--bx-t-accent: ${t.accent};`,
    `--bx-t-accent-text: ${t.accentText};`,
    `--bx-t-backdrop: ${t.backdrop};`,
    `--bx-t-scrim: ${t.scrim};`,
    `--bx-t-bg-hsl: ${hsl(t.bg)};`,
    `--bx-t-raised-hsl: ${hsl(t.raised)};`,
    `--bx-t-hover-hsl: ${hsl(t.hover)};`,
    `--bx-t-border-hsl: ${hsl(t.border)};`,
    `--bx-t-text-hsl: ${hsl(t.text)};`,
    `--bx-t-muted-hsl: ${hsl(t.muted)};`,
  ];
  return `${ROOT} {\n  ${lines.join('\n  ')}\n}\n`;
}

const prefix = (selector: string) =>
  selector.startsWith('&') ? ROOT + selector.slice(1) : `${ROOT} ${selector}`;

function value(surface: Surface, property: string): string {
  if (surface.role === 'keep') return surface.value === 'black' ? '#000000' : 'transparent';
  if (property === 'scrollbar-color') return 'var(--bx-t-border) var(--bx-t-bg)';
  return `var(--bx-t-${surface.role})`;
}

/**
 * The surface rules: constant for a given `chat` choice, so a palette change never rebuilds
 * them. Every selector is under `html[data-bx-theme]`; `!important` because X writes many of
 * these colors inline.
 */
export function themeRules(
  { chat }: { chat: boolean },
  surfaces: readonly Surface[] = SURFACES,
): string {
  return surfaces
    .filter((surface) => chat || !surface.chat)
    .map((surface) => {
      const declarations = surface.properties
        .map((property) => `${property}: ${value(surface, property)} !important;`)
        .join(' ');
      return `${surface.selectors.map(prefix).join(',\n')} { ${declarations} }`;
    })
    .join('\n');
}

/** The whole theme stylesheet: deterministic, rewritten wholesale, never accumulated. */
export function buildThemeCss(tokens: ThemeTokens, options: { chat: boolean }): string {
  return themeVars(tokens) + themeRules(options) + '\n';
}
