import { observe } from '../runtime/observe';
import type { Scope } from '../runtime/scope';
import type { XMode } from './types';

/**
 * X's display mode, from the strongest signal present: `<html data-theme>` (X's current signal),
 * then the root's `color-scheme`, then `<body>`'s inline background as Control Panel for Twitter
 * reads it (white is Default; black, or rgb(5, 5, 5) in high contrast, is Lights out). Null when
 * none is set yet (early in the page load): the caller then uses the last mode it saw.
 */
export function xMode(doc: Document = document): XMode | null {
  const root = doc.documentElement;
  const attribute = root.getAttribute('data-theme');
  if (attribute === 'dark' || attribute === 'light') return attribute;
  const scheme = root.style.colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme;
  const background = doc.body?.style.backgroundColor;
  if (background === 'rgb(255, 255, 255)') return 'light';
  if (background === 'rgb(0, 0, 0)' || background === 'rgb(5, 5, 5)') return 'dark';
  return null;
}

/**
 * Calls `listener` with X's mode whenever it changes (not when it is unknown). Two small focused
 * observers owned by `scope`: one on `<html>` (`data-theme`, `style`, and, only until `<body>`
 * exists, its children), and one on `<body>` (`style`, `class`) once it does.
 */
export function watchXMode(
  scope: Scope,
  listener: (mode: XMode) => void,
  doc: Document = document,
): void {
  let last = xMode(doc);
  const check = () => {
    const mode = xMode(doc);
    if (mode && mode !== last) {
      last = mode;
      listener(mode);
    }
  };
  const root = doc.documentElement;
  observe(scope, root, { attributes: true, attributeFilter: ['data-theme', 'style'] }, check);

  const watchBody = (body: HTMLElement) =>
    observe(scope, body, { attributes: true, attributeFilter: ['style', 'class'] }, check);
  if (doc.body) {
    watchBody(doc.body);
    return;
  }
  const untilBody = scope.child();
  observe(untilBody, root, { childList: true }, () => {
    if (!doc.body) return;
    untilBody.dispose();
    watchBody(doc.body);
    check();
  });
}
