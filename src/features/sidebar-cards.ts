import { SIDEBAR_SECTIONS } from './css';
import type { FeatureContext } from './types';

/** What a card looks for and what climbing must not swallow: other cards, search, the trends. */
const LANDMARKS =
  'aside[role="complementary"], [role="search"], section, [data-testid="news_sidebar"], [data-testid="trend"]';
const MAX_CLIMB = 8;

/**
 * The whole card around something in the sidebar: the outermost ancestor that belongs to that
 * card alone. X draws a card's border, padding and margin on a wrapper, not on the `aside` inside
 * it, so hiding only the `aside` leaves an empty bordered box behind.
 *
 * Climbs from `node` and stops, keeping what it has, when the next ancestor
 * - is the sections container (the element whose children are the sidebar's cards, found the way
 *   Control Panel for Twitter finds it): what it has is a card; or
 * - holds anything else that looks like a card, a search box or the trends: it is shared; or
 * - is the sidebar column itself, or the climb has gone eight levels without finding either.
 *
 * Before climbing out of an element with siblings it also stops, as Control Panel does (a card
 * among cards has siblings). If the result would be a direct child of the column (the structure
 * is not what was expected) it falls back to `node` itself, so a surprise hides too little, never
 * the whole sidebar.
 */
export function climbToCard(node: HTMLElement, column: HTMLElement): HTMLElement {
  let card = node;
  for (let depth = 0; depth < MAX_CLIMB; depth++) {
    const parent = card.parentElement;
    if (!parent || parent === column || !column.contains(parent)) break;
    if (parent.matches(SIDEBAR_SECTIONS)) return card;
    const shared = [...parent.querySelectorAll(LANDMARKS)].some(
      (other) => other !== node && !node.contains(other) && !card.contains(other),
    );
    if (shared) break;
    if (card.nextElementSibling || card.previousElementSibling) break;
    card = parent;
  }
  return card.parentElement === column ? node : card;
}

/** The attribute that marks a card hidden by one feature. */
export const hiddenCardAttribute = (name: string) => `data-bx-hide-${name}`;

/**
 * Builds the `activate` of a feature that hides sidebar cards. `find` returns the elements that
 * identify the cards (an `aside` holding user cells); each one's whole card (`climbToCard`) gets
 * the feature's attribute, and the feature's CSS hides `[data-bx-hide-<name>]`. The attribute is a
 * single cheap selector, where matching the card from inside it would make Chrome re-test every
 * `div` on the page (see `cellWhere` in css.ts).
 *
 * The cards are looked at again, through the shared sidebar service, whenever the sidebar changes
 * (X re-renders it, the trends refresh), and when the route changes; a card that no longer
 * matches is released. Turning the feature off removes every attribute it set.
 */
export function hideSidebarCards(
  name: string,
  find: (column: HTMLElement, context: FeatureContext) => Iterable<HTMLElement>,
) {
  const attribute = hiddenCardAttribute(name);
  return (context: FeatureContext) => {
    const { scope, runtime } = context;
    const marked = new Set<HTMLElement>();

    function scan() {
      const column = runtime.sidebar.column;
      const wanted = new Set<HTMLElement>();
      if (column) for (const node of find(column, context)) wanted.add(climbToCard(node, column));
      for (const card of marked)
        if (!wanted.has(card)) {
          card.removeAttribute(attribute);
          marked.delete(card);
        }
      // A card that carries the mark without being one we set it on (a copy of the markup, an
      // element that was re-parented) is released the same way.
      if (column)
        for (const stray of column.querySelectorAll<HTMLElement>(`[${attribute}]`))
          if (!wanted.has(stray)) stray.removeAttribute(attribute);
      for (const card of wanted)
        if (!marked.has(card)) {
          card.setAttribute(attribute, '');
          marked.add(card);
        }
    }

    scope.add(runtime.sidebar.onChange(scan));
    scope.add(runtime.routes.onRoute(scan));
    scope.add(() => {
      for (const card of marked) card.removeAttribute(attribute);
      marked.clear();
      for (const stray of document.querySelectorAll(`[${attribute}]`))
        stray.removeAttribute(attribute);
    });
  };
}
