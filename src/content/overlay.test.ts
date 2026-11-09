// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOverlay, OVERLAY_KEY, saveOverlay } from '../lib/overlay-state';
import { saveSettings } from '../lib/settings';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { TOGGLE_OVERLAY } from '../types/model';
import {
  OVERLAY_HANDLE_TAG,
  OVERLAY_HOST_TAG,
  startPanelOverlay,
  type OverlayEnv,
} from './overlay';

const settle = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
const host = () => document.querySelector<HTMLElement>(OVERLAY_HOST_TAG);

function fakeEnv() {
  const sent: unknown[] = [];
  const listeners = new Set<(message: unknown, sender: { id?: string }) => void>();
  const env: OverlayEnv = {
    id: 'ext',
    // The real page is `chrome-extension://<id>/<path>`; happy-dom would try to load that.
    getURL: (path) => `about:blank#${path}`,
    sendMessage: async (message) => void sent.push(message),
    onMessage: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
  };
  const deliver = (message: unknown, sender: { id?: string } = { id: 'ext' }) =>
    listeners.forEach((listener) => listener(message, sender));
  return { env, sent, deliver, listeners };
}

/** X's own nodes, whose styles the overlay must never touch. */
function xPage() {
  document.body.innerHTML =
    '<div id="react-root"><main><div data-testid="primaryColumn">timeline</div></main></div>';
  const watched = [
    document.documentElement,
    document.body,
    document.getElementById('react-root')!,
    document.querySelector('[data-testid="primaryColumn"]')!,
  ];
  const before = watched.map((node) => node.getAttribute('style'));
  return () => watched.map((node) => node.getAttribute('style')).join('|') === before.join('|');
}

let scope: Scope;
beforeEach(async () => {
  await freshEnvironment();
  scope = new Scope();
});
afterEach(() => {
  scope.dispose();
  document.documentElement
    .querySelectorAll(`${OVERLAY_HOST_TAG}, ${OVERLAY_HANDLE_TAG}`)
    .forEach((n) => n.remove());
});

describe('panel overlay, native mode', () => {
  beforeEach(async () => {
    await saveSettings({ panelMode: 'native' });
  });

  it('creates nothing, tells the worker nothing, and ignores a toggle', async () => {
    const untouched = xPage();
    const { env, sent, deliver } = fakeEnv();
    startPanelOverlay(scope, env);
    await settle();
    deliver({ type: TOGGLE_OVERLAY });
    await saveOverlay({ open: true });
    await settle();
    expect(host()).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(sent).toEqual([]);
    expect(untouched()).toBe(true);
  });
});

