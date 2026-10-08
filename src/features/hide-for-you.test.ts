// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from '../lib/settings';
import type { Runtime } from '../runtime';
import type { Layout, LayoutService } from '../runtime/layout';
import type { PostStream } from '../runtime/posts';
import { createRouteService } from '../runtime/route';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { hideForYou } from './hide-for-you';
import { startFeatures } from './host';
import { createFeatureRegistry } from './registry';

const ATTR = 'data-bx-hide-for-you';
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Home tabs as X renders them, which select themselves on click. `stubborn` ignores clicks. */
function tabsMarkup(selected: 'foryou' | 'following', count = 2) {
  const tab = (id: string, label: string, on: boolean) =>
    `<div><a role="tab" id="${id}" href="/home" aria-selected="${on}">${label}</a></div>`;
  return `<div data-testid="primaryColumn"><nav><div role="tablist" id="list">
    ${tab('foryou', 'For you', selected === 'foryou')}
    ${count > 1 ? tab('following', 'Following', selected === 'following') : ''}
    ${count > 2 ? tab('pinned', 'My list', false) : ''}
  </div></nav></div>`;
}

interface Harness {
  clicks: string[];
  go(url: string): void;
  batch(): void;
  setLayout(layout: Layout): void;
  turn(on: boolean): Promise<void>;
  scope: Scope;
  stubborn: { value: boolean };
}

function setup(html: string, start = '/home'): Harness {
  document.body.innerHTML = html;
  const clicks: string[] = [];
  const stubborn = { value: false };
  const onClick = (event: Event) => {
    const tab = (event.target as Element).closest('[role="tab"]');
    if (!tab) return;
    event.preventDefault();
    clicks.push(tab.id);
    if (stubborn.value) return;
    document
      .querySelectorAll('[role="tab"]')
      .forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
  };
  document.body.addEventListener('click', onClick, true);

  const scope = new Scope();
  scope.add(() => document.body.removeEventListener('click', onClick, true));
  const navigation = new EventTarget();
  const location = { pathname: start, search: '' };
  const routes = createRouteService(scope, { location, navigation });
  const batchListeners = new Set<() => void>();
  const layoutListeners = new Set<(layout: Layout, previous: Layout | null) => void>();
  const layoutState = { layout: 'wide' as Layout };
  const layout: LayoutService = {
    get layout() {
      return layoutState.layout;
    },
    onLayout(listener) {
      layoutListeners.add(listener);
      return () => layoutListeners.delete(listener);
    },
  };
  const posts = {
    onBatch(listener: () => void) {
      batchListeners.add(listener);
      return () => batchListeners.delete(listener);
    },
  } as unknown as PostStream;
  const runtime = { routes, layout, posts } as unknown as Runtime;
  startFeatures(scope, runtime, createFeatureRegistry([hideForYou]));
  return {
    clicks,
    stubborn,
    scope,
    go(url) {
      const [pathname = '/', search = ''] = url.split('?');
      location.pathname = pathname;
      location.search = search ? `?${search}` : '';
      navigation.dispatchEvent(new Event('currententrychange'));
    },
    batch: () => batchListeners.forEach((listener) => listener()),
    setLayout(next) {
      const previous = layoutState.layout;
      layoutState.layout = next;
      layoutListeners.forEach((listener) => listener(next, previous));
    },
    turn: async (on) => {
      await saveSettings({ features: { [hideForYou.id]: on } });
    },
  };
}

const selected = (id: string) => document.getElementById(id)!.getAttribute('aria-selected');
const hidden = () => document.documentElement.hasAttribute(ATTR);
const forYouDisplay = () =>
  getComputedStyle(document.getElementById('foryou')!.parentElement!).display;

let harness: Harness;
beforeEach(async () => {
  await freshEnvironment();
  document.head.innerHTML = '';
  document.documentElement.removeAttribute(ATTR);
});
afterEach(() => harness?.scope.dispose());

describe('Hide For You: making Following the Home timeline', () => {
  it('is off by default and changes nothing', async () => {
    harness = setup(tabsMarkup('foryou'));
    await settle();
    expect(hideForYou.defaultEnabled).toBe(false);
    expect(harness.clicks).toEqual([]);
    expect(hidden()).toBe(false);
  });

  it('selects Following when For you is showing, then hides For you', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    expect(harness.clicks).toEqual(['following']);
    expect(selected('following')).toBe('true');
    expect(hidden()).toBe(true);
    expect(forYouDisplay()).toBe('none');
    expect(getComputedStyle(document.getElementById('following')!.parentElement!).display).not.toBe(
      'none',
    );
  });

  it('only hides when Following is already the selected tab', async () => {
    harness = setup(tabsMarkup('following'));
    await harness.turn(true);
    expect(harness.clicks).toEqual([]);
    expect(hidden()).toBe(true);
  });

  it('does not click again on later activity once Following is selected', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    for (let i = 0; i < 10; i++) harness.batch();
    await settle();
    expect(harness.clicks).toEqual(['following']);
  });

  it('leaves a pinned list alone when that is the selected tab', async () => {
    harness = setup(tabsMarkup('foryou', 3));
    document.getElementById('foryou')!.setAttribute('aria-selected', 'false');
    document.getElementById('pinned')!.setAttribute('aria-selected', 'true');
    await harness.turn(true);
    expect(harness.clicks).toEqual([]);
    expect(selected('pinned')).toBe('true');
    expect(hidden()).toBe(true);
  });

  it('waits for tabs X has not rendered yet, then acts once', async () => {
    harness = setup('<div data-testid="primaryColumn"></div>');
    await harness.turn(true);
    expect(hidden()).toBe(false);
    document.body.innerHTML = tabsMarkup('foryou');
    await settle();
    expect(harness.clicks).toEqual(['following']);
    expect(hidden()).toBe(true);
  });

  it('uses the top bar’s tabs in the narrow layout', async () => {
    const narrow = tabsMarkup('foryou').replace('primaryColumn', 'TopNavBar');
    harness = setup('<div data-testid="primaryColumn"><nav></nav></div>' + narrow);
    harness.setLayout('narrow');
    await harness.turn(true);
    expect(harness.clicks).toEqual(['following']);
    expect(forYouDisplay()).toBe('none');
  });
});

