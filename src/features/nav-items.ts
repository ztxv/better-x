import { observe } from '../runtime/observe';
import { hide, links } from './css';
import type { FeatureContext, ToggleFeature } from './types';

/**
 * Menu entries X added recently: X Money and Articles. Each is found three ways, so a change to
 * one does not lose it:
 *
 * 1. its link target (`href`), in every place X lists links (see `links`);
 * 2. its accessible name (`aria-label`), which X's navigation sets from the entry's label;
 * 3. its visible label, read by a small scan of the navigation that marks the link with
 *    `data-bx-nav` (see `markByLabel`), for a link with neither of the above.
 *
 * Only a navigation or menu link is ever matched, never a post, a profile tab, or an article
 * shared in the timeline, and never another monetization entry (Creator Studio, Premium).
 *
 * The exact `href`s X uses could not be confirmed from here, so docs/MANUAL-CHECKLIST.md asks
 * for one look at the real navigation.
 */

const MONEY_HREF =
  ':is([href="/i/money"], [href^="/i/money/"], [href="/i/xmoney"], [href^="/i/x_money"])';
const MONEY_LABEL = ':is([aria-label="X Money"], [aria-label="Money"])';
const ARTICLES_HREF =
  ':is([href="/i/articles"], [href^="/i/articles/"], [href="/articles"], [href="/i/article"])';
const ARTICLES_LABEL = '[aria-label="Articles"]';

/** The words a navigation entry shows, compared without case or surrounding space. */
const MONEY_TEXT = /^(x\s+)?money$/i;
const ARTICLES_TEXT = /^articles$/i;

/** Where navigation links live: the side nav and bottom bar, popup menus, and the More dialog. */
const NAV_ROOTS =
  'header[role="banner"] nav, #layers nav, [role="menu"], [aria-labelledby="modal-header"]';
/** The narrow layout's menu is a dialog; it is only navigation while the layout is narrow. */
const NARROW_MENU = '#layers [role="dialog"]';

function scanNav(mark: Array<[RegExp, string]>) {
  const scan = (selector: string, suffix: string) => {
    for (const container of document.querySelectorAll(selector)) {
      for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        // An entry's own label is its visible text; a link that wraps more is not a plain entry.
        const text = link.textContent?.trim() ?? '';
        if (!text || text.length > 24) continue;
        for (const [pattern, name] of mark)
          if (pattern.test(text)) link.setAttribute('data-bx-nav', name + suffix);
      }
    }
  };
  scan(NAV_ROOTS, '');
  // Marked apart, so the rule can apply to it only while the layout is narrow.
  scan(NARROW_MENU, '-dialog');
}

/** Marks navigation links by their visible label, now and as X redraws its navigation. */
function markByLabel(name: string, pattern: RegExp) {
  return ({ scope, runtime }: FeatureContext) => {
    const run = () => scanNav([[pattern, name]]);
    run();
    let queued = false;
    const later = () => {
      if (queued) return;
      queued = true;
      scope.requestFrame(() => {
        queued = false;
        run();
      });
    };
    scope.add(runtime.routes.onRoute(later));
    scope.add(runtime.layout.onLayout(later));
    // X draws menus and dialogs into its overlay root; watch only that, only for added nodes.
    const layers = document.getElementById('layers');
    if (layers) observe(scope, layers, { childList: true, subtree: true }, later);
    const banner = document.querySelector('header[role="banner"]');
    if (banner) observe(scope, banner, { childList: true, subtree: true }, later);
    scope.add(() => {
      for (const link of document.querySelectorAll(`[data-bx-nav^="${name}"]`))
        link.removeAttribute('data-bx-nav');
    });
  };
}

const rule = (href: string, label: string, name: string) =>
  hide(links(href), links(label), [
    `[data-bx-nav="${name}"]`,
    `html[data-bx-layout="narrow"] [data-bx-nav="${name}-dialog"]`,
  ]);

export const hideXMoney: ToggleFeature = {
  id: 'navigation.hideXMoney',
  category: 'navigation',
  kind: 'toggle',
  title: 'Hide X Money',
  description: 'Remove X Money from the menu. Premium, Creator Studio and the other entries stay.',
  keywords: ['money', 'payments', 'wallet', 'xmoney'],
  defaultEnabled: false,
  css: rule(MONEY_HREF, MONEY_LABEL, 'money'),
  activate: markByLabel('money', MONEY_TEXT),
};

export const hideArticles: ToggleFeature = {
  id: 'navigation.hideArticles',
  category: 'navigation',
  kind: 'toggle',
  title: 'Hide Articles',
  description:
    'Remove the Articles entry from the menu. Article posts, and the Articles tab on profiles, are not touched.',
  keywords: ['article', 'long-form', 'writing'],
  defaultEnabled: false,
  css: rule(ARTICLES_HREF, ARTICLES_LABEL, 'articles'),
  activate: markByLabel('articles', ARTICLES_TEXT),
};

export const NAV_ITEM_FEATURES: readonly ToggleFeature[] = [hideXMoney, hideArticles];
