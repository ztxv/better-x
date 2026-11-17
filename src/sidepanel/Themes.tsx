import { Plus, Undo2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SAVED_THEMES, type Settings, type SettingsPatch } from '../lib/settings';
import { MAX_THEME_FILE_BYTES, newThemeId, parseThemeFile, uniqueThemeName } from '../themes/file';
import { deriveTokens, fillSeed } from '../themes/derive';
import { XMODE_CACHE_KEY } from '../themes/host';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, PRESETS } from '../themes/presets';
import type { XMode } from '../themes/types';
import { ThemeCard } from './ThemeCard';
import { ThemeEditor } from './ThemeEditor';

const LIGHTS_OUT = deriveTokens(LIGHTS_OUT_SEED);
const PRESET_TOKENS = new Map(PRESETS.map((preset) => [preset.id, deriveTokens(preset.seed)]));

const titleOf = (id: string | null, saved: Settings['xTheme']['saved'] = []) =>
  id === null
    ? 'Lights out'
    : id === CUSTOM_THEME_ID
      ? 'Custom'
      : (saved.find((own) => own.id === id)?.name ?? PRESETS.find((p) => p.id === id)?.title ?? id);

/** The X mode the theme script last saw (`bx.xmode`), kept up to date. Null until one is known. */
function useXMode(): XMode | null {
  const [mode, setMode] = useState<XMode | null>(null);
  useEffect(() => {
    const read = (value: unknown) => setMode(value === 'dark' || value === 'light' ? value : null);
    chrome.storage.local
      .get(XMODE_CACHE_KEY)
      .then((stored) => read(stored[XMODE_CACHE_KEY]))
      .catch(() => {});
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[XMODE_CACHE_KEY]) read(changes[XMODE_CACHE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);
  return mode;
}

/**
 * The Themes tab: X's own Lights out, the presets and Custom as cards (choosing one is live in
 * every X tab at once), the Custom editor when Custom is chosen, and Undo after a switch. It only
 * reads and writes `xTheme`. Chat theming (`xTheme.chat`) is built but has no switch here yet:
 * it is on the back burner until the shadow-DOM part (P4) is done.
 */
export function Themes({
  settings,
  onChange,
  hidden = false,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
  hidden?: boolean;
}) {
  const theme = settings.xTheme;
  const mode = useXMode();
  const [previous, setPrevious] = useState<{ id: string | null } | null>(null);
  const customTokens = useMemo(() => deriveTokens(theme.custom), [theme.custom]);
  const [fileStatus, setFileStatus] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing =
    theme.active === CUSTOM_THEME_ID || theme.saved.some((t) => t.id === theme.active);
  const full = theme.saved.length >= MAX_SAVED_THEMES;

  /** Adds a named theme and turns it on. */
  function addTheme(name: string, seed: Settings['xTheme']['custom']) {
    const id = newThemeId();
    const title = uniqueThemeName(
      name,
      theme.saved.map((own) => own.name),
    );
    setPrevious({ id: theme.active });
    onChange({ xTheme: { active: id, saved: [...theme.saved, { id, name: title, seed }] } });
    return title;
  }
  async function importTheme(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (full) {
      setFileStatus({
        text: `You can keep ${MAX_SAVED_THEMES} themes. Delete one first.`,
        error: true,
      });
      return;
    }
    if (file.size > MAX_THEME_FILE_BYTES) {
      setFileStatus({ text: 'That file is too large to be a theme.', error: true });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileStatus({ text: 'That file could not be read.', error: true });
      return;
    }
    const result = parseThemeFile(text);
    if (!result.ok) {
      setFileStatus({ text: result.error, error: true });
      return;
    }
    setFileStatus({ text: `Imported “${addTheme(result.name, result.seed)}”.`, error: false });
  }

  function choose(id: string | null) {
    if (id === theme.active) return;
    setPrevious({ id: theme.active });
    onChange({ xTheme: { active: id } });
  }
  function undo() {
    if (!previous) return;
    onChange({ xTheme: { active: previous.id } });
    setPrevious(null);
  }

  return (
    <div
      className="themes"
      id="themes-panel"
      role="tabpanel"
      aria-labelledby="themes-tab"
      hidden={hidden}
    >
      <h2 className="themes-title">Themes for X</h2>
      <p className="customize-summary">
        Recolors x.com while X is set to Lights out. Switch X to Default and the theme steps aside.
      </p>
      {theme.active !== null && mode === 'light' ? (
        <p className="themes-paused" role="status">
          X is in Default (light) right now, so {titleOf(theme.active, theme.saved)} is paused. It
          comes back when X is in Lights out.
        </p>
      ) : (
        <p className={`themes-active ${theme.active === null ? '' : 'is-on'}`} role="status">
          <span className="themes-active-dot" aria-hidden="true" />
          {theme.active === null ? (
            'No Better X theme: X shows its own colors.'
          ) : (
            <>
              Better X theme on: <strong>{titleOf(theme.active, theme.saved)}</strong>
            </>
          )}
        </p>
      )}

      <div className="theme-grid" role="group" aria-label="Theme">
        <ThemeCard
          title="Lights out"
          description="X’s own colors, no theme"
          tokens={LIGHTS_OUT}
          selected={theme.active === null}
          onSelect={() => choose(null)}
        />
        {PRESETS.map((preset) => (
          <ThemeCard
            key={preset.id}
            title={preset.title}
            description={preset.description}
            tokens={PRESET_TOKENS.get(preset.id)!}
            selected={theme.active === preset.id}
            onSelect={() => choose(preset.id)}
          />
        ))}
        <ThemeCard
          title="Custom"
          description="Your own colors"
          tokens={customTokens}
          selected={theme.active === CUSTOM_THEME_ID}
          onSelect={() => choose(CUSTOM_THEME_ID)}
        />
        {theme.saved.map((own) => (
          <ThemeCard
            key={own.id}
            title={own.name}
            description="Your theme"
            tokens={deriveTokens(own.seed)}
            selected={theme.active === own.id}
            onSelect={() => choose(own.id)}
          />
        ))}
      </div>

      <div className="theme-actions">
        <button
          type="button"
          className="text-button"
          disabled={full}
          onClick={() => {
            setFileStatus(null);
            // Starts from what is on screen now, so a new theme is never a surprise.
            const from =
              theme.saved.find((own) => own.id === theme.active)?.seed ??
              (theme.active === CUSTOM_THEME_ID
                ? theme.custom
                : PRESETS.find((p) => p.id === theme.active)?.seed);
            addTheme('My theme', fillSeed(from ?? LIGHTS_OUT_SEED));
          }}
        >
          <Plus size={13} /> New theme
        </button>
        <button type="button" className="text-button" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Import theme
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Theme file"
          onChange={(event) => void importTheme(event.target.files?.[0])}
        />
      </div>
      {fileStatus && (
        <p className={`themes-file-status ${fileStatus.error ? 'is-error' : ''}`} role="status">
          {fileStatus.text}
        </p>
      )}

      {previous && (
        <div className="preset-notice" role="status">
          <span>
            <strong>{titleOf(theme.active, theme.saved)}</strong> on.
          </span>
          <button type="button" onClick={undo}>
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

      {editing && (
        <ThemeEditor
          theme={theme}
          onChange={(patch) => {
            setPrevious(null);
            onChange(patch);
          }}
        />
      )}
    </div>
  );
}
