import { Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Settings, SettingsPatch } from '../lib/settings';
import { deriveTokens } from '../themes/derive';
import { XMODE_CACHE_KEY } from '../themes/host';
import { CUSTOM_THEME_ID, LIGHTS_OUT_SEED, PRESETS } from '../themes/presets';
import type { XMode } from '../themes/types';
import { ThemeCard } from './ThemeCard';
import { ThemeEditor } from './ThemeEditor';
import { Toggle } from './Toggle';

const LIGHTS_OUT = deriveTokens(LIGHTS_OUT_SEED);
const PRESET_TOKENS = new Map(PRESETS.map((preset) => [preset.id, deriveTokens(preset.seed)]));

const titleOf = (id: string | null) =>
  id === null
    ? 'Lights out'
    : id === CUSTOM_THEME_ID
      ? 'Custom'
      : (PRESETS.find((p) => p.id === id)?.title ?? id);

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
 * every X tab at once), the Custom editor when Custom is chosen, Undo after a switch, and the
 * experimental Chat switch. It only reads and writes `xTheme`.
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
      {theme.active !== null && mode === 'light' && (
        <p className="themes-paused" role="status">
          X is in Default (light) right now, so {titleOf(theme.active)} is paused. It comes back
          when X is in Lights out.
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
      </div>

      {previous && (
        <div className="preset-notice" role="status">
          <span>
            <strong>{titleOf(theme.active)}</strong> on.
          </span>
          <button type="button" onClick={undo}>
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

      {theme.active === CUSTOM_THEME_ID && (
        <ThemeEditor
          theme={theme}
          onChange={(patch) => {
            setPrevious(null);
            onChange(patch);
          }}
        />
      )}

      <div className="themes-chat">
        <Toggle
          label="Also theme Chat (experimental)"
          hint="Chat is partly built where page styles cannot reach, so some of it may stay black."
          checked={theme.chat}
          onChange={(value) => onChange({ xTheme: { chat: value } })}
        />
      </div>
    </div>
  );
}