describe('panel overlay, overlay mode', () => {
  beforeEach(async () => {
    await saveSettings({ panelMode: 'overlay' });
  });

  it('claims the tab, but creates nothing until the first open', async () => {
    const { env, sent } = fakeEnv();
    startPanelOverlay(scope, env);
    await settle();
    expect(sent).toEqual([{ type: 'overlayTab', on: true }]);
    expect(host()).toBeNull();
  });

  it('opens on the toggle message as a fixed 400 px panel framing the side panel page', async () => {
    const untouched = xPage();
    const { env, deliver } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle();
    deliver({ type: TOGGLE_OVERLAY });
    await settle(40);
    const element = host()!;
    expect(element.parentElement).toBe(document.documentElement);
    expect(element.style.getPropertyValue('position')).toBe('fixed');
    expect(element.style.getPropertyValue('right')).toBe('0px');
    expect(element.style.getPropertyValue('width')).toBe('400px');
    expect(element.style.getPropertyValue('display')).toBe('block');
    const frame = element.shadowRoot!.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('about:blank#sidepanel.html?overlay');
    expect(overlay.isOpen).toBe(true);
    expect((await loadOverlay()).open).toBe(true);
    expect(untouched()).toBe(true);
  });

  it('toggles closed and open again, twice in a row, keeping one host', async () => {
    const untouched = xPage();
    const { env, deliver } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle();
    for (let round = 0; round < 2; round++) {
      deliver({ type: TOGGLE_OVERLAY });
      await settle(20);
      expect(overlay.isOpen).toBe(true);
      deliver({ type: TOGGLE_OVERLAY });
      await settle(260);
      expect(overlay.isOpen).toBe(false);
      expect(host()!.style.getPropertyValue('display')).toBe('none');
    }
    expect(document.querySelectorAll(OVERLAY_HOST_TAG)).toHaveLength(1);
    expect((await loadOverlay()).open).toBe(false);
    expect(untouched()).toBe(true);
  });

  it('ignores messages from anyone but this extension', async () => {
    const { env, deliver } = fakeEnv();
    startPanelOverlay(scope, env);
    await settle();
    deliver({ type: TOGGLE_OVERLAY }, { id: 'someone-else' });
    deliver({ type: 'other' });
    await settle();
    expect(host()).toBeNull();
  });

  it('restores a stored open state and width on load, without taking focus', async () => {
    await saveOverlay({ open: true, width: 512 });
    const { env } = fakeEnv();
    startPanelOverlay(scope, env);
    await settle(40);
    expect(host()!.style.getPropertyValue('width')).toBe('512px');
    expect(document.activeElement).not.toBe(host());
  });

  it('follows another tab opening, resizing and closing it', async () => {
    const { env } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle();
    await chrome.storage.local.set({ [OVERLAY_KEY]: { open: true, width: 333 } });
    await settle(20);
    expect(overlay.isOpen).toBe(true);
    expect(host()!.style.getPropertyValue('width')).toBe('333px');
    await chrome.storage.local.set({ [OVERLAY_KEY]: { open: false, width: 333 } });
    await settle(260);
    expect(overlay.isOpen).toBe(false);
  });

  it('resizes from the keyboard on its grip, within 320-560, and Esc there closes it', async () => {
    await saveOverlay({ open: true, width: 552 });
    const { env } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle(40);
    const grip = host()!.shadowRoot!.querySelector<HTMLElement>('.grip')!;
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await settle();
    expect(host()!.style.getPropertyValue('width')).toBe('560px');
    expect((await loadOverlay()).width).toBe(560);
    grip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    await settle(260);
    expect(overlay.isOpen).toBe(false);
    expect((await loadOverlay()).open).toBe(false);
  });

  it('opens from the page (the save menu) and reports when it is not in use', async () => {
    const { env } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle();
    expect(overlay.open()).toBe(true);
    await settle(20);
    expect(overlay.isOpen).toBe(true);
    await saveSettings({ panelMode: 'native' });
    await settle();
    expect(overlay.open()).toBe(false);
  });

  it('leaving overlay mode removes the frame and gives the tab its native panel back', async () => {
    const { env, sent } = fakeEnv();
    startPanelOverlay(scope, env);
    await settle();
    await saveOverlay({ open: true });
    await settle(20);
    expect(host()).not.toBeNull();
    await saveSettings({ panelMode: 'native' });
    await settle();
    expect(host()).toBeNull();
    expect(sent).toEqual([
      { type: 'overlayTab', on: true },
      { type: 'overlayTab', on: false },
    ]);
  });

  it('shows the optional edge tab only while closed, and it opens the overlay', async () => {
    await saveSettings({ panelHandle: true });
    const { env } = fakeEnv();
    const overlay = startPanelOverlay(scope, env);
    await settle();
    const handle = document.querySelector<HTMLElement>(OVERLAY_HANDLE_TAG)!;
    expect(handle.style.getPropertyValue('display')).toBe('block');
    expect(host()).toBeNull();
    handle.shadowRoot!.querySelector('button')!.click();
    await settle(20);
    expect(overlay.isOpen).toBe(true);
    expect(handle.style.getPropertyValue('display')).toBe('none');
  });

  it('takes everything down with its scope (an extension reload)', async () => {
    const { env, listeners } = fakeEnv();
    startPanelOverlay(scope, env);
    await saveOverlay({ open: true });
    await settle(20);
    scope.dispose();
    expect(host()).toBeNull();
    expect(listeners.size).toBe(0);
  });
});
