import { useEffect, type RefObject } from 'react';

const DRAG_THRESHOLD = 4;
const FRICTION = 0.94;
const STOP_SPEED = 0.05;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smoothly scrolls a row sideways so `item` sits in its middle (as far as the row can go). */
export function centerInRow(row: HTMLElement, item: HTMLElement) {
  const target = item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2;
  const max = row.scrollWidth - row.clientWidth;
  row.scrollTo({
    left: Math.min(max, Math.max(0, target)),
    behavior: reducedMotion() ? 'auto' : 'smooth',
  });
}

/**
 * Lets a mouse do what a trackpad or finger already can on a sideways-scrolling row: drag it,
 * with a little momentum when let go, and turn the wheel to move it. A click that was really a
 * drag is swallowed, so letting go over a chip never presses it. Touch is left to the browser.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;

    let startX = 0;
    let startScroll = 0;
    let pointer: number | null = null;
    let dragging = false;
    let moved = false;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let frame = 0;

    const stopMomentum = () => cancelAnimationFrame(frame);
    function glide() {
      row!.scrollLeft -= velocity;
      velocity *= FRICTION;
      if (Math.abs(velocity) > STOP_SPEED) frame = requestAnimationFrame(glide);
    }

    function down(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (row!.scrollWidth <= row!.clientWidth) return;
      stopMomentum();
      pointer = event.pointerId;
      startX = lastX = event.clientX;
      startScroll = row!.scrollLeft;
      lastTime = performance.now();
      velocity = 0;
      moved = false;
    }
    function move(event: PointerEvent) {
      if (event.pointerId !== pointer) return;
      const distance = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(distance) < DRAG_THRESHOLD) return;
        dragging = true;
        moved = true;
        row!.setPointerCapture(event.pointerId);
        row!.classList.add('is-dragging');
      }
      row!.scrollLeft = startScroll - distance;
      const now = performance.now();
      const elapsed = Math.max(1, now - lastTime);
      // Pixels per ~frame, smoothed so one jittery sample does not throw the row.
      velocity = velocity * 0.6 + ((event.clientX - lastX) / elapsed) * 16 * 0.4;
      lastX = event.clientX;
      lastTime = now;
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== pointer) return;
      pointer = null;
      if (dragging) {
        dragging = false;
        row!.classList.remove('is-dragging');
        if (row!.hasPointerCapture(event.pointerId)) row!.releasePointerCapture(event.pointerId);
        if (performance.now() - lastTime < 80 && !reducedMotion())
          frame = requestAnimationFrame(glide);
      }
    }
    function click(event: MouseEvent) {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    }
    function wheel(event: WheelEvent) {
      if (row!.scrollWidth <= row!.clientWidth) return;
      // A sideways wheel or trackpad already works; only turn a plain vertical wheel sideways.
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      stopMomentum();
      row!.scrollLeft += event.deltaY;
    }

    row.addEventListener('pointerdown', down);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', up);
    row.addEventListener('click', click, true);
    row.addEventListener('wheel', wheel, { passive: false });
    return () => {
      stopMomentum();
      row.removeEventListener('pointerdown', down);
      row.removeEventListener('pointermove', move);
      row.removeEventListener('pointerup', up);
      row.removeEventListener('pointercancel', up);
      row.removeEventListener('click', click, true);
      row.removeEventListener('wheel', wheel);
    };
  }, [ref]);
}
