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

/** A photo or video in a post's media, on a timeline or a post's page. */
const POST_MEDIA = '[data-testid="tweetPhoto"], [data-testid="videoComponent"]';
/** Inside a post, a press here is never a drag (a video's controls, the ALT badge, text fields). */
const TIMELINE_NOT_DRAGGABLE =
  'button, [role="button"], video, [data-testid="videoPlayer"], input, textarea, [contenteditable="true"], [role="slider"]';
/** Inline carousels may draw their own arrows: the viewer's names, plus the short ones. */
const INLINE_NEXT = `${NEXT}, [aria-label="Next"]`;
const INLINE_PREV = `${PREV}, [aria-label="Previous"]`;

/**
 * The element that scrolls a post's photos sideways: the nearest ancestor of `media`, inside the
 * post, that is wider inside than out, may scroll horizontally, and holds at least two photos or
 * videos. Null for a single photo or a grid (nothing to move).
 */
export function findCarousel(media: Element, post: Element): HTMLElement | null {
  const view = media.ownerDocument.defaultView ?? window;
  for (let el = media.parentElement; el && el !== post; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const overflow = view.getComputedStyle(el).overflowX;
    if (overflow === 'visible' || overflow === 'clip') continue;
    if (el.querySelectorAll(POST_MEDIA).length >= 2) return el;
  }
  return null;
}

/**
 * Where a carousel can rest, in `scrollLeft` pixels, sorted: the snap positions its slides ask
 * for (`scroll-snap-align`), or failing those the left edge of each photo; 0 and the end too.
 */
export function snapPoints(carousel: HTMLElement): number[] {
  const view = carousel.ownerDocument.defaultView ?? window;
  const box = carousel.getBoundingClientRect();
  const max = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
  const pad = parseFloat(view.getComputedStyle(carousel).scrollPaddingLeft) || 0;
  const aligned = [...carousel.querySelectorAll<HTMLElement>('*')]
    .map((el) => [el, (view.getComputedStyle(el).scrollSnapAlign || '').split(' ').pop()] as const)
    .filter(([, align]) => align && align !== 'none');
  const items: ReadonlyArray<readonly [Element, string | undefined]> = aligned.length
    ? aligned
    : [...carousel.querySelectorAll(POST_MEDIA)].map((el) => [el, 'start'] as const);
  const points = items.map(([el, align]) => {
    const rect = el.getBoundingClientRect();
    const left = rect.left - box.left + carousel.scrollLeft;
    const x =
      align === 'center'
        ? left + rect.width / 2 - carousel.clientWidth / 2
        : align === 'end'
          ? left + rect.width - carousel.clientWidth
          : left - pad;
    return Math.min(max, Math.max(0, Math.round(x)));
  });
  return [...new Set([0, max, ...points])].sort((a, b) => a - b);
}

/**
 * Where a drag that started at scroll position `start` and was let go at `now` comes to rest. A
 * short drag (`commit` false) goes back; a longer one rests on the snap point nearest to where it
 * was let go, and always at least one photo along in the direction it was dragged.
 */
export function restingPoint(
  points: readonly number[],
  start: number,
  now: number,
  commit: boolean,
): number {
  if (!commit || points.length === 0) return start;
  const nearest = points.reduce((best, p) => (Math.abs(p - now) < Math.abs(best - now) ? p : best));
  if (now > start && nearest <= start + 1) return points.find((p) => p > start + 1) ?? nearest;
  if (now < start && nearest >= start - 1)
    return [...points].reverse().find((p) => p < start - 1) ?? nearest;
  return nearest;
}

interface InlineGesture {
  pointerId: number;
  startX: number;
  startY: number;
  post: HTMLElement;
  /** The scrolling row of photos, or null when X moves them with its arrows instead. */
  carousel: HTMLElement | null;
  /** Without a scrolling row: what follows the pointer, and its own inline `translate`. */
  mover: HTMLElement;
  translate: string;
  startScroll: number;
  /** The carousel's inline snap type and scroll behavior, put back once it has settled. */
  snap: string;
  behavior: string;
  dragging: boolean;
  dx: number;
}

/**
 * Drag a post's photos left and right where they are, on a timeline or a post's page, without
 * opening the photo viewer. Built like `startPhotoDrag`: delegated listeners owned by `scope`,
 * 8 px of mostly horizontal movement before anything happens, the click after a drag swallowed
 * (so the viewer does not open), and a clean end on release, cancel, blur or Escape.
 *
 * When X shows the photos in a row that scrolls sideways (its desktop carousel), the drag scrolls
 * that row directly, with scroll snapping paused so it follows the pointer exactly; on release it
 * glides to the next photo in the drag's direction (or back, after a short drag) and snapping is
 * restored when the scroll ends. When the row does not scroll but X draws arrows, the photos
 * follow the pointer with `translate` and X's arrow is clicked, as in the viewer. A single photo
 * or a grid is left alone. The browser's drag ghost is prevented on photos that can be dragged.
 */
