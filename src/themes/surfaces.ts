/**
 * QUARANTINE: the only place in Better X where X's generated class names (`r-…`, `j-…`) may
 * appear. Customization features are forbidden them (`src/features/catalog.test.ts`); themes
 * cannot avoid them, because X paints most surfaces with React Native Web atomic classes. Keeping
 * them here, as data with provenance, means a change on X's side is fixed in one table, and
 * `surfaces.test.ts` keeps the table to colors only.
 *
 * Sources: Dim Mode for Twitter / X (github.com/juanbuis/x-dim-mode, MIT, (c) 2026 Juan Buis) and
 * Control Panel for Twitter (github.com/insin/control-panel-for-twitter, MIT, (c) 2019 Jonny
 * Buchanan); see THIRD_PARTY_NOTICES.md. `inferred` marks a selector built from a stock color
 * value the sources document, not copied from them. Nothing here has been checked on live x.com
 * yet (`verified: 'reference'`); `scripts/theme/probe.js` is how an entry becomes `'live'`.
 *
 * A missing or stale entry must only ever leave a surface in X's own color (a black patch), never
 * text on a background of the same color: color properties take text roles, backgrounds take
 * surface roles (tested).
 */

/** What a rule paints with: a token, or for `keep` entries a fixed value that undoes a broader rule. */
export type Role =
  | 'bg'
  | 'raised'
  | 'hover'
  | 'backdrop'
  | 'border'
  | 'text'
  | 'muted'
  | 'accent'
  | 'scrim'
  /** Tailwind tokens in Chat: the same roles as space-separated HSL components. */
  | 'bg-hsl'
  | 'raised-hsl'
  | 'hover-hsl'
  | 'border-hsl'
  | 'text-hsl'
  | 'muted-hsl';

export type KeepValue = 'transparent' | 'black';

export type AllowedProperty =
  | 'background-color'
  | 'border-color'
  | 'border-top-color'
  | 'border-bottom-color'
  | 'border-left-color'
  | 'border-right-color'
  | 'color'
  | 'fill'
  | 'stroke'
  | 'caret-color'
  | 'scrollbar-color'
  | 'box-shadow'
  | 'outline-color'
  | `--${string}`;

export type SurfaceKind = 'stable' | 'inline-value' | 'rnw-class' | 'tailwind' | 'jetfuel';
export type Source = 'dim-mode' | 'control-panel' | 'fixture' | 'live' | 'inferred';

export interface Surface {
  /** The token painted, or `keep` with `value`. */
  role: Role | 'keep';
  /** Only for `keep`: what the surface is put back to. */
  value?: KeepValue;
  properties: readonly AllowedProperty[];
  kind: SurfaceKind;
  /**
   * Without the `html[data-bx-theme]` prefix, which `css.ts` adds. A selector starting with `&`
   * is attached to `<html>` itself (`&` → `html[data-bx-theme]`).
   */
  selectors: readonly string[];
  from: readonly Source[];
  verified: 'reference' | 'fixture' | 'live';
  /** Only built when Chat theming is on. */
  chat?: true;
  note: string;
}

const COLOR_PROPS = ['color'] as const;
const BG = ['background-color'] as const;

