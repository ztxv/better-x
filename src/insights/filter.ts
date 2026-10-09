import { el, xTheme } from '../content/popover';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeHandle,
  updateSettings,
  watchSettings,
  type FilterSettings,
} from '../lib/settings';
import type { Runtime } from '../runtime';
import type { Scope } from '../runtime/scope';
import type { PostIdentity } from '../x/url';
import { postAuthorHandle, quotedAuthors } from '../x/selectors';
import { ACCOUNT_ICONS } from './icons';
import { reasonText, selectionOf, verdictFor, type Selection } from './verdict';
import type { Place } from './places';

const CELL = '[data-testid="cellInnerDiv"]';
const MAX_REVEALED = 500;

type Kind = 'post' | 'quote';

/** What a placeholder says. The wording is the same for every reason; only the place differs. */
export function placeholderText(
  kind: Kind,
  place: Place,
): { title: string; reason: string; action: string } {
  return kind === 'post'
    ? { title: 'Post hidden by Better X', reason: reasonText(place), action: 'Show post' }
    : {
        title: 'Quoted post hidden by Better X',
        reason: reasonText(place),
        action: 'Show quoted post',
      };
}

function placeholder(kind: Kind, place: Place, theme: 'light' | 'dark', onShow: () => void) {
  const text = placeholderText(kind, place);
  const card = el('div', 'bx-filter-card', '', { role: 'group', 'data-kind': kind });
  card.dataset.theme = theme;
  card.setAttribute('aria-label', text.title);
  card.insertAdjacentHTML('afterbegin', ACCOUNT_ICONS.shield);
  const copy = el('div', 'bx-fc-text');
  copy.append(el('strong', '', text.title), el('span', '', text.reason));
  const show = el('button', 'bx-fc-show', text.action, { type: 'button' });
  show.addEventListener('click', (event) => {
    // The placeholder can sit inside a post that opens when clicked.
    event.stopPropagation();
    event.preventDefault();
    onShow();
  });
  card.append(copy, show);
  return card;
}

interface PostMark {
  cell: Element;
  card?: HTMLElement;
}
interface QuoteMark {
  article: HTMLElement;
  key: string;
  card?: HTMLElement;
}

/**
 * Collapses, hides or highlights posts and quoted posts whose author X says is based in a
 * selected place. It only ever acts on a known answer, never touches a node X owns beyond one
 * attribute (a timeline cell or a quote card is marked, and a CSS rule does the hiding), puts
 * its placeholder beside X's markup, and restores everything when the scope ends.
 */