describe('Hide For You: never strands anyone on a hidden tab', () => {
  it('shows For you again when Following cannot be selected, after two tries only', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      harness = setup(tabsMarkup('foryou'));
      harness.stubborn.value = true;
      await harness.turn(true);
      expect(harness.clicks).toEqual(['following']);
      expect(hidden()).toBe(true);
      // Each click is checked a moment later; the second try fails too, so For you comes back.
      vi.advanceTimersByTime(500);
      expect(harness.clicks).toEqual(['following', 'following']);
      vi.advanceTimersByTime(500);
      expect(hidden()).toBe(false);
      expect(selected('foryou')).toBe('true');
      for (let i = 0; i < 10; i++) harness.batch();
      vi.advanceTimersByTime(5000);
      expect(harness.clicks).toEqual(['following', 'following']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing when it cannot tell which tab is Following', async () => {
    harness = setup(tabsMarkup('foryou', 1));
    await harness.turn(true);
    harness.batch();
    expect(harness.clicks).toEqual([]);
    expect(hidden()).toBe(false);
  });
});

describe('Hide For You: routes', () => {
  it('does nothing on other pages, even with tabs and For you selected', async () => {
    harness = setup(tabsMarkup('foryou'), '/elonmusk');
    await harness.turn(true);
    harness.batch();
    expect(harness.clicks).toEqual([]);
    expect(hidden()).toBe(false);
  });

  it('stops hiding when leaving Home, and acts again when returning to it', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    expect(hidden()).toBe(true);
    harness.go('/elonmusk');
    expect(hidden()).toBe(false);
    // X shows For you again when Home is re-entered.
    document.getElementById('foryou')!.setAttribute('aria-selected', 'true');
    document.getElementById('following')!.setAttribute('aria-selected', 'false');
    harness.go('/home');
    expect(harness.clicks).toEqual(['following', 'following']);
    expect(hidden()).toBe(true);
  });

  it('keeps the tab hidden while a modal such as the composer is open over Home', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    harness.go('/compose/post');
    expect(hidden()).toBe(true);
    harness.go('/home');
    expect(hidden()).toBe(true);
    expect(harness.clicks).toEqual(['following']);
  });

  it('corrects X putting For you back (pressing Home again) every time, with no loop', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    for (let round = 0; round < 4; round++) {
      document.getElementById('foryou')!.setAttribute('aria-selected', 'true');
      document.getElementById('following')!.setAttribute('aria-selected', 'false');
      await settle();
    }
    expect(harness.clicks).toHaveLength(5);
    expect(selected('following')).toBe('true');
  });

  it('re-checks when X replaces the tabs, selecting Following once for the new tabs', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    document.body.innerHTML = tabsMarkup('foryou');
    harness.batch();
    expect(harness.clicks).toEqual(['following', 'following']);
    expect(selected('following')).toBe('true');
    expect(hidden()).toBe(true);
  });
});

describe('Hide For You: switching it off', () => {
  it('shows For you again, stops forcing Following, and does not navigate', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    await harness.turn(false);
    expect(hidden()).toBe(false);
    expect(forYouDisplay()).not.toBe('none');
    expect(harness.clicks).toEqual(['following']);
    // The user may go back to For you, and nothing pushes them away again.
    document.getElementById('foryou')!.setAttribute('aria-selected', 'true');
    document.getElementById('following')!.setAttribute('aria-selected', 'false');
    harness.batch();
    harness.go('/elonmusk');
    harness.go('/home');
    await settle();
    expect(harness.clicks).toEqual(['following']);
    expect(selected('foryou')).toBe('true');
  });

  it('releases its observers and leaves no marker, however often it is toggled', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    harness = setup(tabsMarkup('foryou'));
    for (let i = 0; i < 3; i++) {
      await harness.turn(true);
      await harness.turn(false);
    }
    expect(hidden()).toBe(false);
    expect(document.querySelector('style#bx-features')).toBeNull();
    expect(disconnect.mock.calls.length).toBeGreaterThanOrEqual(3);
    disconnect.mockRestore();
  });

  it('is released with the content script', async () => {
    harness = setup(tabsMarkup('foryou'));
    await harness.turn(true);
    harness.scope.dispose();
    expect(hidden()).toBe(false);
  });
});