export const SURFACES: readonly Surface[] = [
  // ---------------------------------------------------------------------------------- page
  {
    role: 'bg',
    properties: BG,
    kind: 'stable',
    selectors: ['&', 'body'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'The page itself, behind every column.',
  },
  {
    role: 'text',
    properties: COLOR_PROPS,
    kind: 'stable',
    selectors: ['&', 'body'],
    from: ['inferred'],
    verified: 'reference',
    note: 'Inherited text color; most of X’s text takes it.',
  },
  {
    role: 'bg',
    properties: BG,
    kind: 'inline-value',
    selectors: [
      '[style*="background-color: rgb(0, 0, 0)"]',
      '[style*="background-color: rgba(0, 0, 0, 1)"]',
      '[style*="background-color: rgb(20, 20, 20)"]',
      '[style*="background-color: rgb(5, 5, 5)"]',
    ],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Lights Out black (and high-contrast rgb(5,5,5)) written inline by X.',
  },
  {
    role: 'bg',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-kemksi', '.r-1niwhzg', '.r-yfoy6g', '.r-14lw9ot', '.r-16331v6'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Atomic background classes of columns and headers; r-16331v6 is high-contrast black.',
  },
  {
    role: 'bg',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-cl2sl0'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Modal, composer and dropdown surface. Contested: Dim Mode paints it bg, Control Panel raised. Probe decides.',
  },
  {
    role: 'bg',
    properties: BG,
    kind: 'jetfuel',
    selectors: [
      '.jf-element .j-vdda9x11',
      '[data-testid="sidebarColumn"] .jetfuel-style-root > .jf-element',
    ],
    from: ['control-panel', 'dim-mode'],
    verified: 'reference',
    note: 'Jetfuel surfaces (Today’s News, Creator Studio).',
  },
  // -------------------------------------------------------------------------------- raised
  {
    role: 'raised',
    properties: BG,
    kind: 'inline-value',
    selectors: ['[style*="background-color: rgb(24, 24, 27)"]'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Cards, menus and modals written inline.',
  },
  {
    role: 'raised',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-g2wdr4', '.r-z32n2g', '.r-14tof1o'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Raised card and menu backgrounds.',
  },
  // --------------------------------------------------------------------------------- hover
  {
    role: 'hover',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-1hdo0pc', '.r-g2wdr4 [role="link"]:hover'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Sidebar button hover and links inside raised cards on hover.',
  },
  // ------------------------------------------------------------------------------ backdrop
  {
    role: 'backdrop',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-5zmot'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Translucent sticky headers: the background at 85%, so the blur behind still shows.',
  },
  // -------------------------------------------------------------------------------- border
  {
    role: 'border',
    properties: ['border-color'],
    kind: 'rnw-class',
    selectors: ['.r-1kqtdi0', '.r-1roi411', '.r-dgm4ly'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'All-sides borders; r-dgm4ly is high contrast.',
  },
  {
    role: 'border',
    properties: ['border-top-color'],
    kind: 'rnw-class',
    selectors: ['.r-2sztyj'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Top borders.',
  },
  {
    role: 'border',
    properties: ['border-bottom-color'],
    kind: 'rnw-class',
    selectors: ['.r-1igl3o0', '.r-rull8r'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Bottom borders (between posts).',
  },
  {
    role: 'border',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-gu4em3', '.r-1bnu78o', '.r-1wh73dq'],
    from: ['dim-mode', 'control-panel'],
    verified: 'reference',
    note: 'Dividers and the thread line, drawn as backgrounds; r-1wh73dq is high contrast.',
  },
  {
    role: 'border',
    properties: ['border-color'],
    kind: 'inline-value',
    selectors: ['[style*="border-color: rgb(47, 51, 54)"]'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Borders written inline.',
  },
  {
    role: 'border',
    properties: BG,
    kind: 'inline-value',
    selectors: ['[style*="background-color: rgb(62, 65, 68)"]'],
    from: ['dim-mode', 'inferred'],
    verified: 'reference',
    note: 'Avatar placeholders, toned to the border so they do not glow on a colored page.',
  },
  // --------------------------------------------------------------------------------- muted
  {
    role: 'muted',
    properties: COLOR_PROPS,
    kind: 'inline-value',
    selectors: ['[style*="color: rgb(113, 118, 123)"]'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Secondary text written inline (handles, timestamps, counts).',
  },
  {
    role: 'muted',
    properties: COLOR_PROPS,
    kind: 'rnw-class',
    selectors: ['.r-1bwzh9t'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Secondary text class.',
  },
  {
    role: 'muted',
    properties: COLOR_PROPS,
    kind: 'stable',
    selectors: [
      'input::placeholder',
      'textarea::placeholder',
      '.public-DraftEditorPlaceholder-inner',
    ],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Placeholders, including the composer’s Draft.js one.',
  },
  // ---------------------------------------------------------------------------------- text
  {
    role: 'text',
    properties: COLOR_PROPS,
    kind: 'inline-value',
    selectors: ['[style*="color: rgb(231, 233, 234)"]'],
    from: ['inferred'],
    verified: 'reference',
    note: 'Primary text where X writes it inline instead of inheriting.',
  },
  // --------------------------------------------------------------------------------- scrim
  {
    role: 'scrim',
    properties: BG,
    kind: 'stable',
    selectors: ['[data-testid="mask"]'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'The dimmed layer behind modals.',
  },
  {
    role: 'border',
    properties: ['scrollbar-color'],
    kind: 'stable',
    selectors: ['&'],
    from: ['inferred'],
    verified: 'reference',
    note: 'The page scrollbar thumb in the border tone (track stays the page).',
  },
  // ---------------------------------------------------------------------------------- chat
  {
    role: 'bg-hsl',
    properties: ['--background', '--color-background', '--color-gray-0'],
    kind: 'tailwind',
    selectors: ['&[data-theme="dark"]', '[data-theme="dark"]'],
    from: ['control-panel'],
    verified: 'reference',
    chat: true,
    note: 'Chat’s Tailwind tokens (space-separated HSL components).',
  },
  {
    role: 'raised-hsl',
    properties: ['--color-gray-50'],
    kind: 'tailwind',
    selectors: ['&[data-theme="dark"]', '[data-theme="dark"]'],
    from: ['control-panel'],
    verified: 'reference',
    chat: true,
    note: 'Chat raised surfaces.',
  },
  {
    role: 'border-hsl',
    properties: ['--border', '--input', '--color-gray-100'],
    kind: 'tailwind',
    selectors: ['&[data-theme="dark"]', '[data-theme="dark"]'],
    from: ['control-panel'],
    verified: 'reference',
    chat: true,
    note: 'Chat borders and inputs.',
  },
  {
    role: 'muted-hsl',
    properties: ['--muted-foreground', '--color-gray-700'],
    kind: 'tailwind',
    selectors: ['&[data-theme="dark"]', '[data-theme="dark"]'],
    from: ['control-panel'],
    verified: 'reference',
    chat: true,
    note: 'Chat secondary text.',
  },
  {
    role: 'bg',
    properties: BG,
    kind: 'tailwind',
    selectors: [
      '[data-testid="chat-drawer-root"]',
      '[data-testid="chat-drawer-main"]',
      '.bg-background',
      '.bg-gray-0',
    ],
    from: ['control-panel', 'dim-mode'],
    verified: 'reference',
    chat: true,
    note: 'Chat drawer and its Tailwind background utilities.',
  },
  // ---------------------------------------------------------------------------------- keep
  // Last, so they win over the broader rules above (they are also more specific).
  {
    role: 'keep',
    value: 'transparent',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-1niwhzg.r-633pao', '.r-1niwhzg.r-sdzlij'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Image crop selection and icon hover circles must stay see-through.',
  },
  {
    role: 'keep',
    value: 'black',
    properties: BG,
    kind: 'rnw-class',
    selectors: ['.r-kemksi.r-16cnnyw.r-rs99b7:has(img)'],
    from: ['dim-mode'],
    verified: 'reference',
    note: 'Premium promo hero cards: their image has black baked in.',
  },
];
