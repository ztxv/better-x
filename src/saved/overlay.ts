import { anchorVisible, el, ICONS, place, xTheme, type Placement } from '../content/popover';
import type { SavedContext } from './context';

export interface Overlay {
  kind: 'chip' | 'menu';
  node: HTMLElement;
  anchor: HTMLButtonElement;
  tweetId: string;
  prefer: Placement;
  cleanup: Array<() => void>;
}

/** With a Download to reach for, the chip stays; a plain "Saved" confirmation leaves sooner. */
export const IDLE_MS = 3000;
export const PLAIN_IDLE_MS = 1600;
export const ERROR_IDLE_MS = 8000;

export function closeOverlay(ctx: SavedContext, restoreFocus = false) {
  const current = ctx.overlay;
  if (!current) return;
  ctx.overlay = null;
  current.cleanup.forEach((stop) => stop());
  current.node.remove();
  current.anchor.removeAttribute('aria-expanded');
  current.anchor.removeAttribute('aria-controls');
  if (restoreFocus && current.anchor.isConnected) current.anchor.focus({ preventScroll: true });
}

/** True while `current` is still the open overlay for a control showing its post. */
const stillOpen = (ctx: SavedContext, current: Overlay) =>
  ctx.overlay === current && ctx.buttons.get(current.anchor) === current.tweetId;

/** Shows `node` as the only overlay on the page, anchored to a save control. */
export function openOverlay(
  ctx: SavedContext,
  kind: Overlay['kind'],
  node: HTMLElement,
  anchor: HTMLButtonElement,
  tweetId: string,
  prefer: Placement,
): Overlay {
  closeOverlay(ctx);
  node.dataset.theme = xTheme();
  node.id = `bx-${kind}`;
  document.body.append(node);
  const current: Overlay = { kind, node, anchor, tweetId, prefer, cleanup: [] };
  ctx.overlay = current;
  place(node, anchor, prefer);

  let frame = 0;
  const openedAt = anchor.getBoundingClientRect().top;
  const reposition = (event?: Event) => {
    // Scrolling inside the overlay itself (a long chooser) is not page movement.
    if (event?.target instanceof Node && node.contains(event.target)) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!stillOpen(ctx, current) || !anchorVisible(anchor)) return closeOverlay(ctx);
      // The chip is a passing confirmation: scrolling the post away dismisses it unless it
      // has focus. A few pixels (trackpad momentum after the click) only move it along.
      const moved = Math.abs(anchor.getBoundingClientRect().top - openedAt) > 24;
      if (kind === 'chip' && moved && !node.contains(document.activeElement))
        return closeOverlay(ctx);
      place(node, anchor, prefer);
    });
  };
  const outside = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!node.contains(target) && !anchor.contains(target)) closeOverlay(ctx);
  };
  const focusables = () =>
    [...node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(
      (item) => !item.closest('[hidden]'),
    );
  const keys = (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      closeOverlay(ctx, node.contains(active) || active === anchor);
      return;
    }
    if (event.key !== 'Tab') return;
    // The overlay sits at the end of the page, so keep it next to its control in Tab order:
    // Tab from the control enters it; leaving it from either end returns to the control.
    const items = focusables();
    const leaving = event.shiftKey ? active === items[0] : active === items.at(-1);
    if (active === anchor && !event.shiftKey && items.length) {
      event.preventDefault();
      items[0]!.focus({ preventScroll: true });
    } else if (node.contains(active) && (leaving || !items.length)) {
      event.preventDefault();
      if (event.shiftKey) anchor.focus({ preventScroll: true });
      else closeOverlay(ctx, true);
    }
  };
  // Tabbing out of the overlay closes it; focus moving inside (or re-rendering) does not.
  const leave = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && !node.contains(next) && next !== anchor) closeOverlay(ctx);
  };
  addEventListener('scroll', reposition, { capture: true, passive: true });
  addEventListener('resize', reposition, { passive: true });
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keys, true);
  node.addEventListener('focusout', leave);
  current.cleanup.push(() => {
    cancelAnimationFrame(frame);
    removeEventListener('scroll', reposition, { capture: true });
    removeEventListener('resize', reposition);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keys, true);
  });
  return current;
}

/** Dismisses `current` after `ms` idle; paused while hovered, focused, or still working. */
export function idleTimer(ctx: SavedContext, current: Overlay, ms: number) {
  let timer = 0;
  let hovered = false;
  let busy = false;
  const focused = () => current.node.contains(document.activeElement);
  const arm = () => {
    clearTimeout(timer);
    if (hovered || busy || focused()) return;
    timer = window.setTimeout(() => {
      if (ctx.overlay === current && !focused()) closeOverlay(ctx);
    }, ms);
  };
  const pause = () => clearTimeout(timer);
  current.node.addEventListener('pointerenter', () => {
    hovered = true;
    pause();
  });
  current.node.addEventListener('pointerleave', () => {
    hovered = false;
    arm();
  });
  current.node.addEventListener('focusin', pause);
  current.node.addEventListener('focusout', () => setTimeout(arm, 0));
  current.cleanup.push(pause);
  arm();
  return {
    setBusy(value: boolean, nextMs = ms) {
      busy = value;
      ms = nextMs;
      arm();
    },
  };
}

export function showStatus(status: HTMLElement, text: string) {
  status.hidden = false;
  status.dataset.tone = 'error';
  const line = el('span', 'bx-status-text', text);
  line.insertAdjacentHTML('afterbegin', ICONS.alert);
  status.replaceChildren(line);
}
