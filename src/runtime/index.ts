import { createAccountsRuntime, type AccountsDeps, type AccountsRuntime } from './accounts';
import { createActionRow, type ActionRowService } from './action-row';
import { createLayoutService, type LayoutService } from './layout';
import { createPostStream, type PostStream } from './posts';
import { createRouteService, type RouteService } from './route';
import { createSidebarService, type SidebarService } from './sidebar';
import type { Disposer, Scope } from './scope';

/** The services every Better X feature builds on. */
export interface Runtime {
  /** The scope the whole runtime lives in; for services shared by several features. */
  scope: Scope;
  posts: PostStream;
  actionRow: ActionRowService;
  routes: RouteService;
  layout: LayoutService;
  sidebar: SidebarService;
  /** Account data for the accounts whose posts are on the page; see `./accounts`. */
  accounts: AccountsRuntime;
}

/**
 * Starts the shared runtime on `scope`: post discovery, the action row, routes and layout.
 * Route, layout and sidebar presence are also mirrored on <html> so they can be read, and styled,
 * from the page: `data-bx-route="profile"`, `data-bx-layout="narrow"` (absent until X's app
 * wrapper has rendered) and `data-bx-sidebar` (present while X shows its sidebar column). They
 * are removed when the scope ends.
 */
export function startRuntime(scope: Scope, deps: { accounts?: AccountsDeps } = {}): Runtime {
  const posts = createPostStream(scope);
  const actionRow = createActionRow(scope, posts);
  const routes = createRouteService(scope);
  const layout = createLayoutService(scope);
  // The sidebar marker looks again at the moments X's columns can have appeared.
  const sidebar = createSidebarService(scope, [
    (retry) => routes.onRoute(retry),
    (retry) => layout.onLayout(retry),
    (retry) => {
      // One look when the first post shows up (the column exists by then), not one per post.
      let stop: Disposer = () => {};
      stop = posts.onPost(() => {
        stop();
        retry();
      });
      return () => stop();
    },
  ]);

  const accounts = createAccountsRuntime(scope, posts, deps.accounts);

  const root = document.documentElement;
  const publishRoute = () => root.setAttribute('data-bx-route', routes.route.id);
  const publishLayout = () => {
    if (layout.layout) root.setAttribute('data-bx-layout', layout.layout);
    else root.removeAttribute('data-bx-layout');
  };
  publishRoute();
  publishLayout();
  scope.add(routes.onRoute(publishRoute));
  scope.add(layout.onLayout(publishLayout));
  scope.add(() => {
    root.removeAttribute('data-bx-route');
    root.removeAttribute('data-bx-layout');
  });

  return { scope, posts, actionRow, routes, layout, sidebar, accounts };
}
