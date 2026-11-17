/**
 * The plugins Better X ships, as data both sides share: the Plugins tab draws a card for each,
 * and the content script's host (`./host.ts`) runs the ones that are on. A plugin is a larger,
 * self-contained addition to X (its own UI, possibly its own account connection), where a
 * customization feature (`src/features`) is a switch that restyles or hides what X already has.
 * Ids are stored: never rename one.
 */
export interface PluginInfo {
  id: string;
  title: string;
  description: string;
  /** Whether the Plugins tab has a settings panel for it. */
  hasSettings: boolean;
}

export const SPOTIFY_PLUGIN_ID = 'spotify';

export const PLUGINS: readonly PluginInfo[] = [
  {
    id: SPOTIFY_PLUGIN_ID,
    title: 'SpotifyControls',
    description: 'Adds a Spotify player above the account switcher on X.',
    hasSettings: true,
  },
];
