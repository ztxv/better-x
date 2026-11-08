import { ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { SettingsPatch, XThemeSettings } from '../lib/settings';
import { contrastWarnings, deriveTokens, fillSeed } from '../themes/derive';
import { LIGHTS_OUT_SEED, PRESETS } from '../themes/presets';
import type { ThemeSeed } from '../themes/types';
import { ColorField, parseHex, toHex } from './ColorField';
import { ThemePreview } from './ThemeCard';

type SeedKey = keyof Required<ThemeSeed>;

const PRIMARY: ReadonlyArray<{ key: SeedKey; label: string; hint: string }> = [
  { key: 'bg', label: 'Background', hint: 'The page and columns' },
  { key: 'text', label: 'Text', hint: 'Posts, names, menus' },
  { key: 'accent', label: 'Accent', hint: 'Links and highlights' },
];
const ADVANCED: ReadonlyArray<{ key: SeedKey; label: string; hint: string }> = [
  { key: 'raised', label: 'Raised', hint: 'Cards, menus, modals' },
  { key: 'hover', label: 'Hover', hint: 'Under the pointer' },
  { key: 'border', label: 'Border', hint: 'Lines between posts' },
  { key: 'muted', label: 'Secondary text', hint: 'Handles, times, counts' },
];

const WARNINGS: Record<string, string> = {
  text: 'Text is hard to read on this background',
  accent: 'The accent barely stands out from the background',
  border: 'Lines between posts will be almost invisible',
};

const number = (hex: string) => parseHex(hex) ?? 0;

/**
 * The Custom theme: Background, Text and Accent up front, the four derived colors under
 * Advanced, a live preview, contrast warnings that never block, "Start from" any preset, and a
 * reset to X's Lights out. Every change is one color in `xTheme.custom`.
 */
export function ThemeEditor({
  theme,
  onChange,
}: {
  theme: XThemeSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const seed = theme.custom;
  const set = (key: SeedKey, value: number) =>
    onChange({ xTheme: { custom: { [key]: toHex(value) } } });
  const warnings = contrastWarnings(seed);

  const field = ({ key, label, hint }: { key: SeedKey; label: string; hint: string }) => (
    <div className="theme-field" key={key}>
      <div className="theme-field-label">
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      <ColorField
        label={label}
        value={number(seed[key])}
        defaultValue={number(LIGHTS_OUT_SEED[key])}
        swatches={key === 'accent'}
        onValue={(value) => set(key, value)}
      />
    </div>
  );

  return (
    <section className="theme-editor" aria-labelledby="theme-editor-title">
      <div className="theme-editor-head">
        <h3 id="theme-editor-title">Custom colors</h3>
        <label className="theme-start">
          <span>Start from</span>
          <select
            value=""
            aria-label="Start from a theme"
            onChange={(event) => {
              const preset = PRESETS.find((p) => p.id === event.target.value);
              if (preset) onChange({ xTheme: { custom: fillSeed(preset.seed) } });
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ThemePreview tokens={deriveTokens(seed)} large />

      {warnings.length > 0 && (
        <ul className="theme-warnings" role="status">
          {warnings.map((warning) => (
            <li key={warning.pair}>
              <TriangleAlert size={13} aria-hidden="true" />
              {WARNINGS[warning.pair]} ({warning.ratio.toFixed(1)}:1)
            </li>
          ))}
        </ul>
      )}

      {PRIMARY.map(field)}

      <button
        type="button"
        className="theme-advanced-toggle"
        aria-expanded={advanced}
        aria-controls="theme-advanced"
        onClick={() => setAdvanced(!advanced)}
      >
        <ChevronDown size={14} aria-hidden="true" />
        Advanced
      </button>
      <div id="theme-advanced" hidden={!advanced}>
        {ADVANCED.map(field)}
      </div>

      <button
        type="button"
        className="text-button"
        onClick={() => onChange({ xTheme: { custom: { ...LIGHTS_OUT_SEED } } })}
      >
        <RotateCcw size={13} /> Reset to Lights out
      </button>
    </section>
  );
}
