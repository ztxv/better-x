// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createRouteService, type RouteChange, type RouteEnv } from './route';
import { Scope } from './scope';

/** A location the test moves, and a Navigation API it fires, like X's history changes would. */
function setup(start = '/home') {
  const navigation = new EventTarget();
  const location = { pathname: start, search: '' };
  const env: RouteEnv = { location, navigation };
  const go = (url: string) => {
    const [pathname = '/', search = ''] = url.split('?');
    location.pathname = pathname;
    location.search = search ? `?${search}` : '';
    navigation.dispatchEvent(new Event('currententrychange'));
  };
  const root = new Scope();
  const service = createRouteService(root, env);
  const changes: RouteChange[] = [];
  service.onRoute((change) => changes.push(change));
  return { root, service, go, changes, env, navigation };
}

describe('RouteService: current route', () => {
  it('classifies the initial location', () => {
    const { service } = setup('/elonmusk/status/1');
    expect(service.route).toMatchObject({ id: 'post', tweetId: '1' });
    expect(service.page).toBe(service.route);
    expect(service.pageScope.disposed).toBe(false);
  });

  it('does not notify for the route it starts on', () => {
    const { changes } = setup();
    expect(changes).toEqual([]);
  });
});

describe('RouteService: changes', () => {
  it('notifies with the new route, the previous one, and the page', () => {
    const { go, changes, service } = setup('/home');
    go('/elonmusk');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      route: { id: 'profile' },
      previous: { id: 'home' },
      page: { id: 'profile' },
      pageChanged: true,
    });
    expect(service.route.id).toBe('profile');
  });

  it('does not notify again for the same logical route', () => {
    const { go, changes } = setup('/home');
    go('/search?q=cats');
    go('/search?q=cats&src=typed_query');
    go('/search?q=cats');
    expect(changes).toHaveLength(1);
  });

  it('ignores hash, trailing-slash and tracking-parameter changes', () => {
    const { go, changes } = setup('/a/status/1');
    go('/a/status/1?s=20');
    go('/a/status/1/');
    expect(changes).toEqual([]);
  });

  it('notifies when the query changes what is shown', () => {
    const { go, changes } = setup('/search?q=cats');
    go('/search?q=dogs');
    expect(changes).toHaveLength(1);
    expect(changes[0]!.route.query).toBe('dogs');
  });

  it('handles back and forward like any other change', () => {
    const { go, changes } = setup('/home');
    go('/elonmusk');
    go('/home');
    go('/elonmusk');
    expect(changes.map((change) => change.route.id)).toEqual(['profile', 'home', 'profile']);
  });

  it('survives an unknown route', () => {
    const { go, changes, service } = setup('/home');
    go('/flow/something/odd');
    expect(service.route.id).toBe('unknown');
    go('/home');
    expect(changes.map((change) => change.route.id)).toEqual(['unknown', 'home']);
  });

  it('keeps notifying after a listener throws', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service, go } = setup('/home');
    const later = vi.fn();
    service.onRoute(() => {
      throw new Error('boom');
    });
    service.onRoute(later);
    go('/explore');
    expect(later).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    report.mockRestore();
  });

  it('check() acts on a change no signal announced, and is a no-op otherwise', () => {
    const { env, service, changes } = setup('/home');
    service.check();
    expect(changes).toEqual([]);
    env.location.pathname = '/explore';
    service.check();
    expect(changes).toHaveLength(1);
  });
});

