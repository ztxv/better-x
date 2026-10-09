import { chromeAccountStore, type AccountStore } from '../insights/accounts-store';
import {
  ALL_HANDLES,
  createAccountService,
  type AccountService,
  type AccountsConfig,
} from '../insights/accounts';
import { createAboutTransport, type AboutTransport } from '../x/about-transport';
import type { PostStream } from './posts';
import type { Disposer, Scope } from './scope';

/**
 * Who a consumer is, so one consumer's interest in a post is separate from another's and can be
 * dropped without disturbing it. Any object works; keep one per consumer.
 */
export type Owner = object;

export interface TrackOptions {
  /**
   * Look the accounts up on their own while the post is on screen (at the service's bounded
   * rate). Without it the accounts are only watched: their answers are reported when something
   * else (a click, a pointer rest, another tab) brings them in.
   */
  auto: boolean;
}

export interface AccountsRuntime {
  /** The cache and request manager. Created on first use, so a page that never uses it pays nothing. */
  readonly service: AccountService;
  /**
   * Says that `article` shows posts by `handles` (its author, quoted authors), for `owner`.
   * Replaces what `owner` said about this article before. With `auto`, those accounts are looked
   * up while the article is on screen.
   */
  track(
    owner: Owner,
    article: HTMLElement,
    handles: readonly string[],
    options: TrackOptions,
  ): void;
  /** Forgets everything `owner` said about `article`. */
  untrack(owner: Owner, article: HTMLElement): void;
  /** Forgets everything `owner` said. */
  release(owner: Owner): void;
  /**
   * Called (at most once per frame) with the articles whose tracked accounts got a new answer,
   * or the cache was cleared. A listener must be idempotent.
   */
  onChange(listener: (articles: ReadonlySet<HTMLElement>) => void): Disposer;
}

export interface AccountsDeps {
  transport?: AboutTransport;
  store?: AccountStore;
  config?: Partial<AccountsConfig>;
  /** Test seam: defaults to the real IntersectionObserver (everything counts as visible without one). */
  intersection?: typeof IntersectionObserver | null;
}

interface Interest {
  handles: readonly string[];
  auto: boolean;
}

/** How far outside the viewport a post still counts as on screen. */
const MARGIN = '150px 0px';

/**
 * Connects the account service to the page's posts. Consumers say which handles a post shows
 * (`track`); this keeps one index of that, one IntersectionObserver for every tracked post, and
 * turns the service's changes into "these posts need another look". It starts no observer until
 * something is tracked with `auto`, and none of its work is per badge.
 */
export function createAccountsRuntime(
  scope: Scope,
  posts: PostStream,
  deps: AccountsDeps = {},
): AccountsRuntime {
  let service: AccountService | undefined;
  const getService = () =>
    (service ??= createAccountService({
      scope,
      transport: deps.transport ?? createAboutTransport(),
      store: deps.store ?? chromeAccountStore(),
      config: deps.config,
    }));

  const interest = new Map<HTMLElement, Map<Owner, Interest>>();
  const byHandle = new Map<string, Set<HTMLElement>>();
  const visible = new Set<HTMLElement>();
  const listeners = new Set<(articles: ReadonlySet<HTMLElement>) => void>();
  let observer: IntersectionObserver | undefined;
  let subscribed: Disposer | undefined;

  const IO = deps.intersection === undefined ? globalThis.IntersectionObserver : deps.intersection;

  function observe(article: HTMLElement) {
    if (!IO) {
      visible.add(article);
      return;
    }
    observer ??= new IO(
      (entries) => {
        for (const entry of entries) {
          const article = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visible.add(article);
            lookup(article);
          } else visible.delete(article);
        }
      },
      { rootMargin: MARGIN },
    );
    observer.observe(article);
  }

  function unobserve(article: HTMLElement) {
    visible.delete(article);
    observer?.unobserve(article);
  }

  /** Asks for the accounts of an on-screen article that want automatic lookup. */
  function lookup(article: HTMLElement) {
    const owners = interest.get(article);
    if (!owners) return;
    const wanted = () => visible.has(article) && article.isConnected;
    for (const { handles, auto } of owners.values())
      if (auto)
        for (const handle of handles)
          void getService().request(handle, { priority: 'visible', wanted });
  }

  /** The handles each article is filed under, so refiling it touches only its own entries. */
  const indexed = new Map<HTMLElement, Set<string>>();

  function reindex(article: HTMLElement) {
    for (const handle of indexed.get(article) ?? []) {
      const set = byHandle.get(handle);
      if (set?.delete(article) && set.size === 0) byHandle.delete(handle);
    }
    indexed.delete(article);
    const owners = interest.get(article);
    if (!owners) return;
    const now = new Set<string>();
    for (const { handles } of owners.values()) for (const handle of handles) now.add(handle);
    for (const handle of now) {
      let set = byHandle.get(handle);
      if (!set) byHandle.set(handle, (set = new Set()));
      set.add(article);
    }
    indexed.set(article, now);
  }

  function ensureSubscribed() {
    if (subscribed) return;
    subscribed = getService().subscribe((changed) => {
      const articles = new Set<HTMLElement>();
      if (changed.has(ALL_HANDLES)) for (const article of interest.keys()) articles.add(article);
      else
        for (const handle of changed)
          for (const article of byHandle.get(handle) ?? []) articles.add(article);
      if (!articles.size) return;
      for (const listener of [...listeners]) {
        try {
          listener(articles);
        } catch (error) {
          console.error('[Better X] account listener failed', error);
        }
      }
    });
  }

  function drop(article: HTMLElement) {
    interest.delete(article);
    reindex(article);
    unobserve(article);
  }

  // Posts that left the page take their interest with them.
  scope.add(
    posts.onBatch((gone) => {
      for (const article of gone) drop(article);
    }),
  );
  scope.add(() => {
    observer?.disconnect();
    observer = undefined;
    interest.clear();
    indexed.clear();
    byHandle.clear();
    visible.clear();
    listeners.clear();
    subscribed?.();
  });

  function track(
    owner: Owner,
    article: HTMLElement,
    handles: readonly string[],
    { auto }: TrackOptions,
  ) {
    if (scope.disposed) return;
    let owners = interest.get(article);
    if (!owners) interest.set(article, (owners = new Map()));
    const clean = [...new Set(handles.map((h) => h.toLowerCase()))];
    const before = owners.get(owner);
    if (
      before &&
      before.auto === auto &&
      before.handles.length === clean.length &&
      before.handles.every((h, i) => h === clean[i])
    )
      return;
    owners.set(owner, { handles: clean, auto });
    reindex(article);
    ensureSubscribed();
    if (auto) {
      observe(article);
      if (visible.has(article)) lookup(article);
    }
  }

  function untrack(owner: Owner, article: HTMLElement) {
    const owners = interest.get(article);
    if (!owners?.delete(owner)) return;
    if (!owners.size) drop(article);
    else reindex(article);
  }

  return {
    get service() {
      return getService();
    },
    track,
    untrack,
    release(owner) {
      for (const article of [...interest.keys()]) untrack(owner, article);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
