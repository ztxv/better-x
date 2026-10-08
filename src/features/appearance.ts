/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import { onRoute, PRIMARY_COLUMN, rule, SIDEBAR, SIDEBAR_SECTIONS } from './css';
import { definitions } from './define';
import type { SliderFeature, ToggleFeature } from './types';

const { toggle, slider } = definitions('appearance');

const NAV = 'header[role="banner"] nav';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Layout and type adjustments. Each is a handful of declarations that exist only while its
 * switch is on, and a slider's number goes straight into them (after the registry has clamped it
 * to the slider's range), so moving a slider restyles X live and turning it off removes every
 * trace. Widths follow Control Panel's full-width rules, which only act on the pages where they
 * are known to hold up (Home, lists and communities).
 */
export const APPEARANCE_FEATURES: ReadonlyArray<ToggleFeature | SliderFeature> = [
  slider(
    'timelineWidth',
    'Timeline width',
    'How wide the timeline can grow on Home, lists and communities. X’s own width is 600.',
    { min: 500, max: 1000, step: 10, defaultValue: 700, unit: 'px' },
    (width) =>
      rule(
        [
          `${onRoute('home', 'list', 'community')} ${PRIMARY_COLUMN}`,
          `${onRoute('home', 'list', 'community')} ${PRIMARY_COLUMN} > div:first-child > div:last-child`,
        ],
        `max-width: ${width}px;`,
      ),
    ['width', 'wide', 'narrow', 'column'],
  ),
  slider(
    'sidebarWidth',
    'Sidebar width',
    'How wide the sidebar is. X’s own width is 350.',
    { min: 250, max: 450, step: 10, defaultValue: 350, unit: 'px' },
    (width) =>
      rule(
        [SIDEBAR, `${SIDEBAR} > div > div`, `${SIDEBAR_SECTIONS} > div:first-child`],
        `width: ${width}px !important;`,
      ),
    ['width', 'column'],
  ),
  slider(
    'navSpacing',
    'Menu spacing',
    'How much room each item in the side menu gets.',
    { min: 0, max: 12, step: 1, defaultValue: 6, unit: 'px' },
    (padding) =>
      [
        rule(
          [`${NAV} > a`, `${NAV} > div[data-testid="AppTabBar_More_Menu"]`],
          'padding-top: 0 !important;\n  padding-bottom: 0 !important;',
        ),
        rule(
          [`${NAV} > a > div`, `${NAV} > div[data-testid="AppTabBar_More_Menu"] > div`],
          `padding-top: ${padding}px !important;\n  padding-bottom: ${padding}px !important;`,
        ),
      ].join('\n'),
    ['density', 'compact', 'padding'],
  ),
  slider(
    'navTextSize',
    'Menu text size',
    'The size of the labels in the side menu, in regular weight. X’s own size is 20.',
    { min: 12, max: 20, step: 1, defaultValue: 15, unit: 'px' },
    (size) =>
      rule(
        [`${NAV} div[dir]:not([aria-live]) span`, `${NAV} span[style] > span`],
        `font-size: ${size}px !important;\n  font-weight: normal !important;`,
      ),
    ['font', 'labels'],
  ),
  slider(
    'postTextSize',
    'Post text size',
    'The size of the text in posts. X’s own size is 15.',
    { min: 13, max: 22, step: 1, defaultValue: 16, unit: 'px' },
    (size) =>
      rule(
        ['div[data-testid="tweetText"]', 'div[data-testid="tweetText"] span'],
        `font-size: ${size}px !important;\n  line-height: 1.35 !important;`,
      ),
    ['font', 'type', 'reading'],
  ),
  toggle(
    'systemFont',
    'Use the system font',
    'Show X in your computer’s own font instead of X’s Chirp.',
    rule(['body', 'body *'], `font-family: ${FONT} !important;`),
    ['chirp', 'typeface'],
  ),
  toggle(
    'lighterMenuText',
    'Lighter menu text',
    'Show the items in X’s popup menus in regular weight instead of bold.',
    rule(
      [
        '[data-testid="Dropdown"] [role="menuitem"] [dir]',
        '[data-testid="sheetDialog"] [role="menuitem"] [dir]',
      ],
      'font-weight: normal;',
    ),
    ['bold', 'weight'],
  ),
];