describe('RouteService: page scope', () => {
  it('disposes the old page scope once and gives the new page a fresh one', () => {
    const { service, go } = setup('/home');
    const first = service.pageScope;
    const cleanup = vi.fn();
    first.add(cleanup);
    go('/elonmusk');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(first.disposed).toBe(true);
    const second = service.pageScope;
    expect(second).not.toBe(first);
    expect(second.disposed).toBe(false);
  });

  it('keeps the page scope for repeated signals about the same route', () => {
    const { service, go } = setup('/home');
    go('/elonmusk');
    const scope = service.pageScope;
    go('/elonmusk');
    go('/elonmusk?s=20');
    go('/ElonMusk/');
    expect(service.pageScope).toBe(scope);
    expect(scope.disposed).toBe(false);
  });

  it('gives each visit its own scope when going back', () => {
    const { service, go } = setup('/home');
    const home = service.pageScope;
    go('/elonmusk');
    go('/home');
    expect(home.disposed).toBe(true);
    expect(service.pageScope).not.toBe(home);
    expect(service.pageScope.disposed).toBe(false);
  });

  it('runs page cleanup before subscribers hear about the new route', () => {
    const { service, go } = setup('/home');
    const order: string[] = [];
    service.pageScope.add(() => order.push('dispose'));
    service.onRoute(({ pageChanged }) => order.push(`notify:${pageChanged}`));
    go('/elonmusk');
    expect(order).toEqual(['dispose', 'notify:true']);
  });

  it('leaves the page scope alone when a modal opens and closes over it', () => {
    const { service, go, changes } = setup('/home');
    const scope = service.pageScope;
    go('/compose/post');
    expect(service.route.id).toBe('compose');
    expect(service.page.id).toBe('home');
    expect(service.pageScope).toBe(scope);
    go('/home');
    expect(service.route.id).toBe('home');
    expect(service.pageScope).toBe(scope);
    expect(scope.disposed).toBe(false);
    expect(changes.map((change) => change.pageChanged)).toEqual([false, false]);
  });

  it('keeps the thread under its photo viewer', () => {
    const { service, go } = setup('/a/status/1');
    const scope = service.pageScope;
    go('/a/status/1/photo/1');
    go('/a/status/1/photo/2');
    go('/a/status/1');
    expect(service.pageScope).toBe(scope);
  });

  it('starts a new page when navigating away from under a modal', () => {
    const { service, go } = setup('/home');
    const scope = service.pageScope;
    go('/compose/post');
    go('/elonmusk');
    expect(scope.disposed).toBe(true);
    expect(service.page.id).toBe('profile');
  });

  it('treats a modal the app starts on as its page until something else replaces it', () => {
    const { service, go } = setup('/compose/post');
    expect(service.page.id).toBe('compose');
    const scope = service.pageScope;
    go('/home');
    expect(scope.disposed).toBe(true);
    expect(service.page.id).toBe('home');
  });

  it('lets page-scoped work clean itself up with the page', () => {
    const { service, go } = setup('/home');
    const stop = vi.fn();
    service.onRoute(() => {});
    service.pageScope.add(stop);
    go('/explore');
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('RouteService: lifetime', () => {
  it('disposes the active page scope when its own scope is disposed', () => {
    const { root, service } = setup('/home');
    const page = service.pageScope;
    const cleanup = vi.fn();
    page.add(cleanup);
    root.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(page.disposed).toBe(true);
  });

  it('stops listening for navigation when its scope is disposed', () => {
    const { root, go, changes } = setup('/home');
    root.dispose();
    go('/explore');
    expect(changes).toEqual([]);
  });

  it('ignores check() after disposal', () => {
    const { root, service, env, changes } = setup('/home');
    root.dispose();
    env.location.pathname = '/explore';
    service.check();
    expect(changes).toEqual([]);
  });

  it('removes a subscriber that unsubscribes', () => {
    const { service, go } = setup('/home');
    const listener = vi.fn();
    const stop = service.onRoute(listener);
    go('/explore');
    stop();
    go('/home');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('works without a Navigation API, following check() only', () => {
    const location = { pathname: '/home', search: '' };
    const root = new Scope();
    const service = createRouteService(root, { location, navigation: null });
    location.pathname = '/explore';
    service.check();
    expect(service.route.id).toBe('explore');
  });

  it('stops itself when the owner of its scope has gone away', () => {
    let valid = true;
    const root = new Scope(() => valid);
    const navigation = new EventTarget();
    const location = { pathname: '/home', search: '' };
    const service = createRouteService(root, { location, navigation });
    const listener = vi.fn();
    service.onRoute(listener);
    valid = false;
    location.pathname = '/explore';
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(listener).not.toHaveBeenCalled();
    expect(root.disposed).toBe(true);
  });
});
