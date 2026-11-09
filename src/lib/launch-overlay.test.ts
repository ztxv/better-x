import { beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import {
  applyLaunchMode,
  followLaunchMode,
  isXUrl,
  launchModeOf,
  routeActionClick,
  type ClickApi,
  type LaunchApi,
  type LaunchMode,
} from './launch-mode';
import { normalizeSettings, saveSettings } from './settings';

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

function fakeLaunch() {
  const state = { popup: 'initial', panelOnClick: false };
  const api: LaunchApi = {
    setPopup: async ({ popup }) => void (state.popup = popup),
    getPopup: async () => state.popup,
    setPanelBehavior: async ({ openPanelOnActionClick }) =>
      void (state.panelOnClick = openPanelOnActionClick),
  };
  return { api, state };
}

/** Records every call, and whether it happened before anything was awaited. */
function fakeClick() {
  const calls: string[] = [];
  let sync = true;
  const api: ClickApi = {
    enablePanel: (tabId) => void calls.push(`enable:${tabId}${sync ? ':sync' : ''}`),
    openSidePanel: async (windowId) => void calls.push(`panel:${windowId}${sync ? ':sync' : ''}`),
    toggleOverlay: async (tabId) => void calls.push(`toggle:${tabId}`),
    openFloatingWindow: async () => void calls.push('window'),
  };
  const run = (
    tab: Parameters<typeof routeActionClick>[0],
    mode: LaunchMode | null,
    stored: LaunchMode = 'overlay',
  ) => {
    sync = true;
    const done = routeActionClick(tab, mode, api, async () => stored);
    sync = false;
    return done;
  };
  return { calls, run };
}

const X_TAB = { id: 7, windowId: 2, url: 'https://x.com/home' };
const OTHER_TAB = { id: 8, windowId: 2, url: 'https://example.org/' };

beforeEach(async () => {
  await freshEnvironment();
});

describe('the launch mode from settings', () => {
  it('is overlay only for side panel mode with the overlay chosen', () => {
    expect(launchModeOf(normalizeSettings({}))).toBe('sidepanel');
    expect(launchModeOf(normalizeSettings({ panelMode: 'overlay' }))).toBe('overlay');
    expect(launchModeOf(normalizeSettings({ panelMode: 'overlay', openAs: 'popup' }))).toBe(
      'popup',
    );
    expect(launchModeOf(normalizeSettings({ panelMode: 'overlay', openAs: 'window' }))).toBe(
      'window',
    );
  });

  it("configures Chrome as side panel mode, so other sites' clicks never need the worker", async () => {
    const { api, state } = fakeLaunch();
    await applyLaunchMode('overlay', api);
    expect(state).toEqual({ popup: '', panelOnClick: true });
  });

  it('switching to overlay changes nothing Chrome reads, and leaving it neither', async () => {
    const { api, state } = fakeLaunch();
    const seen: LaunchMode[] = [];
    const stop = followLaunchMode(api, undefined, (mode) => seen.push(mode));
    await settle();
    await saveSettings({ panelMode: 'overlay' });
    await settle();
    expect(state).toEqual({ popup: '', panelOnClick: true });
    await saveSettings({ openAs: 'window' });
    await settle();
    expect(state).toEqual({ popup: '', panelOnClick: false });
    expect(seen).toEqual(['sidepanel', 'overlay', 'window']);
    stop();
  });
});

describe('X tabs', () => {
  it('are x.com and twitter.com over https only', () => {
    expect(isXUrl('https://x.com/home')).toBe(true);
    expect(isXUrl('https://twitter.com/someone/status/1')).toBe(true);
    for (const url of [
      'https://pro.x.com/',
      'http://x.com/',
      'https://notx.com/',
      'https://x.com.evil.example/',
      'chrome://newtab/',
      '',
      undefined,
      'nonsense',
    ])
      expect(isXUrl(url)).toBe(false);
  });
});

describe('a toolbar click', () => {
  it('toggles the overlay on an X tab, warm or cold', async () => {
    for (const mode of ['overlay', null] as const) {
      const { calls, run } = fakeClick();
      expect(await run(X_TAB, mode)).toBe('overlay');
      expect(calls).toEqual(['toggle:7']);
    }
  });

  it('on a tab that left X with its panel still disabled, gives it back and opens it inside the gesture', async () => {
    const { calls, run } = fakeClick();
    expect(await run(OTHER_TAB, 'overlay')).toBe('sidepanel');
    expect(calls).toEqual(['enable:8:sync', 'panel:2:sync']);
  });

  it('when the click woke the worker, only gives the panel back (the gesture is gone)', async () => {
    const { calls, run } = fakeClick();
    expect(await run(OTHER_TAB, null)).toBe('reenabled');
    expect(calls).toEqual(['enable:8']);
  });

  it('an X tab still disabled after switching back to native gets its panel back and opens it', async () => {
    const { calls, run } = fakeClick();
    expect(await run(X_TAB, 'sidepanel')).toBe('sidepanel');
    expect(calls).toEqual(['enable:7:sync', 'panel:2:sync']);
  });

  it('opens the floating window in window mode, on any tab', async () => {
    for (const tab of [X_TAB, OTHER_TAB]) {
      const { calls, run } = fakeClick();
      expect(await run(tab, null, 'window')).toBe('window');
      expect(calls).toEqual(['window']);
    }
  });

  it('does nothing without a tab', async () => {
    const { calls, run } = fakeClick();
    expect(await run(undefined, 'overlay')).toBe('none');
    expect(calls).toEqual([]);
  });
});
