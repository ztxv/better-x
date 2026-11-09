/**
 * The in-page panel overlay's own state: whether it is open and how wide it is. Kept under its own
 * key, not in `bx.settings`, like the floating window's bounds (`bx.windowBounds`): opening,
 * closing and resizing happen often and must not wake every settings listener (the feature host,
 * the panel). Never in settings backups and untouched by reset. Every X tab follows changes to it
 * through `chrome.storage.onChanged`, so leaving the overlay open (or closing it) applies to all of
 * them and to the next X page that loads.
 */

export const OVERLAY_KEY = 'bx.overlay';
export const OVERLAY_WIDTH = { min: 320, max: 560, default: 400 } as const;

export interface OverlayState {
  open: boolean;
  width: number;
}

export const DEFAULT_OVERLAY: OverlayState = { open: false, width: OVERLAY_WIDTH.default };

/** A width the overlay can have: a whole number of pixels within 320-560; anything else is 400. */
export function clampOverlayWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return OVERLAY_WIDTH.default;
  return Math.round(Math.min(OVERLAY_WIDTH.max, Math.max(OVERLAY_WIDTH.min, value)));
}

export function normalizeOverlay(input: unknown): OverlayState {
  const value =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    open: typeof value.open === 'boolean' ? value.open : DEFAULT_OVERLAY.open,
    width: clampOverlayWidth(value.width),
  };
}

export async function loadOverlay(): Promise<OverlayState> {
  try {
    return normalizeOverlay((await chrome.storage.local.get(OVERLAY_KEY))[OVERLAY_KEY]);
  } catch {
    return DEFAULT_OVERLAY;
  }
}

/** Read, merge and write one at a time, so a toggle and a resize cannot overwrite each other. */
let writes: Promise<unknown> = Promise.resolve();

export function saveOverlay(patch: Partial<OverlayState>): Promise<OverlayState> {
  const write = writes.then(async () => {
    const next = normalizeOverlay({ ...(await loadOverlay()), ...patch });
    await chrome.storage.local.set({ [OVERLAY_KEY]: next });
    return next;
  });
  writes = write.catch(() => {});
  return write;
}

/** Calls `listener` whenever any context changes the overlay state. Returns an unsubscribe. */
export function watchOverlay(listener: (state: OverlayState) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[OVERLAY_KEY])
      listener(normalizeOverlay(changes[OVERLAY_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
