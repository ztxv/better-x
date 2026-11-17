import type { Scope } from '../runtime/scope';
import type { ToggleFeature } from './types';

/** X's expanded photo viewer: a modal dialog in `#layers`. */
const VIEWER = '[aria-modal="true"]';
/** The viewer's own arrows. X renders each only when there is a photo in that direction. */
const NEXT = ':is([data-testid="Carousel-NavRight"], [aria-label="Next slide"])';
const PREV = ':is([data-testid="Carousel-NavLeft"], [aria-label="Previous slide"])';
/** Where a drag may begin: the photo itself or the slide around it. */
const SLIDE = 'img, [data-testid="swipe-to-dismiss"], li[role="listitem"]';
/** Never begin on these: X's controls, links, video players, text fields, the post beside the photo. */
const NOT_DRAGGABLE =
  'button, [role="button"], a[href], video, [data-testid="videoPlayer"], [data-testid="videoComponent"], input, textarea, [contenteditable="true"], [role="slider"], article';

/** Set on <html> only while a photo is being dragged. */
export const DRAGGING_ATTR = 'data-bx-photo-dragging';
/** Movement before a press becomes a drag; anything less stays an ordinary click. */
export const START_PX = 8;
/** How far a drag must travel to change photo instead of snapping back. */
export const commitDistance = (viewerWidth: number) =>
  Math.max(48, Math.min(96, viewerWidth * 0.06));
/** How much the photo follows the pointer when there is nothing in that direction. */
const EDGE_RESISTANCE = 0.2;
const SETTLE_MS = 220;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  viewer: HTMLElement;
  /** What moves with the pointer: the row of slides when X has one, else the slide. */
  mover: HTMLElement;
  /** The mover's own inline `translate`, put back when the gesture ends. */
  translate: string;
  dragging: boolean;
  dx: number;
}

/**
 * Drag a photo sideways in X's expanded viewer to go to the next or previous one.
 *
 * One set of delegated listeners on the document, owned by `scope`: a viewer X opens later, or
 * a navigation between posts, needs nothing new and can never add a second handler. A press on a
 * photo becomes a drag only after 8 px of mostly horizontal movement; under that, or when the
 * movement is vertical, nothing is touched and X sees an ordinary click. While dragging, the row
 * of photos follows the pointer through the CSS `translate` property, which composes with (and
 * never replaces) the `transform` X's carousel uses; with no photo in that direction it follows
 * at a fifth of the distance. On release past the threshold the viewer's own arrow button is
 * clicked, so X does the navigation and its buttons and keys stay the single source of truth;
 * the offset then settles to zero with the Web Animations API (not at all under reduced motion).
 * The click a completed drag would produce is swallowed once. A gesture ends cleanly on release
 * anywhere (the pointer is captured), `pointercancel`, a lost capture, window blur or Escape.
 * The browser's own image-drag ghost is prevented inside a multi-photo viewer only.
 */
