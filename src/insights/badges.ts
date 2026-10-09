import { el } from '../content/popover';
import { loadSettings, watchSettings, type LookupMode } from '../lib/settings';
import type { Runtime } from '../runtime';
import type { Disposer, Scope } from '../runtime/scope';
import { handleOfHref, postAuthorHandle, postNameBlock } from '../x/selectors';
import { createAccountCard, type AccountCard } from './card';
import { ACCOUNT_ICONS } from './icons';
import {
  badgeSummary,
  badgeView,
  viewKey,
  type BadgeItem,
  type BadgePart,
  type BadgeView,
} from './model';

const HOVER_LOOKUP_DELAY = 350;
const BADGE = '.bx-acct';

interface BadgeState {
  handle: string;
  element?: HTMLElement;
  key?: string;
}

export interface BadgeController {
  /** Shows `part` of the badge while the returned disposer has not been called. */
  retain(part: BadgePart): Disposer;
}

const controllers = new WeakMap<Runtime, BadgeController>();

/** The one badge controller of a runtime: the four Account insights toggles share it. */
export function badgesFor(runtime: Runtime): BadgeController {
  let controller = controllers.get(runtime);
  if (!controller) controllers.set(runtime, (controller = createBadgeController(runtime)));
  return controller;
}

function itemElement(item: BadgeItem): HTMLElement {
  const node = el('span', 'bx-acct-item', '', { 'data-kind': item.kind, title: item.title });
  if (item.kind === 'flag') node.textContent = item.glyph ?? '';
  else if (item.kind === 'region') node.innerHTML = ACCOUNT_ICONS.mapPin;
  else if (item.kind === 'warning') node.innerHTML = ACCOUNT_ICONS.alert;
  else
    node.innerHTML =
      item.platform === 'ios'
        ? ACCOUNT_ICONS.apple
        : item.platform === 'android'
          ? ACCOUNT_ICONS.android
          : ACCOUNT_ICONS.globe;
  return node;
}

/**
 * Where a badge goes: right after the "@handle" in the post's name block, as a sibling of the
 * handle's own cell so it never sits inside X's profile link. Null when the block is not there
 * (X's markup without test IDs), in which case no badge is shown rather than a misplaced one.
 */
export function badgeSlot(
  article: HTMLElement,
  handle: string,
): { parent: Element; after: Node } | null {
  const nameBlock = postNameBlock(article);
  if (!nameBlock) return null;
  for (const link of nameBlock.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (handleOfHref(link.getAttribute('href')) !== handle) continue;
    if (!link.textContent?.trim().startsWith('@')) continue;
    // The row holding the handle, the dot and the time: the handle's own cell is its child.
    let cell: Element = link;
    while (cell.parentElement && cell.parentElement.parentElement !== nameBlock)
      cell = cell.parentElement;
    const row = cell.parentElement;
    if (!row || row === nameBlock) return null;
    return { parent: row, after: cell };
  }
  return null;
}

