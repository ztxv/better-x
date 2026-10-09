import { beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import { applyLaunchMode, followLaunchMode, POPUP_PAGE, type LaunchApi } from './launch-mode';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_VERSION } from './settings';

/** Records what Chrome would be told, in order. */
function fakeApi() {
  const calls: string[] = [];
  const state = { popup: 'initial', panelOnClick: false };
  const api: LaunchApi = {
    async setPopup({ popup }) {
      calls.push(`popup:${popup}`);
      state.popup = popup;
    },
    async getPopup() {
      return state.popup;
    },
    async setPanelBehavior({ openPanelOnActionClick }) {
      calls.push(`panel:${openPanelOnActionClick}`);
      state.panelOnClick = openPanelOnActionClick;
    },
  };
  return { api, calls, state };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(async () => {
  await freshEnvironment();
});

describe('launch mode', () => {
  it('opens the side panel by default: no popup and the panel on click', async () => {
    const { api, state } = fakeApi();
    await applyLaunchMode('sidepanel', api);
    expect(state).toEqual({ popup: '', panelOnClick: true });
  });

  it('opens the popup when asked: the popup page and the panel not on click', async () => {
    const { api, state } = fakeApi();
    await applyLaunchMode('popup', api);
    expect(state).toEqual({ popup: POPUP_PAGE, panelOnClick: false });
  });

  it('never leaves both on: each mode clears the other before setting itself', async () => {
    const popup = fakeApi();
    await applyLaunchMode('popup', popup.api);
    expect(popup.calls).toEqual(['panel:false', 'popup:compact.html']);
    const panel = fakeApi();
    await applyLaunchMode('sidepanel', panel.api);
    expect(panel.calls).toEqual(['popup:', 'panel:true']);
  });
});

describe('following the stored mode', () => {
  it('applies the stored mode when the worker starts, and the default for a new install', async () => {
    const fresh = fakeApi();
    const stop = followLaunchMode(fresh.api);
    await settle();
    expect(fresh.state).toEqual({ popup: '', panelOnClick: true });
    stop();

    await saveSettings({ openAs: 'popup' });
    const restarted = fakeApi();
    const stop2 = followLaunchMode(restarted.api);
    await settle();
    expect(restarted.state).toEqual({ popup: POPUP_PAGE, panelOnClick: false });
    stop2();
  });

  it('follows the setting live, in either direction, without a reload', async () => {
    const { api, state } = fakeApi();
    const stop = followLaunchMode(api);
    await settle();
    await saveSettings({ openAs: 'popup' });
    await settle();
    expect(state.popup).toBe(POPUP_PAGE);
    await saveSettings({ openAs: 'sidepanel' });
    await settle();
    expect(state).toEqual({ popup: '', panelOnClick: true });
    stop();
  });

  it('does nothing when an unrelated setting changes', async () => {
    const { api, calls } = fakeApi();
    const stop = followLaunchMode(api);
    await settle();
    const before = calls.length;
    await saveSettings({ accent: 'pink', features: { 'cleanup.hideAds': true } });
    await settle();
    expect(calls.length).toBe(before);
    stop();
  });

  it('stops following when asked', async () => {
    const { api, state } = fakeApi();
    const stop = followLaunchMode(api);
    await settle();
    stop();
    await saveSettings({ openAs: 'popup' });
    await settle();
    expect(state.popup).toBe('');
  });

  it('survives Chrome refusing a call and still applies the next change', async () => {
    const { api, state } = fakeApi();
    const errors: unknown[] = [];
    let fail = true;
    const original = api.setPopup;
    api.setPopup = async (details) => {
      if (fail) {
        fail = false;
        throw new Error('refused');
      }
      return original(details);
    };
    const stop = followLaunchMode(api, (error) => errors.push(error));
    await settle();
    expect(errors).toHaveLength(1);
    await saveSettings({ openAs: 'popup' });
    await settle();
    expect(state.popup).toBe(POPUP_PAGE);
    stop();
  });

  it('a stored invalid mode is the side panel', async () => {
    await chrome.storage.local.set({ 'bx.settings': { version: 4, openAs: 'window' } });
    expect((await loadSettings()).openAs).toBe('sidepanel');
  });
});

describe('settings version 4', () => {
  it('loads a version 3 object as the side panel and keeps everything else', async () => {
    await chrome.storage.local.set({
      'bx.settings': { version: 3, accent: 'green', features: { 'cleanup.hideAds': true } },
    });
    expect(await loadSettings()).toMatchObject({
      version: SETTINGS_VERSION,
      openAs: 'sidepanel',
      accent: 'green',
      features: { 'cleanup.hideAds': true },
    });
  });

  it('keeps the launch mode when appearance and Saved settings are reset', async () => {
    const { resetSettings } = await import('./settings');
    await saveSettings({ openAs: 'popup', accent: 'pink' });
    const after = await resetSettings();
    expect(after.openAs).toBe('popup');
    expect(after.accent).toBe(DEFAULT_SETTINGS.accent);
  });
});
