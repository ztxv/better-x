import { describe, expect, it } from 'vitest';
import { accentPalette, normalizeSettings, parseAccent } from './settings';

describe('custom accent', () => {
  it('accepts a preset id or #rrggbb in any case, and nothing else', () => {
    expect(parseAccent('green')).toBe('green');
    expect(parseAccent('#1D9BF0')).toBe('#1d9bf0');
    for (const bad of ['#fff', '1d9bf0', '#12345g', 'teal', 7, null])
      expect(parseAccent(bad)).toBeNull();
  });

  it('keeps a custom accent in stored settings and falls back from junk', () => {
    expect(normalizeSettings({ accent: '#ABCDEF' }).accent).toBe('#abcdef');
    expect(normalizeSettings({ accent: 'javascript:1' }).accent).toBe('blue');
  });

  it('works out text shades that stay readable, even for a very light or very dark color', () => {
    const ratio = (a: string, b: string) => {
      const lum = (hex: string) => {
        const [r, g, bl] = [1, 3, 5]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
          number,
          number,
          number,
        ];
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const color of ['#ffd400', '#000000', '#ffffff', '#1d9bf0'] as const) {
      const palette = accentPalette(color);
      expect(palette.brand).toBe(color);
      expect(ratio(palette.text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(ratio(palette.textDark, '#0f1419')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
