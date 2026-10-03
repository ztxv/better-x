/**
 * Anchored overlays on the X page (the post-save chip and the saved-post menu). They are fixed
 * to the viewport, sized by measuring the real element, and never change X's own layout.
 */

const MARGIN = 8;
const GAP = 6;

export type Placement = 'below' | 'above';

/**
 * Positions `node` against `anchor`, right-aligned with it, on the preferred side when it fits
 * and on the other side otherwise; finally clamped inside the viewport.
 */
export function place(node: HTMLElement, anchor: Element, prefer: Placement): void {
  const rect = anchor.getBoundingClientRect();
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const below = rect.bottom + GAP;
  const above = rect.top - GAP - height;
  const fitsBelow = below + height <= innerHeight - MARGIN;
  const fitsAbove = above >= MARGIN;
  let top =
    prefer === 'below'
      ? fitsBelow || !fitsAbove
        ? below
        : above
      : fitsAbove || !fitsBelow
        ? above
        : below;
  top = Math.max(MARGIN, Math.min(top, innerHeight - MARGIN - height));
  const left = Math.max(MARGIN, Math.min(rect.right - width, innerWidth - MARGIN - width));
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
  node.dataset.side = top >= rect.bottom ? 'below' : 'above';
}

/** True while `anchor` is in the document and at least partly on screen. */
export function anchorVisible(anchor: Element): boolean {
  if (!anchor.isConnected) return false;
  const rect = anchor.getBoundingClientRect();
  return rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;
}

/** X's own theme (Default, Dim, Lights out) is independent of the OS, so read its background. */
export function xTheme(): 'light' | 'dark' {
  const [r = 255, g = 255, b = 255, alpha = 1] =
    getComputedStyle(document.body)
      .backgroundColor.match(/[\d.]+/g)
      ?.map(Number) ?? [];
  return alpha > 0 && 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 'dark' : 'light';
}

/** Lucide icons used by the overlays, inlined so nothing loads from the network. */
export const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3l14 9-14 9z"/></svg>',
};

/** Creates an element with a class, text, and attributes. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** A button with an optional leading icon; `type="button"` so it never submits X's forms. */
export function button(className: string, label: string, icon?: string): HTMLButtonElement {
  const node = el('button', className, '', { type: 'button' });
  if (icon) node.insertAdjacentHTML('afterbegin', icon);
  node.append(el('span', '', label));
  return node;
}
