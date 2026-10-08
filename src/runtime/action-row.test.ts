// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionRow, type ActionSlot } from './action-row';
import { createPostStream } from './posts';
import { Scope } from './scope';

const ROW = `<div role="group"><button data-testid="reply"><svg></svg></button><button><svg></svg></button></div>`;
/** A post as the identity and action-row code read it. `row: false` is a post X has not finished rendering. */
const article = (id: string, row = true) =>
  `<article><a href="https://x.com/u/status/${id}"><time datetime="2024-01-01T00:00:00Z"></time></a>${row ? ROW : ''}</article>`;

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const runFrames = () => {
  const due = [...frames.values()];
  frames.clear();
  due.forEach((callback) => callback(0));
};
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  runFrames();
};

const button = (label: string) => {
  const node = document.createElement('button');
  node.textContent = label;
  node.innerHTML += '<svg></svg>';
  return node;
};
function slot(id: string, extra: Partial<ActionSlot> = {}) {
  const create = vi.fn(() => button(id));
  const update = vi.fn();
  return { slot: { id, create, update, ...extra } satisfies ActionSlot, create, update };
}
const mountedIn = (post: Element, id: string) =>
  post.querySelectorAll(`[data-bx-slot="${id}"]`).length;

/** Every scope a test makes, disposed afterwards so one test's observers never touch the next. */
const scopes: Scope[] = [];

function setup() {
  const scope = new Scope();
  scopes.push(scope);
  const posts = createPostStream(scope);
  const actionRow = createActionRow(scope, posts);
  return { scope, posts, actionRow };
}

beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  document.body.innerHTML = '';
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.dispose());
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ActionRow: mounting', () => {
  it('puts the slot in the post’s action row, once, however often the post changes', async () => {
    const { actionRow } = setup();
    const { slot: save, create } = slot('save');
    actionRow.register(save);
    document.body.insertAdjacentHTML('beforeend', article('1'));
    await flush();
    const post = document.querySelector('article')!;
    for (let i = 0; i < 3; i++) {
      post.insertAdjacentHTML('beforeend', '<span></span>');
      await flush();
    }
    expect(post.querySelectorAll('[role="group"] > [data-bx-slot="save"]')).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('mounts a post whose action row arrives after the article', async () => {
    const { actionRow } = setup();
    actionRow.register(slot('save').slot);
    document.body.insertAdjacentHTML('beforeend', article('1', false));
    await flush();
    const post = document.querySelector('article')!;
    expect(mountedIn(post, 'save')).toBe(0);
    post.insertAdjacentHTML('beforeend', ROW);
    await flush();
    expect(mountedIn(post, 'save')).toBe(1);
  });

  it('mounts the posts already on the page when a slot registers late', () => {
    document.body.innerHTML = article('1') + article('2');
    const { actionRow } = setup();
    const { slot: save, create } = slot('save');
    actionRow.register(save);
    expect(document.querySelectorAll('[data-bx-slot="save"]')).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not mount into a nested (quoted) post', async () => {
    const { actionRow } = setup();
    actionRow.register(slot('save').slot);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<article><a href="https://x.com/u/status/1"></a>${ROW}${article('2')}</article>`,
    );
    await flush();
    expect(document.querySelectorAll('[data-bx-slot="save"]')).toHaveLength(1);
    expect(document.querySelector('article article [data-bx-slot]')).toBeNull();
  });
});

describe('ActionRow: recycled and re-rendered posts', () => {
  it('re-targets the same element when X reuses the post element for another post', async () => {
    document.body.innerHTML = article('1');
    const { actionRow } = setup();
    const { slot: save, create, update } = slot('save');
    actionRow.register(save);
    const element = document.querySelector<HTMLElement>('[data-bx-slot="save"]')!;
    expect(actionRow.postOf(element)).toBe('1');
    document.querySelector('a')!.setAttribute('href', 'https://x.com/u/status/2');
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0]).toBe(element);
    expect(update.mock.calls[0]![1].identity.tweetId).toBe('2');
    expect(actionRow.postOf(element)).toBe('2');
    expect(mountedIn(document.querySelector('article')!, 'save')).toBe(1);
  });

  it('does not call update when the post is unchanged', async () => {
    document.body.innerHTML = article('1');
    const { actionRow } = setup();
    const { slot: save, update } = slot('save');
    actionRow.register(save);
    document.querySelector('article')!.insertAdjacentHTML('beforeend', '<span></span>');
    await flush();
    expect(update).not.toHaveBeenCalled();
  });

  it('mounts again, without a duplicate, when X re-renders the whole action row', async () => {
    document.body.innerHTML = article('1');
    const { actionRow } = setup();
    const { slot: save, create } = slot('save');
    actionRow.register(save);
    const post = document.querySelector('article')!;
    post
      .querySelector('[role="group"]')!
      .replaceWith(
        Object.assign(document.createElement('div'), { innerHTML: ROW }).firstElementChild!,
      );
    await flush();
    expect(mountedIn(post, 'save')).toBe(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(actionRow.elements('save')).toHaveLength(1);
  });
});

describe('ActionRow: several actions', () => {
  it('lets slots coexist in order, whatever order they registered in', () => {
    document.body.innerHTML = article('1');
    const { actionRow } = setup();
    actionRow.register(slot('late', { order: 300 }).slot);
    actionRow.register(slot('first', { order: 50 }).slot);
    actionRow.register(slot('save').slot);
    const ids = [...document.querySelectorAll('[role="group"] > [data-bx-slot]')].map(
      (node) => (node as HTMLElement).dataset.bxSlot,
    );
    expect(ids).toEqual(['first', 'save', 'late']);
    // Native controls stay first and untouched.
    expect(
      document.querySelector('[role="group"]')!.firstElementChild!.getAttribute('data-testid'),
    ).toBe('reply');
  });

  it('refuses a second slot with the same id', () => {
    const { actionRow } = setup();
    actionRow.register(slot('save').slot);
    expect(() => actionRow.register(slot('save').slot)).toThrow(/already registered/);
  });

  it('removes only a slot’s own elements when it unregisters, and frees its id', () => {
    document.body.innerHTML = article('1');
    const { actionRow } = setup();
    const stop = actionRow.register(slot('one').slot);
    actionRow.register(slot('two').slot);
    stop();
    const post = document.querySelector('article')!;
    expect(mountedIn(post, 'one')).toBe(0);
    expect(mountedIn(post, 'two')).toBe(1);
    expect(() => actionRow.register(slot('one').slot)).not.toThrow();
  });
});

describe('ActionRow: lifetime', () => {
  it('removes everything it mounted and stops mounting when its scope is disposed', async () => {
    document.body.innerHTML = article('1');
    const { scope, actionRow } = setup();
    const { slot: save, create } = slot('save');
    actionRow.register(save);
    scope.dispose();
    expect(document.querySelectorAll('[data-bx-slot]')).toHaveLength(0);
    document.body.insertAdjacentHTML('beforeend', article('2'));
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-bx-slot]')).toHaveLength(0);
  });

  it('cancels a pending alignment frame on disposal', () => {
    document.body.innerHTML = article('1');
    const { scope, actionRow } = setup();
    actionRow.register(slot('save').slot);
    expect(frames.size).toBeGreaterThan(0);
    scope.dispose();
    expect(frames.size).toBe(0);
  });
});
