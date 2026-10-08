// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { createSidebarService } from '../runtime/sidebar';
import { climbToCard, hiddenCardAttribute, hideSidebarCards } from './sidebar-cards';

const CARD = 'border:1px solid #ccc;padding:12px;margin-bottom:16px';

/** X's sidebar: column > 4 wrappers > the container whose children are the cards. */
const sidebar = (cards: string) => `<div data-testid="primaryColumn" id="primary"></div>
  <aside data-testid="sidebarColumn" id="sidebar"><div><div><div><div><div id="sections">${cards}</div></div></div></div></div></aside>`;
const wtfAside = `<aside role="complementary" id="aside-wtf"><h2>Who to follow</h2><div data-testid="UserCell">Someone</div></aside>`;
const CARDS = `
  <div id="sec-search"><div role="search"><input type="search"></div></div>
  <div id="sec-news"><div data-testid="news_sidebar">News</div></div>
  <div id="sec-trends"><section><div aria-label="Trends"><div data-testid="trend">#a</div></div></section></div>
  <div id="sec-wtf" style="${CARD}"><div id="wrap"><div id="wrap2">${wtfAside}</div></div></div>
  <div id="sec-other"><aside role="complementary" id="aside-other"><a href="https://example.com">x</a></aside></div>`;

const $ = (id: string) => document.getElementById(id)! as HTMLElement;
const column = () => $('sidebar');

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('climbToCard', () => {
  it('takes the whole card, border wrapper included, not just the aside', () => {
    document.body.innerHTML = sidebar(CARDS);
    expect(climbToCard($('aside-wtf'), column())).toBe($('sec-wtf'));
  });

  it('stops at the card whatever the number of wrappers inside it', () => {
    for (const depth of [0, 1, 4, 6]) {
      const wrapped = '<div>'.repeat(depth) + wtfAside + '</div>'.repeat(depth);
      document.body.innerHTML = sidebar(
        `<div id="sec-search"><div role="search"></div></div><div id="sec-wtf">${wrapped}</div><div id="sec-x"></div>`,
      );
      expect(climbToCard($('aside-wtf'), column()), `depth ${depth}`).toBe($('sec-wtf'));
    }
  });

  it('never takes a neighbour: search, news, trends and other cards are not part of it', () => {
    document.body.innerHTML = sidebar(CARDS);
    const card = climbToCard($('aside-wtf'), column());
    for (const id of ['sec-search', 'sec-news', 'sec-trends', 'sec-other'])
      expect(card.contains($(id)), id).toBe(false);
    expect(climbToCard($('aside-other'), column())).toBe($('sec-other'));
  });

  it('uses siblings to find the card when the sections container is not where expected', () => {
    // One wrapper level fewer than X's: nothing matches the sections selector.
    document.body.innerHTML = `<div data-testid="primaryColumn"></div>
      <aside data-testid="sidebarColumn" id="sidebar"><div><div id="list">
        <div id="sec-search"><div role="search"></div></div>
        <div id="sec-wtf" style="${CARD}"><div>${wtfAside}</div></div>
        <div id="sec-news"><div data-testid="news_sidebar"></div></div>
      </div></div></aside>`;
    expect(climbToCard($('aside-wtf'), column())).toBe($('sec-wtf'));
  });

  it('never hides the whole sidebar when the structure is a surprise', () => {
    // Only child all the way up: nothing says where the card ends.
    document.body.innerHTML = `<div data-testid="primaryColumn"></div>
      <aside data-testid="sidebarColumn" id="sidebar"><div id="only"><div>${wtfAside}</div></div></aside>`;
    const card = climbToCard($('aside-wtf'), column());
    expect(card.parentElement).not.toBe(column());
    expect(card.contains($('aside-wtf'))).toBe(true);
    expect(card).not.toBe($('only'));
  });

  it('does not climb out of a wrapper shared with another card', () => {
    document.body.innerHTML = sidebar(
      `<div id="both"><div id="a">${wtfAside}</div><div id="b"><aside role="complementary" id="aside-b"></aside></div></div><div id="sec-z"></div>`,
    );
    expect(climbToCard($('aside-wtf'), column())).toBe($('a'));
  });
});

