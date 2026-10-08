import { actionRow, X_SELECTORS } from '../x/selectors';
import type { PostStream, StreamPost } from './posts';
import type { Disposer, Scope } from './scope';

/** What a slot is told about the post it is mounted on. */
export type SlotPost = Pick<StreamPost, 'article' | 'identity'>;

/**
 * One Better X action in a post's action row (the row of reply, repost, like, ... icons). The
 * save control is one; any later feature that adds an action registers another slot. The
 * service, not the slot, owns where it goes, how it lines up with X's icons and when it is
 * removed, so slots cannot duplicate or collide.
 */
export interface ActionSlot {
  /** Unique among slots; written to the element as `data-bx-slot`. */
  id: string;
  /** Position among Better X's own actions in a row, ascending. Default 100. */
  order?: number;
  /** Builds the element for a post. Called once per post element; return an element with an `svg`. */
  create(post: SlotPost): HTMLElement;
  /** Called when X reuses a post element for another post; the element must now show that post. */
  update?(element: HTMLElement, post: SlotPost): void;
}

export interface ActionRowService {
  /**
   * Adds the slot to every post now on the page and to each post that appears. Throws if the id
   * is taken. The returned function removes the slot and its elements.
   */
  register(slot: ActionSlot): Disposer;
  /** The post an element mounted by this service currently shows, or null. */
  postOf(element: Element): string | null;
  /** The connected elements mounted for a slot. */
  elements<T extends HTMLElement = HTMLElement>(slotId: string): T[];
  /** Re-measures every mounted element against X's icons (they follow window changes on their own). */
  align(): void;
}

const DEFAULT_ORDER = 100;

interface Mounted {
  slot: ActionSlot;
  tweetId: string;
}

/**
 * Places Better X actions into the action row of every post on the shared PostStream: one
 * element per slot per post element, however often X re-renders or recycles the post.
 */
export function createActionRow(scope: Scope, posts: PostStream): ActionRowService {
  const slots = new Map<string, ActionSlot>();
  const mounted = new Map<HTMLElement, Mounted>();

  function mountSlot(slot: ActionSlot, post: SlotPost, rowOf: () => HTMLElement | null): boolean {
    const { article, identity } = post;
    const existing = article.querySelector<HTMLElement>(`[data-bx-slot="${slot.id}"]`);
    if (existing && existing.closest(X_SELECTORS.post) === article) {
      const info = mounted.get(existing);
      if (info && info.tweetId !== identity.tweetId) {
        // X reused this post element for another post.
        info.tweetId = identity.tweetId;
        slot.update?.(existing, post);
        queueAlign(existing);
      }
      return true;
    }
    const row = rowOf();
    if (!row) return false;
    const order = slot.order ?? DEFAULT_ORDER;
    const element = slot.create(post);
    element.dataset.bxSlot = slot.id;
    element.dataset.bxOrder = String(order);
    mounted.set(element, { slot, tweetId: identity.tweetId });
    const after = [...row.children].find(
      (child) => child instanceof HTMLElement && Number(child.dataset.bxOrder) > order,
    );
    row.insertBefore(element, after ?? null);
    queueAlign(element);
    return true;
  }

  function mountPost(post: SlotPost, only?: ActionSlot) {
    let row: HTMLElement | null | undefined;
    const rowOf = () => (row === undefined ? (row = actionRow(post.article)) : row);
    for (const slot of only ? [only] : slots.values()) if (!mountSlot(slot, post, rowOf)) break;
  }

  const forget = () => {
    for (const element of mounted.keys()) if (!element.isConnected) mounted.delete(element);
  };

  /* ---------------------------------------------------------------------- alignment */

  /**
   * Matches each element to X's own icons in the same row: icon size and button box come from
   * the last native control (Share), then any remaining vertical offset is measured and
   * corrected. This holds across timeline/detail layouts, X font sizes, and zoom.
   */
  function measure(targets: Iterable<HTMLElement>) {
    const jobs = [...targets].flatMap((control) => {
      const row = control.parentElement;
      const native = row
        ? [...row.querySelectorAll<HTMLElement>('button, a[href]')].filter(
            (item) => !item.closest('[data-bx-slot]') && item.querySelector('svg'),
          )
        : [];
      // The last visible native icon; narrow layouts can hide part of the row.
      const reference = native
        .reverse()
        .find((item) => item.querySelector('svg')!.getBoundingClientRect().height > 0);
      const glyph = reference?.querySelector('svg')?.getBoundingClientRect();
      if (!reference || !glyph?.height || !control.isConnected) return [];
      const box = reference.getBoundingClientRect().height;
      return [{ control, glyph, box }];
    });
    for (const { control, glyph, box } of jobs) {
      const size = Math.min(Math.max(glyph.height, 14), 32);
      control.style.setProperty('--bx-icon', `${size}px`);
      control.style.setProperty('--bx-box', `${Math.min(Math.max(box, size), 48)}px`);
    }
    const offsets = jobs.map(({ control, glyph }) => {
      const own = control.querySelector('svg')?.getBoundingClientRect();
      const current = Number(control.dataset.offset) || 0;
      if (!own?.height) return current;
      const delta = glyph.top + glyph.height / 2 - (own.top + own.height / 2);
      return Math.max(-20, Math.min(20, Math.round((current + delta) * 2) / 2));
    });
    jobs.forEach(({ control }, index) => {
      const offset = offsets[index] ?? 0;
      control.dataset.offset = String(offset);
      control.style.setProperty('--bx-dy', `${offset}px`);
    });
  }

  const unaligned = new Set<HTMLElement>();
  let cancelAlign: Disposer = () => {};
  function queueAlign(element?: HTMLElement) {
    if (element) unaligned.add(element);
    else mounted.forEach((_, item) => unaligned.add(item));
    cancelAlign();
    cancelAlign = scope.requestFrame(() => {
      measure(unaligned);
      unaligned.clear();
    });
  }

  let cancelResize: Disposer = () => {};
  scope.listen(window, 'resize', () => {
    cancelResize();
    cancelResize = scope.setTimeout(() => queueAlign(), 150);
  });

  // Leaves nothing of ours on the page when the scope ends.
  scope.add(() => {
    mounted.forEach((_, element) => element.remove());
    mounted.clear();
  });

  // Last, so everything the handlers use exists; no slot is registered yet, so nothing mounts.
  scope.add(posts.onPost((post) => mountPost(post), { replay: true }));
  scope.add(posts.onBatch(forget));

  return {
    register(slot) {
      if (slots.has(slot.id)) throw new Error(`Action slot "${slot.id}" is already registered`);
      slots.set(slot.id, slot);
      for (const post of posts.posts()) mountPost(post, slot);
      return () => {
        if (slots.get(slot.id) !== slot) return;
        slots.delete(slot.id);
        for (const [element, info] of mounted)
          if (info.slot === slot) {
            element.remove();
            mounted.delete(element);
          }
      };
    },
    postOf: (element) => mounted.get(element as HTMLElement)?.tweetId ?? null,
    elements: <T extends HTMLElement>(slotId: string) =>
      [...mounted].flatMap(([element, info]) =>
        info.slot.id === slotId && element.isConnected ? [element as T] : [],
      ),
    align: () => queueAlign(),
  };
}