export function startPhotoDrag(scope: Scope, doc: Document = document): void {
  const root = doc.documentElement;
  const view = doc.defaultView ?? window;
  let gesture: Gesture | null = null;
  let swallowClick = false;

  const reducedMotion = () =>
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arrow = (viewer: Element, direction: 'next' | 'prev') =>
    viewer.querySelector<HTMLElement>(direction === 'next' ? NEXT : PREV);

  /** Ends the gesture. `commit` asks to change photo if the drag went far enough. */
  function end(commit: boolean) {
    const current = gesture;
    if (!current) return;
    gesture = null;
    if (!current.dragging) return;
    root.removeAttribute(DRAGGING_ATTR);
    const { mover, viewer, dx } = current;
    try {
      mover.releasePointerCapture(current.pointerId);
    } catch {
      /* already released */
    }
    const from = mover.style.translate;
    mover.style.translate = current.translate;
    const target = arrow(viewer, dx < 0 ? 'next' : 'prev');
    const go = commit && Math.abs(dx) >= commitDistance(viewer.clientWidth) && target;
    if (!reducedMotion() && typeof mover.animate === 'function' && mover.isConnected)
      mover.animate([{ translate: from }, { translate: current.translate || '0px 0px' }], {
        duration: SETTLE_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    if (go) target.click();
  }

  scope.add(() => end(false));

  scope.listen(
    doc,
    'pointerdown',
    (event) => {
      const e = event as PointerEvent;
      end(false);
      // Touch already swipes X's viewer natively; this is for the mouse (and a pen).
      if (e.button !== 0 || !e.isPrimary || e.pointerType === 'touch') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const viewer = target?.closest<HTMLElement>(VIEWER);
      if (!target || !viewer) return;
      if (!target.closest(SLIDE) || target.closest(NOT_DRAGGABLE)) return;
      // A single photo has no arrows: there is nowhere to go, so nothing changes.
      if (!arrow(viewer, 'next') && !arrow(viewer, 'prev')) return;
      const mover =
        target.closest<HTMLElement>('ul[role="list"]') ??
        target.closest<HTMLElement>('[data-testid="swipe-to-dismiss"]') ??
        target.closest<HTMLElement>('img');
      if (!mover || !viewer.contains(mover)) return;
      gesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        viewer,
        mover,
        translate: mover.style.translate,
        dragging: false,
        dx: 0,
      };
    },
    { capture: true },
  );

  scope.listen(
    doc,
    'pointermove',
    (event) => {
      const e = event as PointerEvent;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      // The button came up somewhere this page never heard about.
      if (e.buttons === 0 || !gesture.mover.isConnected) return end(false);
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (!gesture.dragging) {
        if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
        // Mostly vertical: not ours. X keeps the press exactly as it was.
        if (Math.abs(dy) >= Math.abs(dx)) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        root.setAttribute(DRAGGING_ATTR, '');
        view.getSelection?.()?.removeAllRanges();
        try {
          gesture.mover.setPointerCapture(e.pointerId);
        } catch {
          /* the release is still heard on the document */
        }
      }
      e.preventDefault();
      gesture.dx = dx;
      const open = arrow(gesture.viewer, dx < 0 ? 'next' : 'prev');
      const offset = Math.round(open ? dx : dx * EDGE_RESISTANCE);
      gesture.mover.style.translate = `${offset}px 0px`;
    },
    { capture: true },
  );

  scope.listen(
    doc,
    'pointerup',
    (event) => {
      const e = event as PointerEvent;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      const dragged = gesture.dragging;
      // First: this may press X's arrow, and that click must go through.
      end(true);
      if (dragged) {
        // The click the browser sends after this release belongs to the drag, not to X.
        swallowClick = true;
        scope.setTimeout(() => (swallowClick = false), 80);
      }
    },
    { capture: true },
  );

  const cancel = (event: Event) => {
    if (gesture && (event as PointerEvent).pointerId === gesture.pointerId) end(false);
  };
  scope.listen(doc, 'pointercancel', cancel, { capture: true });
  scope.listen(doc, 'lostpointercapture', cancel, { capture: true });
  scope.listen(view, 'blur', () => end(false));
  scope.listen(
    doc,
    'keydown',
    (event) => {
      if ((event as KeyboardEvent).key === 'Escape') end(false);
    },
    { capture: true },
  );

  scope.listen(
    doc,
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );

  // The browser would otherwise lift a ghost copy of the image and the drag would never start.
  scope.listen(
    doc,
    'dragstart',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const viewer = target?.closest(VIEWER);
      if (!target || !viewer || !target.closest(SLIDE) || target.closest(NOT_DRAGGABLE)) return;
      if (arrow(viewer, 'next') || arrow(viewer, 'prev')) event.preventDefault();
    },
    { capture: true },
  );
}

export const dragPhotos: ToggleFeature = {
  id: 'posts.dragPhotos',
  category: 'posts',
  title: 'Drag to navigate photos',
  description:
    'In the expanded photo viewer, drag a photo left or right to move between a post’s photos.',
  keywords: ['swipe', 'carousel', 'gallery', 'image', 'lightbox', 'slide', 'mouse'],
  kind: 'toggle',
  defaultEnabled: false,
  css: `
html[${DRAGGING_ATTR}],
html[${DRAGGING_ATTR}] * {
  cursor: grabbing !important;
  user-select: none !important;
}`,
  activate({ scope }) {
    startPhotoDrag(scope);
  },
};