describe('hideSidebarCards', () => {
  let scope: Scope;
  let route = 'home';
  const routeListeners = new Set<() => void>();
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const later = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await frame();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const attribute = hiddenCardAttribute('whoToFollow');

  function start() {
    const sidebarService = createSidebarService(scope, []);
    const runtime = {
      sidebar: sidebarService,
      routes: {
        get route() {
          return { id: route };
        },
        onRoute(listener: () => void) {
          routeListeners.add(listener);
          return () => routeListeners.delete(listener);
        },
      },
    } as unknown as Runtime;
    const activate = hideSidebarCards('whoToFollow', (col, { runtime: r }) =>
      r.routes.route.id === 'post'
        ? []
        : [...col.querySelectorAll<HTMLElement>('aside[role="complementary"]')].filter((aside) =>
            aside.querySelector('[data-testid="UserCell"]'),
          ),
    );
    const own = scope.child();
    activate({ scope: own, runtime });
    return own;
  }

  beforeEach(() => {
    scope = new Scope();
    route = 'home';
    routeListeners.clear();
  });
  afterEach(() => scope.dispose());

  it('marks the whole card, and only that card', async () => {
    document.body.innerHTML = sidebar(CARDS);
    start();
    await later();
    expect($('sec-wtf').hasAttribute(attribute)).toBe(true);
    for (const id of ['sec-search', 'sec-news', 'sec-trends', 'sec-other', 'aside-wtf'])
      expect($(id).hasAttribute(attribute), id).toBe(false);
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(1);
  });

  it('marks a card X renders later, and one X re-renders', async () => {
    document.body.innerHTML = sidebar(CARDS.replace(wtfAside, ''));
    start();
    await later();
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(0);
    // The module arrives (X loads who to follow after the rest of the sidebar).
    $('wrap2').innerHTML = wtfAside;
    await later();
    expect($('sec-wtf').hasAttribute(attribute)).toBe(true);
    // X throws the sections away and renders them again.
    $('sections').innerHTML = CARDS;
    await later();
    expect($('sec-wtf').hasAttribute(attribute)).toBe(true);
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(1);
  });

  it('lets go of a card that no longer holds what it looked for', async () => {
    document.body.innerHTML = sidebar(CARDS);
    start();
    await later();
    $('wrap2').innerHTML = '<p>Nothing to suggest</p>';
    await later();
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(0);
  });

  it('follows the route: Relevant people stays on a post page and goes again elsewhere', async () => {
    document.body.innerHTML = sidebar(CARDS);
    start();
    await later();
    route = 'post';
    routeListeners.forEach((listener) => listener());
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(0);
    route = 'home';
    routeListeners.forEach((listener) => listener());
    expect($('sec-wtf').hasAttribute(attribute)).toBe(true);
  });

  it('removes every mark when the feature stops, and when the sidebar goes away', async () => {
    document.body.innerHTML = sidebar(CARDS);
    const own = start();
    await later();
    own.dispose();
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(0);
  });

  it('does nothing while the sidebar is not on the page', async () => {
    document.body.innerHTML = '<div data-testid="primaryColumn"></div>';
    start();
    await later();
    expect(document.querySelectorAll(`[${attribute}]`)).toHaveLength(0);
  });

  it('survives the sidebar column being replaced', async () => {
    document.body.innerHTML = sidebar(CARDS);
    start();
    await later();
    const fresh = document.createElement('div');
    fresh.innerHTML = sidebar(CARDS);
    const newColumn = fresh.querySelector('aside')!;
    column().replaceWith(newColumn);
    await later();
    expect(newColumn.querySelectorAll(`[${attribute}]`)).toHaveLength(1);
  });
});

describe('hideSidebarCards: stray marks', () => {
  it('releases a card that carries the mark without having been marked by the feature', async () => {
    const scope = new Scope();
    document.body.innerHTML = sidebar(CARDS.replace(wtfAside, '<p>empty</p>'));
    const attribute = hiddenCardAttribute('whoToFollow');
    $('sec-wtf').setAttribute(attribute, '');
    const service = createSidebarService(scope, []);
    const runtime = {
      sidebar: service,
      routes: { route: { id: 'home' }, onRoute: () => () => {} },
    } as unknown as Runtime;
    hideSidebarCards('whoToFollow', () => [])({ scope: scope.child(), runtime });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect($('sec-wtf').hasAttribute(attribute)).toBe(false);
    scope.dispose();
  });
});