export function startTimelinePhotoDrag(scope: Scope, doc: Document = document): void {
  const root = doc.documentElement;
  const view = doc.defaultView ?? window;
  let gesture: InlineGesture | null = null;
  let swallowClick = false;

  const reducedMotion = () =>
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inlineArrow = (post: Element, direction: 'next' | 'prev') =>
    post.querySelector<HTMLElement>(direction === 'next' ? INLINE_NEXT : INLINE_PREV);

  /** The post's media under a press, when that press may start a drag. */
  function pressable(target: Element | null) {
    if (!target || target.closest(VIEWER)) return null;
    const media = target.closest<HTMLElement>(POST_MEDIA);
    const post = media?.closest<HTMLElement>('article');
    if (!media || !post) return null;
    // A control around the photo (X wraps photos in a link or a button-like box) is fine; one
    // inside it (the ALT badge, a video's controls) is not.
    const blocked = target.closest(TIMELINE_NOT_DRAGGABLE);
    if (blocked && !blocked.contains(media)) return null;
    const carousel = findCarousel(media, post);
    if (!carousel && !inlineArrow(post, 'next') && !inlineArrow(post, 'prev')) return null;
    return { media, post, carousel };
  }

  function end(commit: boolean) {
    const current = gesture;
    if (!current) return;
    gesture = null;
    if (!current.dragging) return;
    root.removeAttribute(DRAGGING_ATTR);
    const { carousel, mover, dx } = current;
    try {
      (carousel ?? mover).releasePointerCapture(current.pointerId);
    } catch {
      /* already released */
    }
    if (carousel) {
      const go = commit && Math.abs(dx) >= commitDistance(carousel.clientWidth);
      const target = restingPoint(
        snapPoints(carousel),
        current.startScroll,
        carousel.scrollLeft,
        go,
      );
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        carousel.style.scrollSnapType = current.snap;
        carousel.style.scrollBehavior = current.behavior;
      };
      if (Math.abs(carousel.scrollLeft - target) < 1) return settle();
      carousel.addEventListener('scrollend', settle, { once: true });
      scope.setTimeout(settle, 900);
      carousel.scrollTo({ left: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    const from = mover.style.translate;
    mover.style.translate = current.translate;
    const button = inlineArrow(current.post, dx < 0 ? 'next' : 'prev');
    const go = commit && Math.abs(dx) >= commitDistance(mover.clientWidth || 600) && button;
    if (!reducedMotion() && typeof mover.animate === 'function' && mover.isConnected)
      mover.animate([{ translate: from }, { translate: current.translate || '0px 0px' }], {
        duration: SETTLE_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    if (go) button.click();
  }

  scope.add(() => end(false));

  scope.listen(
    doc,
    'pointerdown',
    (event) => {
      const e = event as PointerEvent;
      end(false);
      // Touch already swipes a scrolling row natively; this is for the mouse (and a pen).
      if (e.button !== 0 || !e.isPrimary || e.pointerType === 'touch') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const found = pressable(e.target instanceof Element ? e.target : null);
      if (!found) return;
      const { media, post, carousel } = found;
      const mover =
        media.closest<HTMLElement>('ul[role="list"]') ?? media.closest<HTMLElement>('li') ?? media;
      gesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        post,
        carousel,
        mover,
        translate: mover.style.translate,
        startScroll: carousel?.scrollLeft ?? 0,
        snap: carousel?.style.scrollSnapType ?? '',
        behavior: carousel?.style.scrollBehavior ?? '',
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
      const current = gesture;
      if (!current || e.pointerId !== current.pointerId) return;
      const holder = current.carousel ?? current.mover;
      if (e.buttons === 0 || !holder.isConnected) return end(false);
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (!current.dragging) {
        if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
        // Mostly vertical: not ours.
        if (Math.abs(dy) >= Math.abs(dx)) {
          gesture = null;
          return;
        }
        current.dragging = true;
        root.setAttribute(DRAGGING_ATTR, '');
        view.getSelection?.()?.removeAllRanges();
        if (current.carousel) {
          // Snapping would fight the pointer; it comes back once the row has settled.
          current.carousel.style.scrollSnapType = 'none';
          current.carousel.style.scrollBehavior = 'auto';
        }
        try {
          holder.setPointerCapture(e.pointerId);
        } catch {
          /* the release is still heard on the document */
        }
      }
      e.preventDefault();
      current.dx = dx;
      if (current.carousel) {
        current.carousel.scrollLeft = current.startScroll - dx;
        return;
      }
      const open = inlineArrow(current.post, dx < 0 ? 'next' : 'prev');
      current.mover.style.translate = `${Math.round(open ? dx : dx * EDGE_RESISTANCE)}px 0px`;
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
      end(true);
      if (dragged) {
        // The click after this release would open the photo viewer.
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
  // Without this the browser lifts a ghost copy of the photo and no drag starts. X wraps photos
  // in links, and Chrome fires `dragstart` on the link, not the image: so any drag during a press
  // on a draggable photo is stopped, as is one that starts on a link around such a photo.
  scope.listen(
    doc,
    'dragstart',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const inner = target.matches(POST_MEDIA) ? null : target.querySelector(POST_MEDIA);
      if (gesture || pressable(target) || (inner && pressable(inner))) event.preventDefault();
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

export const dragTimelinePhotos: ToggleFeature = {
  id: 'posts.dragTimelinePhotos',
  category: 'posts',
  title: 'Also drag photos in the timeline',
  description:
    'Drag a post’s photos left or right where they are in your timeline, without opening the photo viewer.',
  keywords: ['swipe', 'carousel', 'gallery', 'image', 'inline', 'feed', 'mouse'],
  kind: 'toggle',
  defaultEnabled: false,
  requires: 'posts.dragPhotos',
  activate({ scope }) {
    startTimelinePhotoDrag(scope);
  },
};
