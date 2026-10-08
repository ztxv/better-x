/**
 * Small helpers for writing feature CSS. A feature is a few selectors and a declaration; these
 * keep the declaration identical everywhere and keep long selector lists readable.
 */

/** Hides every element the selectors match. `!important` because X's own styles set `display`. */
export function hide(...selectors: Array<string | readonly string[]>): string {
  return `${selectors.flat().join(',\n')} {\n  display: none !important;\n}`;
}

/** Applies declarations to every element the selectors match. */
export function rule(selectors: string | readonly string[], declarations: string): string {
  return `${[selectors].flat().join(',\n')} {\n  ${declarations}\n}`;
}

/** Applies `scope` in front of each selector: `html[data-bx-route="home"] ...`. */
export const within = (scope: string, selectors: string | readonly string[]): string[] =>
  [selectors].flat().map((selector) => `${scope} ${selector}`);

/** `<html data-bx-route>` scope for one route id. */
export const onRoute = (...routes: string[]) =>
  routes.length === 1
    ? `html[data-bx-route="${routes[0]}"]`
    : `html:is(${routes.map((route) => `[data-bx-route="${route}"]`).join(', ')})`;

/** Where X draws its primary navigation: the side nav, or the bottom bar in the narrow layout. */
export const PRIMARY_NAV = ':is(header[role="banner"] nav, #layers nav)';
const MENU = '[role="menu"]';
/** The desktop "More" dialog. */
const MORE = '[aria-labelledby="modal-header"]';

/**
 * Every place X can link to somewhere: the primary navigation, popup menus, the narrow layout's
 * menu dialog (a dialog, but only in the narrow layout) and the More dialog. `match` is the
 * attribute selector on the link, for example `[href="/jobs"]`. `rootAttributes` narrows every
 * selector to pages where `<html>` has them, for example `[data-bx-sidebar]`. Features that must
 * not touch an in-page tab bar use these, never a bare `nav`.
 */
export const links = (match: string, rootAttributes = ''): string[] => [
  `html${rootAttributes} ${PRIMARY_NAV} a${match}`,
  `html${rootAttributes} ${MENU} a${match}`,
  `html[data-bx-layout="narrow"]${rootAttributes} [role="dialog"] a${match}`,
  `html${rootAttributes} ${MORE} a${match}`,
];

/** The links in the primary navigation only. */
export const navLinks = (match: string): string[] => [`${PRIMARY_NAV} a${match}`];

export const PRIMARY_COLUMN = '[data-testid="primaryColumn"]';
export const SIDEBAR = '[data-testid="sidebarColumn"]';
/** The container whose children are the sidebar's sections (search, trends, who to follow ...). */
export const SIDEBAR_SECTIONS = `${SIDEBAR} > div > div > div > div > div`;
/** One cell of a timeline's virtualized list; X positions the cell, so features hide its child. */
export const CELL = '[data-testid="cellInnerDiv"]';
export const POST = '[data-testid="tweet"]';
