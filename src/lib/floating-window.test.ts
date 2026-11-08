import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDTH,
  WINDOW_BOUNDS_KEY,
  WINDOW_ID_KEY,
  WINDOW_PAGE,
  defaultBounds,
  normalizeBounds,
  openFloatingWindow,
  type Bounds,
  type WindowApi,
} from './floating-window';
import { applyLaunchMode, type LaunchApi } from './launch-mode';
import { normalizeSettings } from './settings';

/** Chrome's windows and storage as a small in-memory world. */
function fakeWindows(browser?: Partial<Bounds>) {
  const store: Record<string, unknown> = {};
  const open = new Set<number>();
  const created: Array<{ url: string; bounds: Partial<Bounds> }> = [];
  const focused: number[] = [];
  let next = 100;
  const api: WindowApi = {
    exists: async (id) => open.has(id),
    focus: async (id) => void focused.push(id),
    create: async (url, bounds) => {
      created.push({ url, bounds });
      open.add(next);
      return next++;
    },
    lastFocused: async () => browser,
    read: async (key) => store[key],
    write: async (key, value) => void (store[key] = value),
  };
  return { api, store, open, created, focused };
}

describe('floating window', () => {
  it('opens the first time as tall as the browser window, against its right edge', async () => {
    const world = fakeWindows({ left: 0, top: 0, width: 1920, height: 1040 });
    await openFloatingWindow(world.api);
    expect(world.created).toEqual([
      {
        url: WINDOW_PAGE,
        bounds: { left: 1920 - DEFAULT_WIDTH, top: 0, width: DEFAULT_WIDTH, height: 1040 },
      },
    ]);
    expect(world.store[WINDOW_ID_KEY]).toBe(100);
  });

  it('focuses the window that is already open instead of opening another', async () => {
    const world = fakeWindows();
    await openFloatingWindow(world.api);
    await openFloatingWindow(world.api);
    expect(world.created).toHaveLength(1);
    expect(world.focused).toEqual([100]);
  });

  it('opens a new one where the person last left it, once the old one is closed', async () => {
    const world = fakeWindows({ left: 0, top: 0, width: 1920, height: 1040 });
    world.store[WINDOW_BOUNDS_KEY] = { left: 50, top: 20, width: 600, height: 1300 };
    world.store[WINDOW_ID_KEY] = 7; // a window that no longer exists
    await openFloatingWindow(world.api);
    expect(world.created[0]!.bounds).toEqual({ left: 50, top: 20, width: 600, height: 1300 });
  });

  it('falls back to a size Chrome accepts when the remembered spot is off screen', async () => {
    const world = fakeWindows();
    world.store[WINDOW_BOUNDS_KEY] = { left: 5000, top: 0, width: 500, height: 900 };
    const create = world.api.create;
    world.api.create = async (url, bounds) => {
      if (bounds.left === 5000)
        throw new Error('Bounds must be at least 50% within visible screen space.');
      return create(url, bounds);
    };
    await openFloatingWindow(world.api);
    expect(world.created.map((c) => c.bounds)).toEqual([{ width: DEFAULT_WIDTH, height: 600 }]);
    expect(world.store[WINDOW_ID_KEY]).toBe(100);
  });

  it('ignores remembered bounds that are not sensible', () => {
    expect(normalizeBounds({ left: 1, top: 2, width: 500.4, height: 900 })).toEqual({
      left: 1,
      top: 2,
      width: 500,
      height: 900,
    });
    for (const bad of [
      null,
      'x',
      { left: 0, top: 0, width: 100, height: 900 },
      { left: 0, top: 0, width: 500, height: 99999 },
      { left: 0, top: 0, width: 500 },
      { left: Number.NaN, top: 0, width: 500, height: 900 },
    ])
      expect(normalizeBounds(bad)).toBeNull();
  });

  it('has a sensible size with no browser window to go by', () => {
    expect(defaultBounds()).toEqual({ left: 80, top: 40, width: DEFAULT_WIDTH, height: 900 });
  });

  it('is a launch mode: no popup and the panel not on click, so the click reaches the worker', async () => {
    const state = { popup: 'initial', panelOnClick: true };
    const api: LaunchApi = {
      setPopup: async ({ popup }) => void (state.popup = popup),
      getPopup: async () => state.popup,
      setPanelBehavior: async ({ openPanelOnActionClick }) =>
        void (state.panelOnClick = openPanelOnActionClick),
    };
    await applyLaunchMode('window', api);
    expect(state).toEqual({ popup: '', panelOnClick: false });
    expect(normalizeSettings({ openAs: 'window' }).openAs).toBe('window');
  });
});
