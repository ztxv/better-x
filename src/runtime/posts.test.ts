// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostStream, type StreamPost } from './posts';
import { Scope } from './scope';

/** A post article the way the identity code reads it: a status link inside an article. */
const article = (id: string, extra = '') =>
  `<article data-id="${id}"><a href="https://x.com/user/status/${id}"><time datetime="2024-01-01T00:00:00Z"></time></a>${extra}</article>`;

/** Frames run only when the test says so; the observer's delivery is awaited separately. */
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const runFrames = () => {
  const due = [...frames.values()];
  frames.clear();
  due.forEach((callback) => callback(0));
};
const deliver = () => new Promise((resolve) => setTimeout(resolve, 0));
const flush = async () => {
  await deliver();
  runFrames();
};

/** Every scope a test makes, disposed afterwards so one test's observers never touch the next. */
const scopes: Scope[] = [];

function setup() {
  const scope = new Scope();
  scopes.push(scope);
  const stream = createPostStream(scope);
  const seen: Array<[string, StreamPost['reason']]> = [];
  stream.onPost(({ identity, reason }) => seen.push([identity.tweetId, reason]));
  return { scope, stream, seen };
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

describe('PostStream', () => {
  it('reports a post that appears, once, as new', async () => {
    const { scope, seen } = setup();
    document.body.insertAdjacentHTML('beforeend', article('1'));
    await flush();
    expect(seen).toEqual([['1', 'new']]);
    scope.dispose();
  });

  it('reports a post that was already on the page to a listener that asks for a replay', () => {
    document.body.innerHTML = article('1') + article('2');
    const scope = new Scope();
    const stream = createPostStream(scope);
    const late: string[] = [];
    const quiet: string[] = [];
    stream.onPost((post) => quiet.push(post.identity.tweetId));
    stream.onPost((post) => late.push(`${post.identity.tweetId}:${post.reason}`), { replay: true });
    expect(late).toEqual(['1:new', '2:new']);
    expect(quiet).toEqual([]);
    expect(stream.posts().map((post) => post.identity.tweetId)).toEqual(['1', '2']);
  });

  it('reports an element X reuses for another post as recycled, not new', async () => {
    document.body.innerHTML = article('1');
    const { seen } = setup();
    const link = document.querySelector('a')!;
    link.setAttribute('href', 'https://x.com/other/status/2');
    await flush();
    expect(seen).toEqual([['2', 'recycled']]);
  });

  it('reports later changes inside the same post as changed, so late-rendered parts are seen', async () => {
    document.body.innerHTML = article('1');
    const { seen } = setup();
    document.querySelector('article')!.insertAdjacentHTML('beforeend', '<div role="group"></div>');
    await flush();
    expect(seen).toEqual([['1', 'changed']]);
  });

  it('reports an element once per frame however many changes it saw', async () => {
    document.body.innerHTML = article('1');
    const { seen } = setup();
    const post = document.querySelector('article')!;
    for (let i = 0; i < 5; i++) post.insertAdjacentHTML('beforeend', '<span></span>');
    await flush();
    expect(seen).toHaveLength(1);
  });

  it('does not report quoted posts or articles that show no post', async () => {
    const { seen } = setup();
    document.body.insertAdjacentHTML(
      'beforeend',
      article('1', article('2')) + '<article>no status link</article>',
    );
    await flush();
    expect(seen).toEqual([['1', 'new']]);
  });

  it('stops reporting to a listener that unsubscribes', async () => {
    const { stream } = setup();
    const listener = vi.fn();
    const stop = stream.onPost(listener);
    stop();
    document.body.insertAdjacentHTML('beforeend', article('1'));
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('forgets posts that leave the page', async () => {
    const { stream } = setup();
    document.body.insertAdjacentHTML('beforeend', article('1') + article('2'));
    await flush();
    document.querySelector('article')!.remove();
    document.body.insertAdjacentHTML('beforeend', '<div></div>');
    await flush();
    expect(stream.posts().map((post) => post.identity.tweetId)).toEqual(['2']);
  });

  it('tells batch listeners which post elements left the page', async () => {
    const { stream } = setup();
    document.body.insertAdjacentHTML('beforeend', article('1') + article('2'));
    await flush();
    const first = document.querySelector('article')!;
    const gone: HTMLElement[][] = [];
    stream.onBatch((removed) => gone.push([...removed]));
    first.remove();
    document.body.insertAdjacentHTML('beforeend', article('3'));
    await flush();
    expect(gone).toEqual([[first]]);
  });

  it('calls batch listeners once after each round of reports', async () => {
    const { stream } = setup();
    const batches: number[] = [];
    let reports = 0;
    stream.onPost(() => reports++);
    stream.onBatch(() => batches.push(reports));
    document.body.insertAdjacentHTML('beforeend', article('1') + article('2'));
    await flush();
    expect(batches).toEqual([2]);
  });

  it('keeps reporting to other listeners when one throws', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { stream } = setup();
    const later = vi.fn();
    stream.onPost(() => {
      throw new Error('boom');
    });
    stream.onPost(later);
    document.body.insertAdjacentHTML('beforeend', article('1'));
    await flush();
    expect(later).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    report.mockRestore();
  });

  it('adds no observer of its own per consumer', () => {
    const created = vi.fn();
    const Real = globalThis.MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends Real {
        constructor(callback: MutationCallback) {
          super(callback);
          created();
        }
      },
    );
    const scope = new Scope();
    const stream = createPostStream(scope);
    stream.onPost(() => {});
    stream.onPost(() => {}, { replay: true });
    stream.onBatch(() => {});
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('stops observing, reporting and holding posts when its scope is disposed', async () => {
    const { scope, stream, seen } = setup();
    document.body.insertAdjacentHTML('beforeend', article('1'));
    await flush();
    scope.dispose();
    document.body.insertAdjacentHTML('beforeend', article('2'));
    await flush();
    expect(seen).toEqual([['1', 'new']]);
    expect(stream.posts()).toEqual([]);
  });
});
