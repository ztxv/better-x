import { Settings as Gear } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLUGINS, SPOTIFY_PLUGIN_ID, type PluginInfo } from '../plugins/catalog';
import {
  DEFAULT_PLUGIN_STATE,
  loadPluginState,
  pluginEnabled,
  setPluginEnabled,
  watchPluginState,
  type PluginState,
} from '../plugins/state';
import { SpotifySettings } from './SpotifySettings';

/** Plugin state from storage, kept up to date as any context changes it. */
export function usePluginState(): PluginState {
  const [state, setState] = useState(DEFAULT_PLUGIN_STATE);
  useEffect(() => {
    let live = true;
    void loadPluginState().then((loaded) => {
      if (live) setState(loaded);
    });
    const stop = watchPluginState(setState);
    return () => {
      live = false;
      stop();
    };
  }, []);
  return state;
}

/** Each plugin's settings panel, by id. A plugin without one has no gear. */
function PluginSettings({ plugin, state }: { plugin: PluginInfo; state: PluginState }) {
  if (plugin.id === SPOTIFY_PLUGIN_ID) return <SpotifySettings state={state} />;
  return null;
}

/**
 * The Plugins tab: one card per plugin in `src/plugins/catalog.ts`, with its name, what it does,
 * a gear that opens its settings in place, and a switch. A switch writes `bx.plugins`, which
 * every open X tab follows at once: the plugin's UI appears or is removed without a reload.
 */
export function Plugins({ hidden = false }: { hidden?: boolean }) {
  const state = usePluginState();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div
      className="plugins"
      id="plugins-panel"
      role="tabpanel"
      aria-labelledby="plugins-tab"
      hidden={hidden}
    >
      <h2 className="themes-title">Plugins</h2>
      <p className="customize-summary">
        Bigger additions to X. Each is off until you switch it on, and is removed from the page the
        moment you switch it off.
      </p>
      {PLUGINS.map((plugin) => {
        const on = pluginEnabled(state, plugin.id);
        const expanded = open === plugin.id;
        return (
          <article className="plugin-card" key={plugin.id} data-plugin={plugin.id}>
            <div className="plugin-head">
              <strong id={`plugin-${plugin.id}-title`}>{plugin.title}</strong>
              {plugin.hasSettings && (
                <button
                  type="button"
                  className="icon-button plugin-gear"
                  aria-label={`${plugin.title} settings`}
                  title="Settings"
                  aria-expanded={expanded}
                  aria-controls={`plugin-${plugin.id}-settings`}
                  onClick={() => setOpen(expanded ? null : plugin.id)}
                >
                  <Gear size={16} />
                </button>
              )}
              <label className="setting-toggle plugin-switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby={`plugin-${plugin.id}-title`}
                  checked={on}
                  onChange={(event) => {
                    void setPluginEnabled(plugin.id, event.target.checked);
                    // Switching on something that still needs setting up shows how.
                    if (event.target.checked && plugin.hasSettings) setOpen(plugin.id);
                  }}
                />
              </label>
            </div>
            <p className="plugin-description">{plugin.description}</p>
            {plugin.hasSettings && (
              <div
                id={`plugin-${plugin.id}-settings`}
                className="plugin-settings"
                hidden={!expanded}
              >
                {expanded && <PluginSettings plugin={plugin} state={state} />}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
