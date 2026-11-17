import { ChevronDown, CopyPlus, Download, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  MAX_SAVED_THEMES,
  MAX_THEME_NAME,
  normalizeThemeName,
  type SettingsPatch,
  type XThemeSettings,
} from '../lib/settings';
import { createThemeFile, newThemeId, themeFilename, uniqueThemeName } from '../themes/file';
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

/** Hands the person a JSON file through a temporary link, as the settings backup does. */
function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The editor for the theme that is on: Custom (`xTheme.custom`) or one of the person's named
 * themes (`xTheme.saved`). Background, Text and Accent up front, the four derived colors under
 * Advanced, a live preview, contrast warnings that never block, "Start from" any preset, and a
 * reset to X's Lights out. Every change is written at once (X follows live), so there is no
 * separate Save: "Save as new theme" keeps the current colors under a name of their own. A named
 * theme can be renamed, exported as a file and deleted (asked twice).
 */
export function ThemeEditor({
  theme,
  onChange,
}: {
  theme: XThemeSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const own = theme.saved.find((saved) => saved.id === theme.active);
  const seed = own?.seed ?? theme.custom;
  const [name, setName] = useState(own?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setName(own?.name ?? '');
    setConfirmDelete(false);
  }, [own?.id, own?.name]);

  /** Writes colors to whichever theme is being edited. */
  const write = (colors: Partial<Required<ThemeSeed>>) =>
    onChange(
      own
        ? {
            xTheme: {
              saved: theme.saved.map((saved) =>
                saved.id === own.id ? { ...saved, seed: { ...saved.seed, ...colors } } : saved,
              ),
            },
          }
        : { xTheme: { custom: colors } },
    );
  const set = (key: SeedKey, value: number) => write({ [key]: toHex(value) });
  const full = theme.saved.length >= MAX_SAVED_THEMES;

  function rename() {
    if (!own) return;
    const next = normalizeThemeName(name);
    if (!next || next === own.name) {
      setName(own.name);
      return;
    }
    onChange({
      xTheme: {
        saved: theme.saved.map((saved) => (saved.id === own.id ? { ...saved, name: next } : saved)),
      },
    });
  }
  function saveAsNew() {
    if (full) return;
    const id = newThemeId();
    const taken = theme.saved.map((saved) => saved.name);
    const title = uniqueThemeName(own ? `${own.name} copy` : 'My theme', taken);
    onChange({
      xTheme: { active: id, saved: [...theme.saved, { id, name: title, seed: fillSeed(seed) }] },
    });
  }
  function remove() {
    if (!own) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onChange({
      xTheme: { active: null, saved: theme.saved.filter((saved) => saved.id !== own.id) },
    });
  }
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
        <h3 id="theme-editor-title">{own ? 'Edit theme' : 'Custom colors'}</h3>
        <label className="theme-start">
          <span>Start from</span>
          <select
            value=""
            aria-label="Start from a theme"
            onChange={(event) => {
              const preset = PRESETS.find((p) => p.id === event.target.value);
              if (preset) write(fillSeed(preset.seed));
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

      {own && (
        <label className="theme-name">
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={MAX_THEME_NAME}
            aria-label="Theme name"
            onChange={(event) => setName(event.target.value)}
            onBlur={rename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
      )}

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

      <div className="theme-actions">
        <button
          type="button"
          className="text-button"
          disabled={full}
          title={full ? `You can keep ${MAX_SAVED_THEMES} themes` : undefined}
          onClick={saveAsNew}
        >
          <CopyPlus size={13} /> {own ? 'Duplicate' : 'Save as new theme'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            downloadJson(
              themeFilename(own?.name ?? 'custom'),
              createThemeFile(own?.name ?? 'Custom', fillSeed(seed)),
            )
          }
        >
          <Download size={13} /> Export
        </button>
        <button type="button" className="text-button" onClick={() => write({ ...LIGHTS_OUT_SEED })}>
          <RotateCcw size={13} /> Reset to Lights out
        </button>
        {own && (
          <button
            type="button"
            className="text-button danger"
            onClick={remove}
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 size={13} /> {confirmDelete ? 'Really delete?' : 'Delete'}
          </button>
        )}
      </div>
      <p className="setting-hint">
        Changes apply to X as you make them and are saved automatically.
      </p>
    </section>
  );
}
