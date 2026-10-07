import { observe } from './observe';
import type { Disposer, Scope } from './scope';
import { waitFor } from './wait';

/**
 * Which of X's two page layouts is showing. `wide` is the desktop layout (navigation beside the
 * timeline); `narrow` is the mobile layout (navigation along the bottom), which X switches to
 * whenever its window is narrow, including when the browser's side panel is opened.
 */
export type Layout = 'wide' | 'narrow';

export type LayoutListener = (layout: Layout, previous: Layout | null) => void;

export interface LayoutService {
  /** The layout on screen, or null until X's app wrapper has been found. */
  readonly layout: Layout | null;
  /** Called after each actual change of layout, including the first detection. */
  onLayout(listener: LayoutListener): Disposer;
}

/**
 * Reads the layout from X's own DOM rather than from the window width: the element after
 * `#layers` wraps the whole app, and X lays it out as a column in the narrow layout and a row
 * in the wide one. (The same signal Control Panel for Twitter uses.) X re-renders the wrapper
 * with different classes when it switches, so a `class` observer on that one element is enough;
 * it is rebound if X replaces the wrapper, and found by waiting if it is not there yet.
 */
export function createLayoutService(
  scope: Scope,
  doc: Document = document,
  computedStyle: (element: Element) => CSSStyleDeclaration = (element) => getComputedStyle(element),
): LayoutService {
  let layout: Layout | null = null;
  let binding: Scope | null = null;
  const listeners = new Set<LayoutListener>();
  scope.add(() => listeners.clear());

  /** `#layers + div`, without a selector scan. */
  const appWrapper = () => {
    const next = doc.getElementById('layers')?.nextElementSibling;
    return next instanceof HTMLElement ? next : null;
  };

  function update(wrapper: HTMLElement) {
    const next: Layout = computedStyle(wrapper).flexDirection === 'column' ? 'narrow' : 'wide';
    if (next === layout) return;
    const previous = layout;
    layout = next;
    for (const listener of [...listeners]) {
      try {
        listener(next, previous);
      } catch (error) {
        console.error('[Better X] layout listener failed', error);
      }
    }
  }

  function bind() {
    binding?.dispose();
    if (!scope.alive()) return;
    const own = (binding = scope.child());
    const wrapper = appWrapper();
    if (!wrapper) {
      // Not rendered yet, or replaced and not back yet. Additions are all that can bring it.
      waitFor(appWrapper, { signal: own.signal, root: doc, attributes: false }).then(
        bind,
        () => {},
      );
      return;
    }
    update(wrapper);
    observe(own, wrapper, { attributes: true, attributeFilter: ['class'] }, () => update(wrapper));
    // If X swaps the wrapper (or `#layers` before it) the old one stops meaning anything.
    if (wrapper.parentNode)
      observe(own, wrapper.parentNode, { childList: true }, () => {
        if (appWrapper() !== wrapper) bind();
      });
  }

  bind();

  return {
    get layout() {
      return layout;
    },
    onLayout(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
