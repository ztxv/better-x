import { observe } from './observe';
import type { Scope } from './scope';
import { waitFor } from './wait';

const PRIMARY = '[data-testid="primaryColumn"]';
const SIDEBAR = '[data-testid="sidebarColumn"]';

/**
 * Publishes whether X is showing its sidebar column as `data-bx-sidebar` on <html> (present when
 * it is, absent when it is not), so CSS can depend on it without a document-wide `:has()`. X adds
 * and removes the column as its window narrows or widens; the column is a sibling of the primary
 * column, so one childList observer on their shared parent sees every change. If X replaces the
 * primary column, or the parent itself, the observers are bound again. Removed with the scope.
 */
export function markSidebar(scope: Scope, doc: Document = document): void {
  const root = doc.documentElement;
  let binding: Scope | null = null;

  const publish = (container: ParentNode) => {
    if (container.querySelector(SIDEBAR)) root.setAttribute('data-bx-sidebar', '');
    else root.removeAttribute('data-bx-sidebar');
  };

  function bind() {
    binding?.dispose();
    if (!scope.alive()) return;
    const own = (binding = scope.child());
    const primary = doc.querySelector(PRIMARY);
    const container = primary?.parentElement;
    if (!primary || !container) {
      root.removeAttribute('data-bx-sidebar');
      waitFor(PRIMARY, { signal: own.signal, root: doc, attributes: false }).then(bind, () => {});
      return;
    }
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

  bind();
  scope.add(() => root.removeAttribute('data-bx-sidebar'));
}
