/**
 * Classifies an X URL into an application route. Pure: a pathname and query string in, a Route
 * out. This is about which part of X is on screen; parsing a canonical post URL for saving is
 * `parsePostUrl` in `./url`, which stays separate.
 *
 * The URL is the only input. Page titles and DOM are never consulted.
 *
 * Path shapes were checked against Control Panel for Twitter's route knowledge (MIT); the
 * classification and its identity rules here are written for Better X and share no code with it.
 */

export type RouteId =
  | 'home'
  | 'post'
  | 'media'
  | 'profile'
  | 'search'
  | 'notifications'
  | 'messages'
  | 'bookmarks'
  | 'lists'
  | 'list'
  | 'communities'
  | 'community'
  | 'explore'
  | 'compose'
  | 'settings'
  | 'grok'
  | 'unknown';

export interface Route {
  id: RouteId;
  /**
   * Identity of the content on screen. Two URLs with the same key are the same logical route, so
   * a change of hash, of tracking query parameters, or of trailing slash is not a navigation.
   * Deliberately excludes anything that does not change what is shown.
   */
  key: string;
  /**
   * An overlay (composer, photo or video viewer) shown over whatever page is behind it. Opening
   * one is a route change, but not a change of page.
   */
  modal: boolean;
  handle?: string;
  tweetId?: string;
  listId?: string;
  communityId?: string;
  /** Sub-view of the route: a profile tab, a post's quotes/reposts/likes list, a search filter. */
  view?: string;
  /** The search text, for search routes. */
  query?: string;
}

export interface UrlParts {
  pathname: string;
  search?: string;
}

const HANDLE = '[A-Za-z0-9_]{1,15}';
const ID = '\\d+';

/** Top-level paths that look like a handle but are not one. */
const RESERVED = new Set([
  'about',
  'account',
  'ads',
  'bookmarks',
  'business',
  'compose',
  'download',
  'explore',
  'flow',
  'help',
  'hashtag',
  'home',
  'i',
  'intent',
  'jobs',
  'login',
  'logout',
  'messages',
  'notifications',
  'oauth',
  'oauth2',
  'privacy',
  'search',
  'settings',
  'share',
  'signup',
  'tos',
]);

const PROFILE_VIEWS = new Set([
  'affiliates',
  'articles',
  'highlights',
  'likes',
  'media',
  'superfollows',
  'with_replies',
]);
const FOLLOW_VIEWS = new Set([
  'followers',
  'followers_you_follow',
  'following',
  'verified_followers',
]);
const POST_VIEWS = new Set(['likes', 'quotes', 'reposts', 'retweets']);

const POST = new RegExp(`^/(?:(${HANDLE})|i(?:/web)?)/status/(${ID})(?:/([a-z_]+)(?:/(\\d+))?)?$`);
const PROFILE = new RegExp(`^/(${HANDLE})(?:/([a-z_]+))?$`);
const LISTS_INDEX = new RegExp(`^/(${HANDLE})/lists(?:/[a-z_]+)?$`);
const COMMUNITIES_INDEX = new RegExp(`^/(${HANDLE})/communities(?:/explore)?$`);

/** `search` query parameters that change what results are shown; the rest are tracking. */
const SEARCH_PARAMS = ['q', 'f'] as const;

function route(id: RouteId, key: string, extra: Partial<Route> = {}): Route {
  return { id, key, modal: false, ...extra };
}

export function classifyRoute({ pathname, search = '' }: UrlParts): Route {
  const path = normalize(pathname);
  const segments = path.split('/').filter(Boolean);
  const first = segments[0]?.toLowerCase() ?? '';

  if (path === '/' || path === '/home') return route('home', 'home');

  if (first === 'search' && segments.length === 1) return searchRoute(search);
  if (first === 'hashtag' && segments[1] && segments.length === 2)
    return searchRoute(new URLSearchParams({ q: `#${decode(segments[1])}` }).toString());

  if (first === 'explore') return route('explore', 'explore');
  if (first === 'notifications') return route('notifications', 'notifications');
  if (first === 'settings') return route('settings', `settings:${path}`);
  if (first === 'compose') return route('compose', 'compose', { modal: true });

  if (first === 'messages') {
    if (segments[1] === 'compose') return route('compose', 'compose:message', { modal: true });
    return route('messages', `messages:${segments[1] ?? ''}`);
  }

  if (first === 'i') {
    const area = segments[1]?.toLowerCase();
    if (area === 'bookmarks') return route('bookmarks', 'bookmarks');
    if (area === 'grok') return route('grok', 'grok');
    if (area === 'chat') return route('messages', `messages:${segments.slice(2).join('/')}`);
    if (area === 'foundmedia') return route('compose', 'compose:media', { modal: true });
    if (area === 'lists' && /^\d+$/.test(segments[2] ?? '') && segments.length === 3)
      return route('list', `list:${segments[2]}`, { listId: segments[2]! });
    if (area === 'lists' && segments.length === 2) return route('lists', 'lists');
    if (area === 'communities') {
      const id = segments[2];
      if (id && /^\d+$/.test(id))
        return route('community', `community:${id}:${segments[3] ?? ''}`, { communityId: id });
      if (segments.length <= 3) return route('communities', 'communities');
    }
  }

  const post = POST.exec(path);
  if (post) {
    const handle = post[1];
    const tweetId = post[2]!;
    const view = post[3]?.toLowerCase();
    const identity = { ...(handle ? { handle } : {}), tweetId };
    if (view === 'photo' || view === 'video')
      return route('media', `media:${tweetId}:${view}:${post[4] ?? ''}`, {
        ...identity,
        modal: true,
      });
    if (view === 'mediaviewer')
      return route('media', `media:${tweetId}:viewer`, { ...identity, modal: true });
    if (!view) return route('post', `post:${tweetId}`, identity);
    if (POST_VIEWS.has(view) && !post[4])
      return route('post', `post:${tweetId}:${view}`, { ...identity, view });
    return route('unknown', `unknown:${path}`);
  }

  const lists = LISTS_INDEX.exec(path);
  if (lists) return route('lists', `lists:${lists[1]!.toLowerCase()}`, { handle: lists[1]! });
  const communities = COMMUNITIES_INDEX.exec(path);
  if (communities) return route('communities', 'communities', { handle: communities[1]! });

  const profile = PROFILE.exec(path);
  if (profile && !RESERVED.has(first)) {
    const handle = profile[1]!;
    const view = profile[2]?.toLowerCase();
    const id = handle.toLowerCase();
    if (!view) return route('profile', `profile:${id}`, { handle });
    if (PROFILE_VIEWS.has(view) || FOLLOW_VIEWS.has(view))
      return route('profile', `profile:${id}:${view}`, { handle, view });
  }

  return route('unknown', `unknown:${path}`);
}

/** Classifies a full URL (or a path with `base`). Anything unparseable is `unknown`. */
export function classifyUrl(input: string, base = 'https://x.com'): Route {
  try {
    const { pathname, search } = new URL(input, base);
    return classifyRoute({ pathname, search });
  } catch {
    return route('unknown', `unknown:${input}`);
  }
}

function searchRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const query = params.get('q') ?? '';
  const view = params.get('f') ?? undefined;
  const key = new URLSearchParams(
    SEARCH_PARAMS.flatMap((name) => {
      const value = params.get(name);
      return value ? [[name, value] as [string, string]] : [];
    }),
  ).toString();
  return route('search', `search:${key}`, { query, ...(view ? { view } : {}) });
}

/** Trailing slashes and repeated slashes are not part of a route's identity. */
function normalize(pathname: string): string {
  const path = pathname.replace(/\/{2,}/g, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