export function startCountryFilter({ scope, runtime }: { scope: Scope; runtime: Runtime }) {
  const accounts = runtime.accounts;
  const owner = {};
  let config: FilterSettings = DEFAULT_SETTINGS.filter;
  let selection: Selection = selectionOf(config);

  const seen = new Map<HTMLElement, PostIdentity>();
  const postMarks = new Map<HTMLElement, PostMark>();
  const cellOwner = new WeakMap<Element, HTMLElement>();
  const quoteMarks = new Map<HTMLElement, QuoteMark>();
  const articleQuotes = new Map<HTMLElement, Set<HTMLElement>>();
  const revealed = new Set<string>();

  let theme: 'light' | 'dark' = 'light';
  let themeAt = 0;
  const currentTheme = () => {
    const now = Date.now();
    if (now - themeAt > 2000) {
      theme = xTheme();
      themeAt = now;
    }
    return theme;
  };

  let selfAt = 0;
  let self: string | null = null;
  const selfHandle = () => {
    const now = Date.now();
    if (now - selfAt > 3000) {
      selfAt = now;
      const href = document
        .querySelector('[data-testid="AppTabBar_Profile_Link"]')
        ?.getAttribute('href');
      self = normalizeHandle(href?.replace(/^\//, ''));
    }
    return self;
  };

  const remember = (key: string) => {
    revealed.add(key);
    if (revealed.size > MAX_REVEALED) revealed.delete(revealed.values().next().value as string);
  };

  /* ------------------------------------------------------------------ whole posts */

  function clearPost(article: HTMLElement) {
    const mark = postMarks.get(article);
    if (!mark) return;
    postMarks.delete(article);
    mark.card?.remove();
    if (cellOwner.get(mark.cell) === article) {
      mark.cell.removeAttribute('data-bx-filter');
      cellOwner.delete(mark.cell);
    }
  }

  function applyPost(article: HTMLElement, tweetId: string, place: Place) {
    const cell = article.closest(CELL);
    if (!cell) return clearPost(article);
    let mark = postMarks.get(article);
    if (mark && mark.cell !== cell) {
      clearPost(article);
      mark = undefined;
    }
    mark ??= { cell };
    postMarks.set(article, mark);
    cellOwner.set(cell, article);
    keepSweeping();
    const key = `p:${tweetId}`;
    if (revealed.has(key)) {
      cell.setAttribute('data-bx-filter', 'revealed');
      mark.card?.remove();
      mark.card = undefined;
      return;
    }
    cell.setAttribute('data-bx-filter', config.mode);
    if (config.mode !== 'collapse') {
      mark.card?.remove();
      mark.card = undefined;
      return;
    }
    if (!mark.card?.isConnected) {
      mark.card = placeholder('post', place, currentTheme(), () => {
        remember(key);
        const seenIdentity = seen.get(article);
        if (seenIdentity) visit(article, seenIdentity);
      });
      cell.append(mark.card);
    }
  }

  /* ------------------------------------------------------------------- quoted posts */

  function clearQuote(block: HTMLElement) {
    const mark = quoteMarks.get(block);
    quoteMarks.delete(block);
    mark?.card?.remove();
    block.removeAttribute('data-bx-quote');
  }

  function applyQuote(block: HTMLElement, article: HTMLElement, key: string, place: Place) {
    let mark = quoteMarks.get(block);
    mark ??= { article, key };
    mark.key = key;
    quoteMarks.set(block, mark);
    if (revealed.has(key)) {
      block.setAttribute('data-bx-quote', 'revealed');
      mark.card?.remove();
      mark.card = undefined;
      return;
    }
    block.setAttribute('data-bx-quote', config.mode);
    if (config.mode !== 'collapse') {
      mark.card?.remove();
      mark.card = undefined;
      return;
    }
    if (!mark.card?.isConnected) {
      mark.card = placeholder('quote', place, currentTheme(), () => {
        remember(key);
        const identity = seen.get(article);
        if (identity) visit(article, identity);
      });
      block.after(mark.card);
    }
  }

  /* ----------------------------------------------------------------------- one post */

  function visit(article: HTMLElement, identity: PostIdentity) {
    seen.set(article, identity);
    const active = selection.keys.size > 0;
    const author = config.posts && active ? postAuthorHandle(article, identity.handle) : null;
    const quotes = config.quotes && active ? quotedAuthors(article) : [];

    const handles = [author, ...quotes.map((quote) => quote.handle)].filter(
      (handle): handle is string => Boolean(handle),
    );
    if (handles.length) accounts.track(owner, article, handles, { auto: true });
    else accounts.untrack(owner, article);

    // Whole post.
    const route = runtime.routes.route;
    const focal = route.id === 'post' && route.tweetId === identity.tweetId;
    const verdict = verdictFor(
      selection,
      author,
      author ? accounts.service.peek(author) : undefined,
      {
        self: selfHandle(),
        focal,
      },
    );
    if (verdict.match) applyPost(article, identity.tweetId, verdict.place);
    else clearPost(article);

    // Quoted posts: each by its own author, never the quoting post's.
    const present = new Set<HTMLElement>();
    for (const quote of quotes) {
      present.add(quote.block);
      const quoteVerdict = verdictFor(
        selection,
        quote.handle,
        quote.handle ? accounts.service.peek(quote.handle) : undefined,
        { self: selfHandle() },
      );
      if (quoteVerdict.match && quote.handle)
        applyQuote(
          quote.block,
          article,
          `q:${identity.tweetId}>${quote.handle}`,
          quoteVerdict.place,
        );
      else clearQuote(quote.block);
    }
    for (const block of articleQuotes.get(article) ?? [])
      if (!present.has(block)) clearQuote(block);
    if (present.size) articleQuotes.set(article, present);
    else articleQuotes.delete(article);
  }

  function redrawAll() {
    for (const [article, identity] of [...seen]) {
      if (article.isConnected) visit(article, identity);
    }
  }

  function forget(article: HTMLElement) {
    clearPost(article);
    for (const block of articleQuotes.get(article) ?? []) clearQuote(block);
    articleQuotes.delete(article);
    seen.delete(article);
  }

  /**
   * A timeline cell X reuses for something that is not a post must not stay hidden. The post
   * stream reports a removed post only with the next batch of changes, which may be a while, so
   * while any mark exists a cheap check (one `contains` per marked post) runs once a second.
   */
  function sweep() {
    for (const [article, mark] of postMarks) if (!mark.cell.contains(article)) clearPost(article);
  }
  let sweeping = false;
  function keepSweeping() {
    if (sweeping || !postMarks.size) return;
    sweeping = true;
    const tick = () => {
      sweeping = false;
      sweep();
      keepSweeping();
    };
    scope.setTimeout(tick, 1000);
  }

  scope.add(runtime.posts.onPost((post) => visit(post.article, post.identity), { replay: true }));
  scope.add(
    runtime.posts.onBatch((gone) => {
      for (const article of gone) forget(article);
      sweep();
    }),
  );
  scope.add(
    accounts.onChange((articles) => {
      for (const article of articles) {
        const identity = seen.get(article);
        if (identity && article.isConnected) visit(article, identity);
      }
    }),
  );
  scope.add(runtime.routes.onRoute(() => redrawAll()));

  /* --------------------------------------------------- Always Show: learn account ids */

  const resolving = new Set<string>();
  function resolveIds() {
    for (const entry of config.alwaysShow) {
      if (entry.id || resolving.has(entry.handle)) continue;
      resolving.add(entry.handle);
      void accounts.service
        .request(entry.handle, { priority: 'hover' })
        .then((result) => {
          const id = result?.state === 'ok' ? result.info.id : undefined;
          if (!id || scope.disposed) return;
          // Written from what is stored now, so another tab's change to the list is kept.
          return updateSettings((current) => {
            const list = current.filter.alwaysShow;
            if (!list.some((item) => item.handle === entry.handle && !item.id)) return null;
            return {
              filter: {
                alwaysShow: list.map((item) =>
                  item.handle === entry.handle && !item.id ? { ...item, id } : item,
                ),
              },
            };
          });
        })
        .catch(() => {})
        .finally(() => resolving.delete(entry.handle));
    }
  }

  function setConfig(next: FilterSettings) {
    config = next;
    selection = selectionOf(next);
    redrawAll();
    resolveIds();
  }
  void loadSettings().then((settings) => {
    if (!scope.disposed) setConfig(settings.filter);
  });
  scope.add(watchSettings((settings) => setConfig(settings.filter)));

  scope.add(() => {
    for (const article of [...postMarks.keys()]) clearPost(article);
    for (const block of [...quoteMarks.keys()]) clearQuote(block);
    accounts.release(owner);
    seen.clear();
    articleQuotes.clear();
  });
}
