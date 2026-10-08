import { observe } from '../runtime/observe';
import type { Scope } from '../runtime/scope';
import { waitFor } from '../runtime/wait';
import type { FeatureDef } from './types';

/** Set on <html> only while the For you tab is safe to hide. */
const HIDE_ATTR = 'data-bx-hide-for-you';
/** Consecutive clicks on Following that did not leave it selected, before giving up. */
const MAX_FAILED_CLICKS = 2;
/** How long after a click to confirm Following took, so a click that did nothing is noticed. */
const VERIFY_MS = 400;

/**
 * Where X puts the Home tabs: a `nav` holding a tab list, in the primary column on the wide
 * layout and in the top bar on the narrow one (Control Panel for Twitter uses the same split). The
 * tabs are `For you` first and `Following` second, then any pinned lists.
 */
const HOME_NAV_AREA = '[data-testid="TopNavBar"], [data-testid="primaryColumn"]';

const isSelected = (tab: Element) => tab.getAttribute('aria-selected') === 'true';

/**
 * Makes Following the Home timeline and hides the For you tab.
 *
 * Following is selected first: the tab is hidden (an attribute on <html> that the CSS keys on) only
 * once the user is, or is being moved, to Following, and is shown again if the click does not take
 * (so no one is left on a hidden, selected tab). A click happens only when For you is the selected
 * tab, never on other pages, and after two failed attempts in a row it stops. A success resets
 * that count, so X putting For you back (pressing Home again, the tabs re-rendering) is corrected
 * each time without ever looping.
 *
 * It follows the shared runtime: the Home page and layout come from the route and layout
 * services, a small managed observer watches only the tab list's selection, a short timer confirms
 * each click took, and the post stream's batches notice when X has replaced the tabs (an
 * `isConnected` check, no document query). Switching it off hides nothing, clicks
 * nothing and does not navigate; X's tabs are as they were.
 */
export const hideForYou: FeatureDef = {
  id: 'feed.hideForYou',
  category: 'feed',
  title: 'Hide For You',
  description: 'Use Following instead of the For You timeline.',
  kind: 'toggle',
  defaultEnabled: false,
  css: `
html[${HIDE_ATTR}] :is([data-testid="primaryColumn"], [data-testid="TopNavBar"]) nav [role="tablist"] > div:first-child {
  display: none !important;
}`,
  activate({ scope, runtime: { routes, layout, posts } }) {
    const root = document.documentElement;
    const setHidden = (hidden: boolean) =>
      hidden ? root.setAttribute(HIDE_ATTR, '') : root.removeAttribute(HIDE_ATTR);
    scope.add(() => setHidden(false));

    let tablist: HTMLElement | null = null;
    let watching: Scope | null = null;
    let failedClicks = 0;

    /**
     * The Home tab list for the current layout (the other layout's if only that one exists). It runs
     * whenever the page changes while waiting for the tabs, so it walks the page's few `nav`
     * elements instead of querying the whole document.
     */
    const findTablist = (): HTMLElement | null => {
      let other: HTMLElement | null = null;
      for (const nav of document.getElementsByTagName('nav')) {
        const list = nav.querySelector<HTMLElement>('[role="tablist"]');
        const area = list && nav.closest(HOME_NAV_AREA);
        if (!list || !area) continue;
        const inTopBar = area.getAttribute('data-testid') === 'TopNavBar';
        if (inTopBar === (layout.layout === 'narrow')) return list;
        other ??= list;
      }
      return other;
    };

    function watch(list: HTMLElement) {
      watching?.dispose();
      watching = scope.child();
      tablist = list;
      failedClicks = 0;
      observe(
        watching,
        list,
        { attributes: true, attributeFilter: ['aria-selected'], subtree: true },
        ensure,
      );
    }

    /** Brings the tabs to the wanted state, if the Home tabs are on screen. */
    function ensure() {
      if (routes.page.id !== 'home') return setHidden(false);
      const list = tablist?.isConnected ? tablist : findTablist();
      if (!list) return setHidden(false);
      if (list !== tablist) watch(list);
      const forYou = list.children[0]?.querySelector('[role="tab"]');
      const following = list.children[1]?.querySelector<HTMLElement>('[role="tab"]');
      // Cannot tell which tab is which: leave X's tabs alone rather than guess.
      if (!forYou || !following) return setHidden(false);
      if (isSelected(following)) failedClicks = 0;
      else if (isSelected(forYou)) {
        if (failedClicks >= MAX_FAILED_CLICKS) return setHidden(false);
        failedClicks++;
        following.click();
        scope.setTimeout(ensure, VERIFY_MS);
      }
      setHidden(true);
    }

    let pending: Scope | null = null;
    /** Starts over for a visit to Home: find the tabs (waiting if they are not rendered yet). */
    function enter() {
      pending?.dispose();
      pending = null;
      watching?.dispose();
      watching = null;
      tablist = null;
      failedClicks = 0;
      if (routes.page.id !== 'home') return setHidden(false);
      if (findTablist()) return ensure();
      // Not rendered yet: wait for it, until the feature ends or the user leaves this page.
      const waiting = (pending = scope.child());
      waiting.add(routes.pageScope.add(() => waiting.dispose()));
      waitFor(findTablist, { signal: waiting.signal, attributes: false }).then(
        () => {
          waiting.dispose();
          ensure();
        },
        () => {},
      );
    }

    scope.add(routes.onRoute((change) => change.pageChanged && enter()));
    scope.add(layout.onLayout(enter));
    // X re-renders the tabs (for example when pinned lists load). Noticed cheaply: a batch of posts is
    // when it happens, and the only question is whether the tabs we knew are still on the page.
    scope.add(
      posts.onBatch(() => {
        if (tablist && !tablist.isConnected && routes.page.id === 'home') enter();
      }),
    );
    enter();
  },
};
