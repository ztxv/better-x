/**
 * The panel overlay: Better X's side panel page drawn inside the X tab, over its right edge, so
 * opening it never narrows the page (Chrome's own side panel does, and X re-centers in what is
 * left). Used on X tabs when the toolbar mode is side panel and `panelMode` is `overlay`.
 *
 * - One host element appended to `<html>` (never inside X's tree, and nothing of X's is styled),
 *   fixed to the right edge, with a shadow root holding the resize grip and an iframe of
 *   `sidepanel.html?overlay`: the same app as the side panel, an extension page with every
 *   extension API, so settings and the library stay in step through storage as they do between
 *   the panel and the popup. X's CSP does not apply to extension frames (verified against X's
 *   live header in real Chrome).
 * - Nothing exists until the first open: no element, no frame, no observer. Closed, the cost is a
 *   runtime message listener and a storage listener.
 * - Non-modal: no backdrop, and the host covers exactly the panel, so the rest of X keeps every
 *   click, scroll and key. Clicking X, navigating X's pages and scrolling never close it.
 * - Open/closed and width live in `bx.overlay` (`src/lib/overlay-state.ts`), shared by every X tab
 *   and restored on load. Closing it explicitly (the panel's Close button, Esc, the toolbar icon,
 *   the shortcut) closes it everywhere.
 * - While the overlay owns this tab it asks the worker to disable Chrome's own panel here
 *   (`overlayTab`), which hides a native panel left open and sends toolbar clicks to the worker,
 *   which answers with `bx.toggleOverlay` (see `routeActionClick` in `src/lib/launch-mode.ts`).
 */

import { launchModeOf } from '../lib/launch-mode';
import {
  clampOverlayWidth,
  DEFAULT_OVERLAY,
  loadOverlay,
  OVERLAY_WIDTH,
  saveOverlay,
  watchOverlay,
  type OverlayState,
} from '../lib/overlay-state';
import { loadSettings, watchSettings, type Settings, type Theme } from '../lib/settings';
import type { Scope } from '../runtime/scope';
import { TOGGLE_OVERLAY } from '../types/model';

export const OVERLAY_HOST_TAG = 'bx-panel-overlay';
export const OVERLAY_HANDLE_TAG = 'bx-panel-handle';
export const OVERLAY_PAGE = 'sidepanel.html?overlay';
const SLIDE_MS = 200;
/** One arrow-key press on the grip. */
const KEY_STEP = 16;

/** The parts of `chrome.runtime` the overlay uses (faked in tests). */
export interface OverlayEnv {
  getURL(path: string): string;
  sendMessage(message: unknown): Promise<unknown>;
  onMessage: {
    addListener(listener: (message: unknown, sender: { id?: string }) => void): void;
    removeListener(listener: (message: unknown, sender: { id?: string }) => void): void;
  };
  id: string;
}

const chromeEnv = (): OverlayEnv => ({
  getURL: (path) => chrome.runtime.getURL(path),
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  onMessage: chrome.runtime.onMessage as unknown as OverlayEnv['onMessage'],
  id: chrome.runtime.id,
});

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Light and dark as the side panel draws them; `auto` follows the system inside the shadow root,
 * so nothing has to listen for a scheme change. Only `transform` and `opacity` animate.
 */
const CSS = `
:host { all: initial; }
.panel {
  --bg: #ffffff; --border: #e6ecf0; --shadow: rgba(15, 20, 25, 0.12); --focus: #1d9bf0;
  position: absolute; inset: 0; box-sizing: border-box;
  background: var(--bg); border-left: 1px solid var(--border);
  box-shadow: -6px 0 24px var(--shadow);
  transform: translateX(100%); opacity: 0;
  transition: transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease;
}
:host([data-open]) .panel { transform: none; opacity: 1; }
:host([data-theme='dark']) .panel { --bg: #000000; --border: #2f3336; --shadow: rgba(0, 0, 0, 0.6); }
@media (prefers-color-scheme: dark) {
  :host([data-theme='auto']) .panel { --bg: #000000; --border: #2f3336; --shadow: rgba(0, 0, 0, 0.6); }
}
@media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
.grip {
  position: absolute; top: 0; bottom: 0; left: 0; width: 6px; z-index: 1;
  cursor: ew-resize; touch-action: none; outline: none;
}
.grip::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 2px;
  background: var(--focus); opacity: 0; transition: opacity 120ms ease;
}
.grip:hover::after, .grip:focus-visible::after, :host([data-resizing]) .grip::after { opacity: 1; }
:host([data-resizing]) iframe { pointer-events: none; }
`;