function createBadgeController(runtime: Runtime): BadgeController {
  const parts = new Map<BadgePart, number>();
  let live: Scope | undefined;
  let render: (() => void) | undefined;

  function start() {
    const scope = runtime.scope.child();
    live = scope;
    const accounts = runtime.accounts;
    const owner = {};
    const states = new WeakMap<HTMLElement, BadgeState>();
    const shown = new Set<HTMLElement>();
    let mode: LookupMode = 'hover';
    let card: AccountCard | undefined;
    const getCard = () => (card ??= createAccountCard(scope, accounts.service));
    const wanted = () => new Set(parts.keys());

    const automatic = () => mode === 'visible';
    const interactive = (view: BadgeView) =>
      view.state === 'idle' ||
      view.state === 'failed' ||
      (view.state === 'loaded' && parts.has('details'));

    function remove(article: HTMLElement) {
      const state = states.get(article);
      state?.element?.remove();
      if (state?.element) shown.delete(state.element);
      states.delete(article);
      accounts.untrack(owner, article);
    }

    function draw(article: HTMLElement, state: BadgeState) {
      const view = badgeView(accounts.service.peek(state.handle), wanted(), automatic());
      const loadedItems = view.state === 'loaded' ? view.items : [];
      // Loaded but nothing to show is only worth a control when the card can be opened.
      const empty = view.state === 'loaded' && loadedItems.length === 0 && !parts.has('details');
      const nothing = view.state === 'none' || view.state === 'waiting' || empty;
      if (nothing) {
        if (state.element) {
          state.element.remove();
          shown.delete(state.element);
          state.element = undefined;
          state.key = undefined;
        }
        return;
      }
      const clickable = interactive(view);
      const key = viewKey(view, clickable, state.handle);
      if (state.element?.isConnected && state.key === key) return;

      const slot = badgeSlot(article, state.handle);
      if (!slot) {
        state.element?.remove();
        state.element = undefined;
        state.key = undefined;
        return;
      }
      const tag = clickable ? 'BUTTON' : 'SPAN';
      let target = state.element;
      if (!target || target.tagName !== tag) {
        if (target) {
          target.remove();
          shown.delete(target);
        }
        target = el(clickable ? 'button' : 'span', 'bx-acct');
      }
      target.dataset.bxAcct = state.handle;
      target.dataset.state = view.state;
      target.replaceChildren();
      target.removeAttribute('aria-haspopup');
      target.removeAttribute('aria-expanded');
      if (target instanceof HTMLButtonElement) target.type = 'button';
      if (view.state === 'idle') {
        target.setAttribute('aria-label', `Look up where @${state.handle} is based`);
        target.title =
          mode === 'manual'
            ? 'Click to look up where this account is based and how it connects.'
            : 'Hover or click to look up where this account is based and how it connects.';
        target.insertAdjacentHTML('beforeend', ACCOUNT_ICONS.globe);
      } else if (view.state === 'failed') {
        target.setAttribute(
          'aria-label',
          `Could not load account information for @${state.handle}. Click to try again`,
        );
        target.title = 'Could not load account information. Click to try again.';
        target.insertAdjacentHTML('beforeend', ACCOUNT_ICONS.alert);
      } else {
        target.setAttribute('aria-label', badgeSummary(state.handle, view));
        target.removeAttribute('title');
        if (loadedItems.length) target.append(...loadedItems.map(itemElement));
        else target.insertAdjacentHTML('beforeend', ACCOUNT_ICONS.info);
        if (clickable) {
          target.setAttribute('aria-haspopup', 'dialog');
          target.setAttribute('aria-expanded', 'false');
          target.title = 'Show account details';
        }
      }
      if (!target.isConnected || target.parentElement !== slot.parent)
        slot.after.parentNode?.insertBefore(target, slot.after.nextSibling);
      state.element = target;
      state.key = key;
      shown.add(target);
    }

    function visit(article: HTMLElement, tweetHandle: string | null, reason: string) {
      let state = states.get(article);
      const handle = postAuthorHandle(article, tweetHandle);
      if (!handle) {
        if (state) remove(article);
        return;
      }
      if (state && state.handle !== handle) {
        // X reused this element for a different author.
        remove(article);
        state = undefined;
      }
      if (!state) states.set(article, (state = { handle }));
      // A later look at the same post only matters when our badge was dropped with X's markup.
      if (reason === 'changed' && state.element?.isConnected) return;
      accounts.track(owner, article, [handle], { auto: automatic() });
      draw(article, state);
    }

    function redrawAll() {
      for (const { article, identity } of runtime.posts.posts()) {
        const state = states.get(article);
        if (state) {
          accounts.track(owner, article, [state.handle], { auto: automatic() });
          draw(article, state);
        } else visit(article, identity.handle, 'new');
      }
    }
    render = redrawAll;

    scope.add(
      runtime.posts.onPost((post) => visit(post.article, post.identity.handle, post.reason), {
        replay: true,
      }),
    );
    scope.add(
      runtime.posts.onBatch((gone) => {
        for (const article of gone) {
          const state = states.get(article);
          if (state?.element) shown.delete(state.element);
          states.delete(article);
        }
      }),
    );
    scope.add(
      accounts.onChange((articles) => {
        for (const article of articles) {
          const state = states.get(article);
          if (state) draw(article, state);
        }
      }),
    );

    void loadSettings().then((settings) => {
      if (scope.disposed) return;
      mode = settings.insights.lookup;
      redrawAll();
    });
    scope.add(
      watchSettings((settings) => {
        if (settings.insights.lookup === mode) return;
        mode = settings.insights.lookup;
        redrawAll();
      }),
    );

    /* One set of delegated listeners serves every badge on the page. */
    let hoverTimer: Disposer | undefined;
    const badgeOf = (event: Event): HTMLElement | null =>
      event.target instanceof Element ? event.target.closest<HTMLElement>(BADGE) : null;
    const owns = (node: HTMLElement) => shown.has(node);

    scope.listen(
      document,
      'click',
      (event) => {
        const node = badgeOf(event);
        if (!node || !owns(node)) return;
        // The badge sits inside a post that navigates when clicked; this click is ours.
        event.stopPropagation();
        event.preventDefault();
        const handle = node.dataset.bxAcct!;
        const state = node.dataset.state;
        if (state === 'idle' || state === 'failed') {
          node.setAttribute('aria-busy', 'true');
          void accounts.service
            .request(handle, { priority: 'manual', force: state === 'failed' })
            .finally(() => node.removeAttribute('aria-busy'));
        } else if (state === 'loaded' && parts.has('details')) getCard().toggle(node, handle);
      },
      { capture: true },
    );
    scope.listen(
      document,
      'pointerover',
      (event) => {
        const node = badgeOf(event);
        if (!node || !owns(node)) return;
        const from = (event as PointerEvent).relatedTarget;
        if (from instanceof Node && node.contains(from)) return;
        const handle = node.dataset.bxAcct!;
        if (node.dataset.state === 'idle' && mode === 'hover') {
          hoverTimer?.();
          hoverTimer = scope.setTimeout(() => {
            if (node.isConnected && node.dataset.state === 'idle')
              void accounts.service.request(handle, { priority: 'hover' });
          }, HOVER_LOOKUP_DELAY);
        } else if (node.dataset.state === 'loaded' && parts.has('details')) {
          getCard().hoverIn(node, handle);
        }
      },
      { capture: true, passive: true },
    );
    scope.listen(
      document,
      'pointerout',
      (event) => {
        const node = badgeOf(event);
        if (!node || !owns(node)) return;
        const to = (event as PointerEvent).relatedTarget;
        if (to instanceof Node && node.contains(to)) return;
        hoverTimer?.();
        card?.hoverOut();
      },
      { capture: true, passive: true },
    );

    scope.add(() => {
      for (const node of shown) node.remove();
      shown.clear();
      accounts.release(owner);
      card?.close();
    });
  }

  function stop() {
    live?.dispose();
    live = undefined;
    render = undefined;
  }

  return {
    retain(part) {
      parts.set(part, (parts.get(part) ?? 0) + 1);
      if (!live) start();
      else render?.();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (parts.get(part) ?? 1) - 1;
        if (left > 0) parts.set(part, left);
        else parts.delete(part);
        if (!parts.size) stop();
        else render?.();
      };
    },
  };
}
