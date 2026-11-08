import { loadSettings, SETTINGS_KEY, type OpenAs } from './settings';

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
 *   focuses the floating window (`src/lib/floating-window.ts`).
 *
 * Chrome forgets a popup set at run time when the browser restarts or the extension reloads, so
 * the background worker calls this on every start as well as when the setting changes.
 */
export async function applyLaunchMode(mode: OpenAs, api: LaunchApi = chromeLaunchApi()) {
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
  onMode: (mode: OpenAs) => void = () => {},
): () => void {
  let applied: OpenAs | null = null;
  let chain: Promise<void> = Promise.resolve();
  const apply = (mode: OpenAs) => {
    onMode(mode);
    if (mode === applied) return;
    applied = mode;
    chain = chain.then(() => applyLaunchMode(mode, api)).catch(onError);
  };
  void loadSettings().then((settings) => apply(settings.openAs));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    void loadSettings().then((settings) => apply(settings.openAs));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
