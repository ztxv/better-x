import { classifyRoute, type Route, type UrlParts } from '../x/routes';
import type { Disposer, Scope } from './scope';

export interface RouteChange {
  /** The route now on screen. */
  route: Route;
  /** The route that was on screen before it. */
  previous: Route;
  /** The page behind the route: the route itself, or for a modal the page it is shown over. */
  page: Route;
  /** True when this change started a new page (and with it a new `pageScope`). */
  pageChanged: boolean;
}

export type RouteListener = (change: RouteChange) => void;

/** What the service reads from the browser; a test supplies its own. */
export interface RouteEnv {
  /** Read afresh on every check, so it must be the live location. */
  location: UrlParts;
  /** The Navigation API, where present. */
  navigation?: EventTarget | null;
}

export interface RouteService {
  /** The route on screen, which may be a modal over `page`. */
  readonly route: Route;
  /** The page on screen: the latest route that is not a modal overlay. */
  readonly page: Route;
  /**
   * Lives as long as the current page. Disposed, then replaced, when the page changes; not
   * touched when a modal opens or closes over it. A child of the service's own scope.
   */
  readonly pageScope: Scope;
  /** Called after each change of logical route. Not called for the current route. */
  onRoute(listener: RouteListener): Disposer;
  /** Re-reads the location. Signals call this; it only acts when the logical route differs. */
  check(): void;
}

/**
 * Follows X's single-page navigation. X changes route with `history.pushState`, which fires no
 * `popstate` and is invisible to a content script's isolated world as a call, but every history
 * change (push, replace, back, forward) does fire the Navigation API's `currententrychange` on
 * the isolated world's own `window.navigation`. That one signal is enough, and Chrome 102+ has it
 * (the extension requires 116), so there is no polling, no history patching and no use of the
 * page title.
 *
 * A change of URL that is not a change of logical route (hash, tracking parameters, trailing
 * slash, `replaceState` to the same place) notifies no one.
 */
export function createRouteService(scope: Scope, env: RouteEnv = browserEnv()): RouteService {
  let route = classifyRoute(env.location);
  let page = route;
  let pageScope = scope.child();
  const listeners = new Set<RouteListener>();
  scope.add(() => listeners.clear());

  function check() {
    if (!scope.alive()) return;
    const next = classifyRoute(env.location);
    if (next.key === route.key) return;
    const previous = route;
    const pageChanged = !next.modal && next.key !== page.key;
    if (pageChanged) {
      pageScope.dispose();
      pageScope = scope.child();
      page = next;
    }
    route = next;
    const change: RouteChange = { route, previous, page, pageChanged };
    for (const listener of [...listeners]) {
      try {
        listener(change);
      } catch (error) {
        console.error('[Better X] route listener failed', error);
      }
    }
  }

  if (env.navigation) scope.listen(env.navigation, 'currententrychange', check);

  return {
    get route() {
      return route;
    },
    get page() {
      return page;
    },
    get pageScope() {
      return pageScope;
    },
    onRoute(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    check,
  };
}

/** The live window: its location and, in Chrome, its Navigation API. */
export function browserEnv(): RouteEnv {
  return {
    get location() {
      return window.location;
    },
    navigation: (window as unknown as { navigation?: EventTarget }).navigation ?? null,
  };
}
