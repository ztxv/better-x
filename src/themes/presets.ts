import type { ThemeDef, ThemeSeed } from './types';

/**
 * Preset X themes. Ids are stored in settings and backups: never rename or reuse one.
 * Provenance: Dim is Twitter's classic Dim as Control Panel for Twitter ships it (MIT); Nord,
 * Dracula, Catppuccin Mocha, Rosé Pine, Tokyo Night, Gruvbox and Solarized are those projects'
 * public palettes; Graphite, Midnight, Forest and Ember are Better X's own. Where a preset leaves
 * a color out (`hover`, sometimes `muted`), `deriveTokens` works it out.
 */
export const PRESETS: readonly ThemeDef[] = [
  {
    id: 'dim',
    title: 'Dim',
    description: "Twitter's classic blue-gray Dim",
    base: 'dark',
    seed: {
      bg: '#15202b',
      raised: '#28323d',
      border: '#38444d',
      text: '#f7f9f9',
      muted: '#8b98a5',
      accent: '#1d9bf0',
    },
  },
  {
    id: 'graphite',
    title: 'Graphite',
    description: 'Soft charcoal instead of pure black',
    base: 'dark',
    seed: {
      bg: '#121212',
      raised: '#1e1e1e',
      border: '#2c2c2c',
      text: '#ececec',
      muted: '#9a9a9a',
      accent: '#1d9bf0',
    },
  },
  {
    id: 'midnight',
    title: 'Midnight',
    description: 'Deep navy with a periwinkle accent',
    base: 'dark',
    seed: {
      bg: '#0b1020',
      raised: '#151b30',
      border: '#232b45',
      text: '#e6e9f5',
      muted: '#8b93b0',
      accent: '#6c8cff',
    },
  },
  {
    id: 'nord',
    title: 'Nord',
    description: 'Arctic, north-bluish calm',
    base: 'dark',
    seed: {
      bg: '#2e3440',
      raised: '#3b4252',
      border: '#434c5e',
      text: '#eceff4',
      accent: '#88c0d0',
    },
  },
  {
    id: 'dracula',
    title: 'Dracula',
    description: 'The dark theme for vampires',
    base: 'dark',
    seed: {
      bg: '#282a36',
      raised: '#343746',
      border: '#44475a',
      text: '#f8f8f2',
      accent: '#bd93f9',
    },
  },
  {
    id: 'mocha',
    title: 'Catppuccin Mocha',
    description: 'Soothing pastels on a warm dark base',
    base: 'dark',
    seed: {
      bg: '#1e1e2e',
      raised: '#313244',
      border: '#45475a',
      text: '#cdd6f4',
      muted: '#a6adc8',
      accent: '#cba6f7',
    },
  },
  {
    id: 'rosepine',
    title: 'Rosé Pine',
    description: 'Muted purples, all natural pine',
    base: 'dark',
    seed: {
      bg: '#191724',
      raised: '#26233a',
      border: '#403d52',
      text: '#e0def4',
      muted: '#908caa',
      accent: '#c4a7e7',
    },
  },
  {
    id: 'tokyo',
    title: 'Tokyo Night',
    description: 'Neon city lights after dark',
    base: 'dark',
    seed: {
      bg: '#1a1b26',
      raised: '#292e42',
      border: '#3b4261',
      text: '#c0caf5',
      muted: '#9aa5ce',
      accent: '#7aa2f7',
    },
  },
  {
    id: 'gruvbox',
    title: 'Gruvbox',
    description: 'Retro groove, warm and earthy',
    base: 'dark',
    seed: {
      bg: '#282828',
      raised: '#3c3836',
      border: '#504945',
      text: '#ebdbb2',
      muted: '#a89984',
      accent: '#fabd2f',
    },
  },
  {
    id: 'solarized',
    title: 'Solarized Dark',
    description: 'Precision colors for machines and people',
    base: 'dark',
    seed: {
      bg: '#002b36',
      raised: '#073642',
      border: '#12414d',
      text: '#93a1a1',
      accent: '#268bd2',
    },
  },
  {
    id: 'forest',
    title: 'Forest',
    description: 'Deep green with a bright leaf accent',
    base: 'dark',
    seed: {
      bg: '#0f1a14',
      raised: '#182820',
      border: '#254033',
      text: '#e4f0e8',
      muted: '#8fb09b',
      accent: '#3ddc84',
    },
  },
  {
    id: 'ember',
    title: 'Ember',
    description: 'Warm coal with an orange glow',
    base: 'dark',
    seed: {
      bg: '#1a1210',
      raised: '#2a1d19',
      border: '#43302a',
      text: '#f5e9e4',
      muted: '#b99a8f',
      accent: '#ff8a3d',
    },
  },
];

/** The id of the person's own palette (`settings.xTheme.custom`). */
export const CUSTOM_THEME_ID = 'custom';

/**
 * X's stock Lights Out colors as Control Panel for Twitter documents them: where the Custom theme
 * starts, so a fresh Custom looks like X.
 */
export const LIGHTS_OUT_SEED: Required<ThemeSeed> = {
  bg: '#000000',
  raised: '#202327',
  hover: '#16181c',
  border: '#2f3336',
  text: '#e7e9ea',
  muted: '#71767b',
  accent: '#1d9bf0',
};

const BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));
export const isPresetId = (id: string) => BY_ID.has(id);
export const presetById = (id: string): ThemeDef | undefined => BY_ID.get(id);
