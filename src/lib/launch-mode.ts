import { loadSettings, SETTINGS_KEY, type OpenAs, type Settings } from './settings';

/**
 * What a toolbar click does, from the two settings: `openAs`, and in side panel mode `panelMode`.
 * `overlay` is side panel mode with the in-page panel on X tabs (`src/content/overlay.ts`).
 */
export type LaunchMode = OpenAs | 'overlay';

export const launchModeOf = (settings: Pick<Settings, 'openAs' | 'panelMode'>): LaunchMode =>
  settings.openAs === 'sidepanel' && settings.panelMode === 'overlay' ? 'overlay' : settings.openAs;

/** The popup's page, built from the same app as the side panel (`entrypoints/compact`). */
export const POPUP_PAGE = 'compact.html';

/** The parts of `chrome.action` and `chrome.sidePanel` that choose what the toolbar icon does. */
export interface LaunchApi {
  setPopup(details: { popup: string }): Promise<void>;
  getPopup(details: object): Promise<string>;
  setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
}

export const chromeLaunchApi = (): LaunchApi => ({
  setPopup: (details) => chrome.action.setPopup(details),
  getPopup: (details) => chrome.action.getPopup(details),
  setPanelBehavior: (behavior) => chrome.sidePanel.setPanelBehavior(behavior),
});

/**
 * Points the toolbar icon at the side panel or at the popup. The two cannot both be on: while an
 * action has a popup, Chrome opens it and never opens the side panel from the icon (and never
 * fires `action.onClicked`), so each mode clears the other:
 *
 * - side panel: no popup (`''`), and "open the panel when the icon is clicked" on;
 * - popup: the popup page, and "open the panel when the icon is clicked" off;
 * - window: neither, so a click reaches `action.onClicked`, where the background worker opens or
 *   focuses the floating window (`src/lib/floating-window.ts`);
 * - overlay: the same as side panel, so Chrome itself opens the native panel on every other site
 *   (no code runs, so a stopped worker cannot get in the way). Each X tab's content script asks
 *   the worker to disable the panel for its own tab (`sidePanel.setOptions({ tabId, enabled:
 *   false })`); a click there then reaches `action.onClicked`, which toggles the in-page panel
 *   (see `routeActionClick`).
 *
 * Chrome forgets a popup set at run time when the browser restarts or the extension reloads, so
 * the background worker calls this on every start as well as when the setting changes.
 */
export async function applyLaunchMode(mode: LaunchMode, api: LaunchApi = chromeLaunchApi()) {
  if (mode === 'popup') {
    await api.setPanelBehavior({ openPanelOnActionClick: false });
    await api.setPopup({ popup: POPUP_PAGE });
  } else if (mode === 'window') {
    await api.setPanelBehavior({ openPanelOnActionClick: false });
    await api.setPopup({ popup: '' });
  } else {
    await api.setPopup({ popup: '' });
    await api.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

/**
 * Applies the stored mode now, and again whenever any context changes it. Returns a function that
 * stops listening. A change that leaves the mode as it was does nothing to Chrome. `onMode` hears
 * every mode read, so a caller can keep it in memory and use it without waiting on storage.
 */
export function followLaunchMode(
  api: LaunchApi = chromeLaunchApi(),
  onError: (error: unknown) => void = (error) => console.error('[Better X] launch mode', error),
  onMode: (mode: LaunchMode) => void = () => {},
): () => void {
  let applied: LaunchMode | null = null;
  let chain: Promise<void> = Promise.resolve();
  const apply = (mode: LaunchMode) => {
    onMode(mode);
    if (mode === applied) return;
    applied = mode;
    chain = chain.then(() => applyLaunchMode(mode, api)).catch(onError);
  };
  void loadSettings().then((settings) => apply(launchModeOf(settings)));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    void loadSettings().then((settings) => apply(launchModeOf(settings)));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** X's own sites, where the content script (and so the overlay) runs. */
export function isXUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'x.com' || hostname === 'twitter.com');
  } catch {
    return false;
  }
}

/** What the worker needs to answer a toolbar click (faked in tests). */
export interface ClickApi {
  /** Gives the tab Chrome's native panel back. Fire and forget: nothing waits for it. */
  enablePanel(tabId: number): void;
  /** Must be called synchronously from the click: Chrome needs the user gesture. */
  openSidePanel(windowId: number): Promise<void>;
  toggleOverlay(tabId: number): Promise<void>;
  openFloatingWindow(): Promise<void>;
}

export type ClickOutcome = 'overlay' | 'sidepanel' | 'window' | 'reenabled' | 'none';

/**
 * Answers `action.onClicked` (and the `_execute_action` shortcut, which is the same event). Chrome
 * sends a click here only in floating window mode or on a tab whose panel the overlay disabled;
 * `tab.url` is readable because a click grants `activeTab`.
 *
 * - X tab, overlay mode: toggle the in-page panel (a message; no user gesture needed).
 * - Floating window mode: open or focus it.
 * - Anything else is a tab whose panel is still disabled although it should not be (it left X for
 *   another site, or the mode changed): give it its panel back and open it, synchronously, inside
 *   the click's gesture (Chrome refuses `sidePanel.open` after anything is awaited).
 *
 * `mode` is the worker's in-memory copy. When this click is what woke the worker it is `null`,
 * the stored mode is read first, and the panel can no longer be opened in that last case: it is
 * only given back, so the next click opens it natively.
 */
export function routeActionClick(
  tab: { id?: number; windowId?: number; url?: string } | undefined,
  mode: LaunchMode | null,
  api: ClickApi,
  load: () => Promise<LaunchMode> = async () => launchModeOf(await loadSettings()),
): Promise<ClickOutcome> {
  const route = (current: LaunchMode, gesture: boolean): Promise<ClickOutcome> => {
    if (current === 'window') return api.openFloatingWindow().then(() => 'window');
    if (current === 'overlay' && tab?.id !== undefined && isXUrl(tab.url))
      return api.toggleOverlay(tab.id).then(() => 'overlay');
    if (tab?.id === undefined) return Promise.resolve('none');
    api.enablePanel(tab.id);
    if (gesture && tab.windowId !== undefined)
      return api.openSidePanel(tab.windowId).then(() => 'sidepanel');
    return Promise.resolve('reenabled');
  };
  if (mode !== null) return route(mode, true);
  return load().then((current) => route(current, false));
}
