// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveSettings } from '../lib/settings';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { hideGrok } from './hide-grok';
import { startFeatures } from './host';
import { createFeatureRegistry } from './registry';

const shown = (id: string) => getComputedStyle(document.getElementById(id)!).display !== 'none';

/** Every Grok surface the feature covers, each with the unrelated neighbour that must stay. */
const PAGE = `
  <header><nav>
    <a id="nav-grok" href="/i/grok">Grok</a><a id="nav-home" href="/home">Home</a>
  </nav></header>
  <div role="menu"><a id="menu-grok" href="/i/grok">Grok</a><a id="menu-settings" href="/settings">Settings</a></div>
  <div aria-labelledby="modal-header"><a id="more-grok" href="/someone/i/grok">Grok</a><a id="more-other" href="/i/bookmarks">Bookmarks</a></div>
  <div data-testid="GrokDrawer" id="drawer">Drawer</div>
  <button data-testid="grokImgGen" id="imggen">Generate</button><button data-testid="other-button" id="other-button">Other</button>
  <article data-testid="tweet" id="grok-post">
    <button aria-label="Grok actions" id="actions">G</button><button aria-label="Share" id="share">S</button>
    <a id="ask" href="/i/grok">Ask Grok</a><a id="author" href="/groker">groker</a>
    <div data-testid="followups_1" id="followups">prompts</div><nav id="followups-nav">more</nav>
    <div data-testid="tweetText" id="text">I love Grok, said Grok, about Grok</div>
  </article>
  <aside data-testid="sidebarColumn">
    <aside role="complementary" id="grok-promo"><a href="https://grok.com/imagine">Imagine</a></aside>
    <aside role="complementary" id="other-promo"><a href="https://example.com/">Other</a></aside>
  </aside>`;

let scope: Scope;
beforeEach(async () => {
  await freshEnvironment();
  scope = new Scope();
  document.head.innerHTML = '';
  document.body.innerHTML = PAGE;
  document.documentElement.removeAttribute('data-bx-route');
  document.documentElement.removeAttribute('data-bx-layout');
});
afterEach(() => scope.dispose());

const start = () => startFeatures(scope, {} as Runtime, createFeatureRegistry([hideGrok]));
const turn = (on: boolean) => saveSettings({ features: { [hideGrok.id]: on } });

const GROK_SURFACES = [
  'nav-grok',
  'menu-grok',
  'more-grok',
  'drawer',
  'imggen',
  'actions',
  'ask',
  'followups',
  'followups-nav',
  'grok-promo',
];
const OTHER_UI = [
  'nav-home',
  'menu-settings',
  'more-other',
  'other-button',
  'share',
  'author',
  'text',
  'grok-post',
  'other-promo',
];

describe('Hide Grok', () => {
  it('is off by default and hides nothing until switched on', async () => {
    start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hideGrok.defaultEnabled).toBe(false);
    for (const id of [...GROK_SURFACES, ...OTHER_UI]) expect(shown(id), id).toBe(true);
  });

  it('hides each Grok surface and leaves unrelated UI and posts that mention Grok', async () => {
    start();
    await turn(true);
    for (const id of GROK_SURFACES) expect(shown(id), id).toBe(false);
    for (const id of OTHER_UI) expect(shown(id), id).toBe(true);
  });

  it('restores every surface when switched off', async () => {
    start();
    await turn(true);
    await turn(false);
    for (const id of GROK_SURFACES) expect(shown(id), id).toBe(true);
    expect(document.querySelector('style#bx-features')).toBeNull();
  });

  it('covers Grok surfaces X renders after it was switched on', async () => {
    start();
    await turn(true);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="menu"><a id="late-grok" href="/i/grok">Grok</a><a id="late-other" href="/home">Home</a></div>',
    );
    expect(shown('late-grok')).toBe(false);
    expect(shown('late-other')).toBe(true);
  });

  it('hides the narrow layout’s Grok entries in its bottom bar', async () => {
    document.body.innerHTML =
      '<nav><a id="tab-grok" href="/i/grok">G</a><a id="tab-home" href="/home">H</a></nav>';
    start();
    await turn(true);
    expect(shown('tab-grok')).toBe(false);
    expect(shown('tab-home')).toBe(true);
  });

  it('hides the Grok summary above search results, on the search page only', async () => {
    const results = (id: string) => `
      <div data-testid="primaryColumn"><div><div id="${id}"><div data-testid="followups_search">Grok summary</div></div>
      <div id="${id}-results">results</div></div></div>`;
    document.documentElement.setAttribute('data-bx-route', 'search');
    document.body.innerHTML = results('summary');
    start();
    await turn(true);
    expect(shown('summary')).toBe(false);
    expect(shown('summary-results')).toBe(true);
  });
});

// Checked in real Chrome by the smoke test instead, where they are meaningful: the narrow layout's
// Grok entry in its menu dialog and the search-summary rule's dependence on the page route
// (happy-dom does not re-evaluate an ancestor attribute that changes after styles were computed).
