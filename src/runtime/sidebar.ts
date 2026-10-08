import { observe } from './observe';
import type { Disposer, Scope } from './scope';

const PRIMARY = '[data-testid="primaryColumn"]';
const SIDEBAR = '[data-testid="sidebarColumn"]';

/**
 * Something that asks for another look for X's columns: a route change, a layout change, the
 * first post. Called with the function to run; returns how to stop listening.
 */
export type RetryTrigger = (retry: () => void) => Disposer;

/**
 * Publishes whether X is showing its sidebar column as `data-bx-sidebar` on <html> (present when
 * it is, absent when it is not), so CSS can depend on it without a document-wide `:has()`. X adds
 * and removes the column as its window narrows or widens; the column is a sibling of the primary
 * column, so one childList observer on their shared parent sees every change. If X replaces the
 * primary column, or the parent itself, the observers are bound again. Removed with the scope.
 *
 * Until the primary column exists nothing observes the document: a page that never has one (a
 * login flow, a failure page) must not pay for a wait that never ends, and a timeline adds posts
 * far faster than anything else on the page. The `triggers` ask for another look at the moments
 * the column can have appeared instead (the first post, a navigation, a layout change).
 */
export function markSidebar(
  scope: Scope,
  triggers: readonly RetryTrigger[] = [],
  doc: Document = document,
): void {
  const root = doc.documentElement;
  let binding: Scope | null = null;

  const publish = (container: ParentNode) => {
    if (container.querySelector(SIDEBAR)) root.setAttribute('data-bx-sidebar', '');
    else root.removeAttribute('data-bx-sidebar');
  };

  function bind() {
    if (!scope.alive()) return;
    const primary = doc.querySelector(PRIMARY);
    const container = primary?.parentElement;
    if (!primary || !container) {
      // Not there (yet). Observers from an earlier bind stay, so the column coming back to the
      // same parent is seen; anything else is for a trigger to notice.
      root.removeAttribute('data-bx-sidebar');
      return;
    }
    binding?.dispose();
    const own = (binding = scope.child());
    publish(container);
    observe(own, container, { childList: true }, () => {
      if (!primary.isConnected || primary.parentElement !== container) bind();
      else publish(container);
    });
    // If X swaps out the whole container, the observer above is watching a detached node.
    if (container.parentNode)
      observe(own, container.parentNode, { childList: true }, () => {
        if (!container.isConnected) bind();
      });
  }

  for (const trigger of triggers) scope.add(trigger(() => bind()));
  bind();
  scope.add(() => root.removeAttribute('data-bx-sidebar'));
}
