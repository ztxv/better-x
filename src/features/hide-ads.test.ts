// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveSettings } from '../lib/settings';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { hideAds } from './hide-ads';
import { startFeatures } from './host';
import { createFeatureRegistry } from './registry';

/** A timeline cell, the way X nests it: cellInnerDiv > div > (placementTracking >) article. */
const cell = (id: string, promoted = false) => `
  <div data-testid="cellInnerDiv"><div id="${id}">
    ${promoted ? '<div data-testid="placementTracking">' : '<div>'}
      <article data-testid="tweet"><div data-testid="tweetText">${id}</div></article>
    </div>
  </div></div>`;
const shown = (id: string) => getComputedStyle(document.getElementById(id)!).display !== 'none';

let scope: Scope;
beforeEach(async () => {
  await freshEnvironment();
  scope = new Scope();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-bx-layout');
});
afterEach(() => scope.dispose());

async function turn(on: boolean) {
  await saveSettings({ features: { [hideAds.id]: on } });
}
function start() {
  startFeatures(scope, {} as Runtime, createFeatureRegistry([hideAds]));
}

describe('Hide Ads', () => {
  it('is off by default and changes nothing until switched on', async () => {
    document.body.innerHTML = cell('promo', true) + cell('plain');
    start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hideAds.defaultEnabled).toBe(false);
    expect(shown('promo')).toBe(true);
  });

  it('hides promoted posts, leaves ordinary posts alone, and restores when switched off', async () => {
    document.body.innerHTML =
      cell('promo', true) + cell('plain') + cell('other', true) + cell('plain2');
    start();
    await turn(true);
    expect(shown('promo')).toBe(false);
    expect(shown('other')).toBe(false);
    expect(shown('plain')).toBe(true);
    expect(shown('plain2')).toBe(true);
    await turn(false);
    expect(shown('promo')).toBe(true);
    expect(shown('other')).toBe(true);
  });

  it('covers a promoted post X renders after the feature was switched on', async () => {
    start();
    await turn(true);
    document.body.insertAdjacentHTML('beforeend', cell('late-promo', true) + cell('late-plain'));
    expect(shown('late-promo')).toBe(false);
    expect(shown('late-plain')).toBe(true);
  });

  it('hides the cell’s inner div, not the cell X positions', async () => {
    document.body.innerHTML = cell('promo', true);
    start();
    await turn(true);
    expect(
      getComputedStyle(document.querySelector('[data-testid="cellInnerDiv"]')!).display,
    ).not.toBe('none');
  });

  it('matches nothing in the newer markup shape, which has no test IDs', async () => {
    document.body.innerHTML = `
      <div><div id="tailwind"><article><a href="https://x.com/u/status/1">Post</a></article></div></div>`;
    start();
    await turn(true);
    expect(shown('tailwind')).toBe(true);
  });

  it('hides promoted trends by their badge and keeps ordinary trends', async () => {
    const badge = hideAds.css!.match(/path\[d="([^"]+)"\]/)![1];
    document.body.innerHTML = `
      <div data-testid="trend" id="promo-trend"><svg><path d="${badge}"></path></svg>Promoted</div>
      <div data-testid="trend" id="trend"><svg><path d="M0 0h1"></path></svg>#news</div>`;
    start();
    await turn(true);
    expect(shown('promo-trend')).toBe(false);
    expect(shown('trend')).toBe(true);
    await turn(false);
    expect(shown('promo-trend')).toBe(true);
  });

  it('hides the Ads link in menus and not the same link elsewhere', async () => {
    document.body.innerHTML = `
      <div role="menu"><a id="menu-ads" href="https://ads.x.com/">Ads</a><a id="menu-other" href="/settings">Settings</a></div>
      <article data-testid="tweet"><a id="post-link" href="https://ads.x.com/post">link in a post</a></article>`;
    start();
    await turn(true);
    expect(shown('menu-ads')).toBe(false);
    expect(shown('menu-other')).toBe(true);
    expect(shown('post-link')).toBe(true);
  });
});

// Two things are checked in real Chrome by the smoke test instead, because happy-dom's selector
// engine gets them wrong: that `:has([placementTracking] [tweet])` needs the post inside the
// wrapper (a wrapper with no post is not hidden), and the narrow-layout dialog rule that depends
// on <html data-bx-layout="narrow">.
