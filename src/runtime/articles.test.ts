// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from './scope';
import { watchArticles } from './articles';

/** Frames run only when the test says so, so ordering against the observer is deterministic. */
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const runFrames = () => {
  const due = [...frames.values()];
  frames.clear();
  due.forEach((callback) => callback(0));
};
/** Lets the observer deliver its queued records. */
const deliver = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const scope = new Scope();
  const enhance = vi.fn();
  const afterBatch = vi.fn();
  watchArticles(scope, { root: document.body, selector: 'article', enhance, afterBatch });
  return { scope, enhance, afterBatch };
}

beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('watchArticles', () => {
  it('enhances added articles, including nested ones, in one batch per frame', async () => {
    const { scope, enhance, afterBatch } = setup();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<article id="a"></article><section><article id="b"></article></section>';
    document.body.append(wrapper);
    document.body.append(document.createElement('article'));
    await deliver();
    runFrames();
    expect(enhance).toHaveBeenCalledTimes(3);
    expect(afterBatch).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  it('re-enhances an article when its text or link changes (recycled element)', async () => {
    document.body.innerHTML = '<article><a href="/status/1">one</a></article>';
    const { scope, enhance } = setup();
    const article = document.querySelector('article')!;
    const link = article.querySelector('a')!;
    link.setAttribute('href', '/status/2');
    await deliver();
    runFrames();
    expect(enhance).toHaveBeenCalledWith(article);
    enhance.mockClear();
    link.firstChild!.textContent = 'two';
    await deliver();
    runFrames();
    expect(enhance).toHaveBeenCalledWith(article);
    scope.dispose();
  });

  it('skips an article that was removed before the frame ran', async () => {
    const { scope, enhance } = setup();
    const article = document.createElement('article');
    document.body.append(article);
    await deliver();
    article.remove();
    runFrames();
    expect(enhance).not.toHaveBeenCalled();
    scope.dispose();
  });

  it('stops observing when its scope is disposed', async () => {
    const { scope, enhance, afterBatch } = setup();
    scope.dispose();
    document.body.append(document.createElement('article'));
    await deliver();
    runFrames();
    expect(enhance).not.toHaveBeenCalled();
    expect(afterBatch).not.toHaveBeenCalled();
  });

  it('drops a batch that was scheduled but not yet run when the scope is disposed', async () => {
    const { scope, enhance, afterBatch } = setup();
    document.body.append(document.createElement('article'));
    await deliver(); // observer delivered, frame pending
    expect(frames.size).toBe(1);
    scope.dispose();
    expect(frames.size).toBe(0);
    runFrames();
    expect(enhance).not.toHaveBeenCalled();
    expect(afterBatch).not.toHaveBeenCalled();
  });

  it('disconnects the document observer it created', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { scope } = setup();
    scope.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);
    disconnect.mockRestore();
  });
});
