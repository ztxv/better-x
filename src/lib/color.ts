/**
 * Color math shared by the accent palette (`settings.ts`) and the X themes (`src/themes`). Colors
 * are `[r, g, b]` with channels 0-255; contrast is WCAG 2.x relative-luminance contrast.
 */

export type Rgb = [number, number, number];

export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

const HEX = /^#[0-9a-f]{6}$/i;
/** True for exactly `#rrggbb` (any case). Nothing else is ever a color here. */
export const isHex = (value: unknown): value is string =>
  typeof value === 'string' && HEX.test(value);

export const toRgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
export const toHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((c, i) => c + (b[i]! - c) * t) as Rgb;

export const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

export const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** Moves `color` toward `target` just far enough to reach 4.5:1 against `against`. */
export function readable(color: Rgb, target: Rgb, against: Rgb): Rgb {
  let result = color;
  for (let t = 0; t <= 1 && contrast(result, against) < 4.5; t += 0.05)
    result = mix(color, target, t);
  return result;
}

/**
 * `color` moved the least distance needed to reach `ratio` against `against`, always succeeding
 * for ratios up to 4.5: first toward `prefer`, and if even `prefer` itself falls short, toward
 * white or black, whichever contrasts more with `against` (one of them always reaches 4.58:1).
 * Works on rounded channels, so the answer holds once written as hex.
 */
export function ensureContrast(color: Rgb, against: Rgb, ratio: number, prefer: Rgb): Rgb {
  const round = (rgb: Rgb) => rgb.map((c) => Math.round(c)) as Rgb;
  if (contrast(round(color), against) >= ratio) return round(color);
  const extreme = contrast(WHITE, against) >= contrast(BLACK, against) ? WHITE : BLACK;
  const target = contrast(round(prefer), against) >= ratio ? prefer : extreme;
  for (let step = 1; step <= 40; step++) {
    const next = round(mix(color, target, step / 40));
    if (contrast(next, against) >= ratio) return next;
  }
  return round(target);
}

/** `r g b` as space-separated HSL components (`210 34% 13%`), the form Tailwind tokens use. */
export function toHslComponents([r, g, b]: Rgb): string {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255];
  const max = Math.max(rs, gs, bs);
  const min = Math.min(rs, gs, bs);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rs) h = ((gs - bs) / d) % 6;
    else if (max === gs) h = (bs - rs) / d + 2;
    else h = (rs - gs) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const fixed = (n: number) => Number(n.toFixed(1));
  return `${fixed(h)} ${fixed(s * 100)}% ${fixed(l * 100)}%`;
}
