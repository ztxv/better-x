import { observe } from './observe';
import type { Disposer, Scope } from './scope';

const PRIMARY = '[data-testid="primaryColumn"]';
const SIDEBAR = '[data-testid="sidebarColumn"]';

export interface SidebarService {
  /** X's sidebar column, or null while it is not on the page. */
  readonly column: HTMLElement | null;
  /**
   * Called once now and then (at most once per frame) whenever the column appears, disappears or
   * changes inside, so a feature can look at its cards again. Nothing observes the column while
   * there is no listener.
   */
  onChange(listener: () => void): Disposer;
}

/**
 * Something that asks for another look for X's columns: a route change, a layout change, the
 * first post. Called with the function to run; returns how to stop listening.
 */
export type RetryTrigger = (retry: () => void) => Disposer;

/**

 * Follows X's sidebar column. Publishes whether X is showing it as `data-bx-sidebar` on <html>
 * (present when it is, absent when it is not), so CSS can depend on it without a document-wide `:has()`. X adds
 * and removes the column as its window narrows or widens; the column is a sibling of the primary
 * column, so one childList observer on their shared parent sees every change. If X replaces the
 * primary column, or the parent itself, the observers are bound again. Removed with the scope.
 *
 * Until the primary column exists nothing observes the document: a page that never has one (a
 * login flow, a failure page) must not pay for a wait that never ends, and a timeline adds posts
 * far faster than anything else on the page. The `triggers` ask for another look at the moments
 * the column can have appeared instead (the first post, a navigation, a layout change).
 */
export function createSidebarService(
  scope: Scope,
  triggers: readonly RetryTrigger[] = [],
  doc: Document = document,
): SidebarService {
  const root = doc.documentElement;
  let binding: Scope | null = null;
  let column: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  let watching: Scope | null = null;
  let watched: HTMLElement | null = null;
  let pending: Disposer | null = null;
  scope.add(() => listeners.clear());

  /** One call to each listener per frame, however many changes the sidebar made in it. */
  function notify() {
    if (pending || listeners.size === 0) return;
    pending = scope.requestFrame(() => {
      pending = null;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          console.error('[Better X] sidebar listener failed', error);
        }
      }
    });
  }

  /**
   * Looks inside the column only while someone wants to hear about it, and only at the column
   * that is there now. The column holds a handful of cards that change rarely; the timeline is
   * not inside it.
   */
  function watch() {
    const want = listeners.size > 0 ? column : null;
    if (want === watched) return;
    watching?.dispose();
    watching = null;
    watched = want;
    if (want) {
      watching = scope.child();
      observe(watching, want, { childList: true, subtree: true }, notify);
    }
  }

  const publish = (container: ParentNode) => {
    const next = container.querySelector<HTMLElement>(SIDEBAR);
    if (next) root.setAttribute('data-bx-sidebar', '');
    else root.removeAttribute('data-bx-sidebar');
    if (next !== column) {
      column = next;
      watch();
      notify();
    }
  };

  function bind() {
    if (!scope.alive()) return;
    const primary = doc.querySelector(PRIMARY);
    const container = primary?.parentElement;
    if (!primary || !container) {
      // Not there (yet). Observers from an earlier bind stay, so the column coming back to the
      // same parent is seen; anything else is for a trigger to notice.
      root.removeAttribute('data-bx-sidebar');
      if (column) {
        column = null;
        watch();
        notify();
      }
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

  return {
    get column() {
      return column;
    },
    onChange(listener) {
      listeners.add(listener);
      watch();
      notify();
      return () => {
        listeners.delete(listener);
        watch();
      };
    },
  };
}