const HANDLE_CSS = `
:host { all: initial; }
button {
  all: unset; box-sizing: border-box; display: grid; place-items: center;
  width: 22px; height: 48px; border-radius: 10px 0 0 10px; cursor: pointer;
  background: #1d9bf0; color: #fff; box-shadow: -2px 0 8px rgba(15, 20, 25, 0.2);
  opacity: 0.55; transition: opacity 120ms ease;
}
button:hover, button:focus-visible { opacity: 1; }
button:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
svg { width: 14px; height: 14px; }
`;

const fixed = (style: CSSStyleDeclaration, rules: Record<string, string>) => {
  for (const [name, value] of Object.entries(rules)) style.setProperty(name, value, 'important');
};

export interface PanelOverlay {
  /** Opens it (from the page: the save menu's "Open library"). False when not in overlay mode. */
  open(): boolean;
  /** For tests and diagnostics. */
  readonly isOpen: boolean;
}

export function startPanelOverlay(scope: Scope, env: OverlayEnv = chromeEnv()): PanelOverlay {
  let active = false; // the overlay owns this tab (overlay mode)
  let announced = false; // this page told the worker so
  let theme: Theme = 'auto';
  let handleOn = false;
  let state: OverlayState = DEFAULT_OVERLAY;
  let shown = false; // the host is displayed and open
  let host: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  let grip: HTMLElement | null = null;
  let handle: HTMLElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  /* -------------------------------------------------------------------- the host */

  function build(): HTMLElement {
    const element = document.createElement(OVERLAY_HOST_TAG);
    // Inline and important, so no stylesheet of X's can move or hide it.
    fixed(element.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      height: '100vh',
      'z-index': '2147483647',
      display: 'none',
      contain: 'strict',
    });
    const root = element.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const panel = document.createElement('div');
    panel.className = 'panel';
    grip = document.createElement('div');
    grip.className = 'grip';
    grip.tabIndex = 0;
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', 'Resize Better X');
    grip.setAttribute('aria-valuemin', String(OVERLAY_WIDTH.min));
    grip.setAttribute('aria-valuemax', String(OVERLAY_WIDTH.max));
    frame = document.createElement('iframe');
    frame.title = 'Better X';
    frame.src = env.getURL(OVERLAY_PAGE);
    panel.append(grip, frame);
    root.append(style, panel);
    wireResize(element, grip);
    // Esc while the grip has focus (inside the frame, the app handles it).
    root.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        event.preventDefault();
        void close();
      }
    });
    document.documentElement.append(element);
    scope.add(() => element.remove());
    return element;
  }

  function wireResize(element: HTMLElement, target: HTMLElement) {
    let startX = 0;
    let startWidth = 0;
    let dragging = false;
    target.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startWidth = state.width;
      target.setPointerCapture?.(event.pointerId);
      element.setAttribute('data-resizing', '');
    });
    target.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      // Dragging the left edge left makes it wider.
      setWidth(clampOverlayWidth(startWidth + (startX - event.clientX)), false);
    });
    const end = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      target.releasePointerCapture?.(event.pointerId);
      element.removeAttribute('data-resizing');
      void saveOverlay({ width: state.width });
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
    target.addEventListener('keydown', (event) => {
      const step =
        event.key === 'ArrowLeft' ? KEY_STEP : event.key === 'ArrowRight' ? -KEY_STEP : 0;
      if (!step) return;
      event.preventDefault();
      setWidth(clampOverlayWidth(state.width + step), true);
    });
  }

  function setWidth(width: number, persist: boolean) {
    state = { ...state, width };
    if (host) fixed(host.style, { width: `${width}px` });
    grip?.setAttribute('aria-valuenow', String(width));
    if (persist) void saveOverlay({ width });
  }

  /* -------------------------------------------------------------- show and hide */

  function render(focus = false) {
    const want = active && state.open;
    if (want) {
      clearTimeout(hideTimer);
      host ??= build();
      host.setAttribute('data-theme', theme);
      setWidth(state.width, false);
      if (!shown) {
        shown = true;
        fixed(host.style, { display: 'block' });
        // One frame displayed but closed, so the slide-in has a start.
        if (reducedMotion()) host.setAttribute('data-open', '');
        else
          scope.requestFrame(() =>
            scope.requestFrame(() => shown && host?.setAttribute('data-open', '')),
          );
      }
      if (focus) frame?.focus();
    } else if (shown && host) {
      shown = false;
      const element = host;
      // Focus inside the panel goes back to X's page.
      if (document.activeElement === element) element.blur();
      element.removeAttribute('data-open');
      fixed(element.style, { 'pointer-events': 'none' });
      hideTimer = setTimeout(
        () => {
          if (!shown) fixed(element.style, { display: 'none' });
          element.style.removeProperty('pointer-events');
        },
        reducedMotion() ? 0 : SLIDE_MS,
      );
    }
    // Leaving overlay mode releases the frame (and the app in it) entirely.
    if (!active && host) {
      clearTimeout(hideTimer);
      host.remove();
      host = frame = grip = null;
      shown = false;
    }
    renderHandle();
  }

  function renderHandle() {
    const want = active && handleOn && !state.open;
    if (!want) {
      if (handle) fixed(handle.style, { display: 'none' });
      return;
    }
    if (!handle) {
      handle = document.createElement(OVERLAY_HANDLE_TAG);
      fixed(handle.style, {
        position: 'fixed',
        right: '0',
        top: '50%',
        transform: 'translateY(-50%)',
        'z-index': '2147483646',
      });
      const root = handle.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = HANDLE_CSS;
      const button = document.createElement('button');
      button.type = 'button';
      button.title = 'Open Better X';
      button.setAttribute('aria-label', 'Open Better X');
      button.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
      button.addEventListener('click', () => void open(true));
      root.append(style, button);
      document.documentElement.append(handle);
      const element = handle;
      scope.add(() => element.remove());
    }
    fixed(handle.style, { display: 'block' });
  }

  async function open(focus: boolean) {
    if (!active) return;
    state = { ...state, open: true };
    render(focus);
    state = await saveOverlay({ open: true });
  }
  async function close() {
    state = { ...state, open: false };
    render();
    state = await saveOverlay({ open: false });
  }

  /* -------------------------------------------------------------- mode and state */

  function applySettings(settings: Settings) {
    const next = launchModeOf(settings) === 'overlay';
    theme = settings.theme;
    handleOn = settings.panelHandle;
    host?.setAttribute('data-theme', theme);
    // Tell the worker only when it matters: on entering overlay mode, and on leaving it if this
    // page had said so. A page in native mode sends nothing.
    if (next !== active && (next || announced)) {
      announced = next;
      void env.sendMessage({ type: 'overlayTab', on: next }).catch(() => {});
    }
    active = next;
    render();
  }

  const onMessage = (message: unknown, sender: { id?: string }) => {
    if (sender.id !== env.id) return;
    if ((message as { type?: unknown })?.type !== TOGGLE_OVERLAY) return;
    if (state.open) void close();
    else void open(true);
  };
  env.onMessage.addListener(onMessage);
  scope.add(() => env.onMessage.removeListener(onMessage));

  scope.add(
    watchOverlay((next) => {
      state = next;
      render();
    }),
  );
  scope.add(watchSettings(applySettings));
  void Promise.all([loadSettings(), loadOverlay()]).then(([settings, stored]) => {
    if (!scope.alive()) return;
    state = stored;
    applySettings(settings);
  });
  // An extension reload leaves this page's copy orphaned: take everything down with the scope.
  scope.add(() => clearTimeout(hideTimer));

  return {
    open: () => {
      if (!active) return false;
      void open(true);
      return true;
    },
    get isOpen() {
      return shown;
    },
  };
}
