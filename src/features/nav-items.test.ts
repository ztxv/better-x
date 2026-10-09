// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import { settle, tableTransport, testRuntime } from '../test/insights-env';
import { hideArticles, hideXMoney, NAV_ITEM_FEATURES } from './nav-items';

const PAGE = `
  <header role="banner"><nav>
    <a id="home" href="/home"><span>Home</span></a>
    <a id="money-href" href="/i/money"><span>X Money</span></a>
    <a id="articles-href" href="/i/articles"><span>Articles</span></a>
    <a id="money-text" href="/i/newmoneypage"><div><span>Money</span></div></a>
    <a id="articles-text" href="/i/newreading"><div><span>Articles</span></div></a>
    <a id="premium" href="/i/premium_sign_up"><span>Premium</span></a>
    <a id="creators" href="/u/creators/studio"><span>Creator Studio</span></a>
  </nav></header>
  <main>
    <nav id="profile-tabs"><a id="profile-articles" href="/u/articles"><span>Articles</span></a></nav>
    <article><a id="post-link" href="/i/article/9"><span>Articles</span></a></article>
  </main>
  <div id="layers"></div>`;

let cleanup: Array<() => void> = [];
beforeEach(async () => {
  await freshEnvironment();
  document.body.innerHTML = PAGE;
  cleanup = [];
});
afterEach(() => {
  cleanup.forEach((fn) => fn());
  document.body.innerHTML = '';
});

function activate(feature: typeof hideXMoney) {
  const env = testRuntime(tableTransport({}).transport);
  cleanup.push(() => env.scope.dispose());
  const own = env.scope.child();
  feature.activate!({ scope: own, runtime: env.runtime });
  return { ...env, own };
}
const marked = (name: string) =>
  [...document.querySelectorAll(`[data-bx-nav="${name}"]`)].map((n) => n.id);

describe('navigation entries X added', () => {
  it('are two independent features in the Navigation category, off by default', () => {
    expect(NAV_ITEM_FEATURES.map((f) => f.id)).toEqual([
      'navigation.hideXMoney',
      'navigation.hideArticles',
    ]);
    for (const f of NAV_ITEM_FEATURES) {
      expect(f.category).toBe('navigation');
      expect(f.defaultEnabled).toBe(false);
    }
  });

  it('match by link target in CSS, and each only its own', () => {
    expect(hideXMoney.css).toContain('[href="/i/money"]');
    expect(hideXMoney.css).not.toContain('articles');
    expect(hideArticles.css).toContain('[href="/i/articles"]');
    expect(hideArticles.css).not.toContain('money');
    // Never the profile Articles tab (/handle/articles) or premium and creator entries.
    expect(hideArticles.css).not.toContain('$="/articles"');
    expect(hideXMoney.css).not.toMatch(/premium|creators|monetization/);
  });

  it('mark a navigation link by its label when its address is not one we know', async () => {
    activate(hideXMoney);
    expect(marked('money')).toEqual(['money-href', 'money-text']);
    expect(marked('articles')).toEqual([]);
  });

  it('never mark a profile tab, a post’s link, or other entries', async () => {
    activate(hideArticles);
    expect(marked('articles')).toEqual(['articles-href', 'articles-text']);
    expect(document.getElementById('profile-articles')!.hasAttribute('data-bx-nav')).toBe(false);
    expect(document.getElementById('post-link')!.hasAttribute('data-bx-nav')).toBe(false);
    for (const id of ['home', 'premium', 'creators'])
      expect(document.getElementById(id)!.hasAttribute('data-bx-nav')).toBe(false);
  });

  it('follow X redrawing its navigation, then let go when switched off', async () => {
    const { own } = activate(hideArticles);
    const nav = document.querySelector('header nav')!;
    nav.innerHTML = '<a id="again" href="/elsewhere"><span>Articles</span></a>';
    await settle();
    expect(marked('articles')).toEqual(['again']);
    own.dispose();
    expect(document.querySelectorAll('[data-bx-nav]')).toHaveLength(0);
  });

  it('reach into X’s overlay root, where menus and dialogs are drawn', async () => {
    activate(hideXMoney);
    document.getElementById('layers')!.innerHTML =
      '<div role="menu"><a id="menu-money" href="/i/another"><span>X Money</span></a></div>';
    await settle();
    expect(marked('money')).toContain('menu-money');
  });
});
