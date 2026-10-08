import { postIdentity, X_SELECTORS } from '../x/selectors';
import type { PostIdentity } from '../x/url';
import { watchArticles } from './articles';
import type { Disposer, Scope } from './scope';

/**
 * Why a post is being reported:
 * - `new`: first time this article element has been seen showing a post;
 * - `recycled`: X reused the element for a different post (the virtualized timeline does this);
 * - `changed`: the same post, but something inside its element changed. X renders a post in
 *   stages, so the action row, media and quote often arrive after the article itself.
 */
export type PostReason = 'new' | 'recycled' | 'changed';

export interface StreamPost {
  article: HTMLElement;
  identity: PostIdentity;
  reason: PostReason;
}

export type PostListener = (post: StreamPost) => void;

export interface PostStream {
  /**
   * Reports each post whose element appeared or changed, at most once per animation frame per
   * element. A `changed` report only means "look again", so a listener must be idempotent. With
   * `replay`, every post already known is reported first, as `new`.
   */
  onPost(listener: PostListener, options?: { replay?: boolean }): Disposer;
  /** Called once after each batch of reports, for housekeeping that follows a round of changes. */
  onBatch(listener: () => void): Disposer;
  /** The posts currently on the page. */
  posts(): ReadonlyArray<Pick<StreamPost, 'article' | 'identity'>>;
}

/**
 * The one place the page's posts are discovered. It sits on the single managed document observer
 * (`watchArticles`), so adding a consumer adds no observer and no extra scan. Quoted posts (nested
 * articles) and articles that do not yet show a recognizable post are not reported.
 */
export function createPostStream(scope: Scope, root: Node = document.documentElement): PostStream {
  const known = new Map<HTMLElement, PostIdentity>();
  const postListeners = new Set<PostListener>();
  const batchListeners = new Set<() => void>();
  scope.add(() => {
    postListeners.clear();
    batchListeners.clear();
    known.clear();
  });

  const call = <T extends unknown[]>(listener: (...args: T) => void, ...args: T) => {
    try {
      listener(...args);
    } catch (error) {
      console.error('[Better X] post listener failed', error);
    }
  };

  function prune() {
    for (const article of known.keys()) if (!article.isConnected) known.delete(article);
  }

  function visit(article: HTMLElement) {
    // Quoted posts are nested articles in X's newer layout; only the outer post is a post.
    if (article.parentElement?.closest(X_SELECTORS.post)) return;
    const identity = postIdentity(article);
    if (!identity) return;
    const before = known.get(article);
    const reason: PostReason = !before
      ? 'new'
      : before.tweetId !== identity.tweetId
        ? 'recycled'
        : 'changed';
    known.set(article, identity);
    for (const listener of [...postListeners]) call(listener, { article, identity, reason });
  }

  watchArticles(scope, {
    root,
    selector: X_SELECTORS.post,
    enhance: visit,
    afterBatch() {
      prune();
      for (const listener of [...batchListeners]) call(listener);
    },
  });

  // What is on the page now. Nothing is listening yet, so this only fills `known`.
  const start = root instanceof Element ? root : (root as Document).documentElement;
  if (start.matches(X_SELECTORS.post)) visit(start as HTMLElement);
  start.querySelectorAll<HTMLElement>(X_SELECTORS.post).forEach(visit);

  return {
    onPost(listener, { replay = false } = {}) {
      if (replay)
        for (const [article, identity] of [...known])
          if (article.isConnected) call(listener, { article, identity, reason: 'new' });
      postListeners.add(listener);
      return () => postListeners.delete(listener);
    },
    onBatch(listener) {
      batchListeners.add(listener);
      return () => batchListeners.delete(listener);
    },
    posts() {
      return [...known]
        .filter(([article]) => article.isConnected)
        .map(([article, identity]) => ({ article, identity }));
    },
  };
}
