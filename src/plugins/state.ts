/**
 * Which plugins are on, and each plugin's own (non-secret) options. Kept under its own key, not
 * in `bx.settings`, so plugins can be added without touching the settings schema or its backups;
 * every context reads the same object and hears changes live, as with settings. Credentials are
 * never here (Spotify's tokens live under `bx.spotify.auth`).
 */
import { PLUGINS } from './catalog';

export const PLUGINS_KEY = 'bx.plugins';
/** A note from the X page asking the panel to show a section (`plugins`); the panel removes it. */
export const OPEN_SECTION_KEY = 'bx.openSection';

export interface PluginState {
  /** Plugin id to on/off, only for plugins the person has switched. Missing means off. */
  enabled: Record<string, boolean>;
  spotify: {
    /** The person's own Spotify app's Client ID (public by design), or '' until they enter one. */
    clientId: string;
  };
}

export const DEFAULT_PLUGIN_STATE: PluginState = { enabled: {}, spotify: { clientId: '' } };

export const SPOTIFY_CLIENT_ID = /^[0-9a-f]{32}$/;
/** A Client ID as typed (spaces and capitals forgiven), or '' when it is not one. */
export const parseClientId = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SPOTIFY_CLIENT_ID.test(text) ? text : '';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizePluginState(input: unknown): PluginState {
  const value = isRecord(input) ? input : {};
  const stored = isRecord(value.enabled) ? value.enabled : {};
  const enabled: Record<string, boolean> = {};
  for (const plugin of PLUGINS)
    if (typeof stored[plugin.id] === 'boolean') enabled[plugin.id] = stored[plugin.id] as boolean;
  const spotify = isRecord(value.spotify) ? value.spotify : {};
  return { enabled, spotify: { clientId: parseClientId(spotify.clientId) } };
}

export const pluginEnabled = (state: PluginState, id: string) => state.enabled[id] === true;

export async function loadPluginState(): Promise<PluginState> {
  try {
    const stored = await chrome.storage.local.get(PLUGINS_KEY);
    return normalizePluginState(stored[PLUGINS_KEY]);
  } catch {
    return DEFAULT_PLUGIN_STATE;
  }
}

let writes: Promise<unknown> = Promise.resolve();

/** Read, change, write, one at a time (as `saveSettings` does), so two quick changes both land. */
export function updatePluginState(
  change: (current: PluginState) => PluginState,
): Promise<PluginState> {
  const write = writes.then(async () => {
    const next = normalizePluginState(change(await loadPluginState()));
    await chrome.storage.local.set({ [PLUGINS_KEY]: next });
    return next;
  });
  writes = write.catch(() => {});
  return write;
}

export const setPluginEnabled = (id: string, on: boolean) =>
  updatePluginState((state) => ({ ...state, enabled: { ...state.enabled, [id]: on } }));

/** Calls `listener` whenever any context changes plugin state. Returns an unsubscribe function. */
export function watchPluginState(listener: (state: PluginState) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[PLUGINS_KEY])
      listener(normalizePluginState(changes[PLUGINS_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
