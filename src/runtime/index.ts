import { createActionRow, type ActionRowService } from './action-row';
import { createLayoutService, type LayoutService } from './layout';
import { createPostStream, type PostStream } from './posts';
import { createRouteService, type RouteService } from './route';
import type { Scope } from './scope';

/** The services every Better X feature builds on. */
export interface Runtime {
  posts: PostStream;
  actionRow: ActionRowService;
  routes: RouteService;
  layout: LayoutService;
}

/**
 * Starts the shared runtime on `scope`: post discovery, the action row, routes and layout.
 * Route and layout are also mirrored on <html> so they can be read, and later styled, from the
 * page: `data-bx-route="profile"` and `data-bx-layout="narrow"` (absent until X's app wrapper
 * has rendered). They are removed when the scope ends.
 */
export function startRuntime(scope: Scope): Runtime {
  const posts = createPostStream(scope);
  const actionRow = createActionRow(scope, posts);
  const routes = createRouteService(scope);
  const layout = createLayoutService(scope);

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

  return { posts, actionRow, routes, layout };
}
