import { createLayoutService } from '../src/runtime/layout';
import { createPostStream } from '../src/runtime/posts';
import { createRouteService } from '../src/runtime/route';
import { Scope } from '../src/runtime/scope';
import { startSaved } from '../src/saved';
import '../src/content/styles.css';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    // Everything this script keeps running is owned by this scope, released when WXT invalidates
    // the context. WXT announces that only when a newer copy of the script starts; after an
    // extension reload nothing does, so the scope also checks `ctx.isValid` (which disposes it
    // through `onInvalidated`) each time the observer delivers a change.
    const scope = new Scope(() => ctx.isValid);
    ctx.onInvalidated(() => scope.dispose());

    const posts = createPostStream(scope);
    startSaved(scope, posts);

    // The runtime's view of where X is, mirrored as an attribute on <html> so it can be read (and
    // later styled) from the page: <html data-bx-route="profile">. Nothing else consumes it yet.
    const routes = createRouteService(scope);
    const publishRoute = () =>
      document.documentElement.setAttribute('data-bx-route', routes.route.id);
    publishRoute();
    scope.add(routes.onRoute(publishRoute));
    scope.add(() => document.documentElement.removeAttribute('data-bx-route'));
    // Likewise X's wide/narrow layout (narrow when its window is, e.g. beside the side panel):
    // <html data-bx-layout="narrow">, absent until X's app wrapper has rendered.
    const layout = createLayoutService(scope);
    const publishLayout = () => {
      const root = document.documentElement;
      if (layout.layout) root.setAttribute('data-bx-layout', layout.layout);
      else root.removeAttribute('data-bx-layout');
    };
    publishLayout();
    scope.add(layout.onLayout(publishLayout));
    scope.add(() => document.documentElement.removeAttribute('data-bx-layout'));
  },
});
