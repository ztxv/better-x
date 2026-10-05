import { observe } from '../runtime/observe';
import type { Scope } from '../runtime/scope';

export interface ArticleWatch {
  /** The root whose subtree is observed. */
  root: Node;
  /** Matches a post article. */
  selector: string;
  /** Called for each affected article that is still connected, once per frame. */
  enhance: (article: HTMLElement) => void;
  /** Called after each batch, for housekeeping that follows a round of DOM changes. */
  afterBatch: () => void;
}

/**
 * Watches `root` for posts that appear or change and hands the affected articles to `enhance`,
 * batched to one pass per animation frame. The observer and any pending frame belong to `scope`.
 *
 * Text and `href` changes are observed as well as added nodes: X reuses a post's element for a
 * different post by rewriting its link and text, which must re-enhance that element.
 */
export function watchArticles(scope: Scope, { root, selector, enhance, afterBatch }: ArticleWatch) {
  const pending = new Set<HTMLElement>();
  let scheduled = false;
  observe(
    scope,
    root,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href'],
    },
    (mutations) => {
      for (const mutation of mutations) {
        const target =
          mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const parent = target?.closest<HTMLElement>(selector) ?? null;
        if (parent) pending.add(parent);
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(selector)) pending.add(node);
          node.querySelectorAll<HTMLElement>(selector).forEach((article) => pending.add(article));
        }
      }
      if (!pending.size || scheduled) return;
      scheduled = true;
      scope.requestFrame(() => {
        scheduled = false;
        for (const article of pending) if (article.isConnected) enhance(article);
        pending.clear();
        afterBatch();
      });
    },
  );
}
