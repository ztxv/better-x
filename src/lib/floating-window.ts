/**
 * The floating window launch mode: Better X in a separate Chrome window (type `popup`: no tabs or
 * address bar) that the person can move and resize freely. Unlike the toolbar popup it is not
 * capped at 600 px and does not close when you click elsewhere. Its size and position are kept
 * (`bx.windowBounds`) every time it is moved or resized, and the next one opens there. The open
 * window's id is kept in session storage so a second click focuses it instead of opening another.
 */

/** The side panel's page, told by `?window` that it fills a window of its own. */
export const WINDOW_PAGE = 'sidepanel.html?window';
export const WINDOW_BOUNDS_KEY = 'bx.windowBounds';
export const WINDOW_ID_KEY = 'bx.windowId';

export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** First-time width; the person can resize it. */
export const DEFAULT_WIDTH = 440;
const LIMITS = { width: [320, 2400], height: [320, 2400] } as const;

const int = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;

/** Stored bounds, or null when missing or not sensible (sizes are kept within 320-2400 px). */
export function normalizeBounds(input: unknown): Bounds | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  const left = int(value.left);
  const top = int(value.top);
  const width = int(value.width);
  const height = int(value.height);
  if (left === null || top === null || width === null || height === null) return null;
  if (width < LIMITS.width[0] || width > LIMITS.width[1]) return null;
  if (height < LIMITS.height[0] || height > LIMITS.height[1]) return null;
  return { left, top, width, height };
}

/**
 * Where the first window opens: as tall as the browser window it was opened from, against that
 * window's right edge (where the side panel would be). Without one, a 440 x 900 window.
 */
export function defaultBounds(browser?: Partial<Bounds>): Bounds {
  const height = Math.max(LIMITS.height[0], Math.min(LIMITS.height[1], browser?.height ?? 900));
  const left =
    browser?.left !== undefined && browser.width !== undefined
      ? browser.left + browser.width - DEFAULT_WIDTH
      : 80;
  return { left, top: browser?.top ?? 40, width: DEFAULT_WIDTH, height };
}

/** The parts of `chrome.windows` and storage the floating window uses (faked in tests). */
export interface WindowApi {
  exists(id: number): Promise<boolean>;
  focus(id: number): Promise<void>;
  create(url: string, bounds: Partial<Bounds>): Promise<number | undefined>;
  lastFocused(): Promise<Partial<Bounds> | undefined>;
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

export const chromeWindowApi = (): WindowApi => ({
  async exists(id) {
    try {
      await chrome.windows.get(id);
      return true;
    } catch {
      return false;
    }
  },
  async focus(id) {
    await chrome.windows.update(id, { focused: true });
  },
  async create(url, bounds) {
    const win = await chrome.windows.create({ url, type: 'popup', focused: true, ...bounds });
    return win?.id;
  },
  async lastFocused() {
    try {
      const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
      return { left: win.left, top: win.top, width: win.width, height: win.height };
    } catch {
      return undefined;
    }
  },
  async read(key) {
    const area = key === WINDOW_ID_KEY ? chrome.storage.session : chrome.storage.local;
    return (await area.get(key))[key];
  },
  async write(key, value) {
    const area = key === WINDOW_ID_KEY ? chrome.storage.session : chrome.storage.local;
    await area.set({ [key]: value });
  },
});

/** Focuses the open Better X window, or opens one where the last one was (or beside the browser). */
export async function openFloatingWindow(api: WindowApi = chromeWindowApi()): Promise<void> {
  const open = await api.read(WINDOW_ID_KEY);
  if (typeof open === 'number' && (await api.exists(open))) {
    await api.focus(open);
    return;
  }
  const bounds =
    normalizeBounds(await api.read(WINDOW_BOUNDS_KEY)) ?? defaultBounds(await api.lastFocused());
  // Chrome refuses bounds that are mostly off screen (a remembered spot on a monitor that is gone,
  // a screen smaller than the browser window): then a default size where Chrome puts it, then
  // whatever Chrome chooses.
  let id: number | undefined;
  for (const attempt of [bounds, { width: DEFAULT_WIDTH, height: 600 }, {}]) {
    try {
      id = await api.create(WINDOW_PAGE, attempt);
      break;
    } catch (error) {
      if (Object.keys(attempt).length === 0) throw error;
    }
  }
  if (id !== undefined) await api.write(WINDOW_ID_KEY, id);
}

/**
 * Remembers the floating window's size and position whenever it changes, and forgets its id when
 * it closes. Registered by the background worker at start.
 */
export function followFloatingWindow(api: WindowApi = chromeWindowApi()): void {
  chrome.windows.onBoundsChanged?.addListener((win) => {
    void api.read(WINDOW_ID_KEY).then((open) => {
      if (win.id !== open) return;
      const bounds = normalizeBounds(win);
      if (bounds) void api.write(WINDOW_BOUNDS_KEY, bounds);
    });
  });
  chrome.windows.onRemoved.addListener((id) => {
    void api.read(WINDOW_ID_KEY).then((open) => {
      if (id === open) void api.write(WINDOW_ID_KEY, null);
    });
  });
}
