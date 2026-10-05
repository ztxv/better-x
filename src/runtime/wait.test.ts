// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from './wait';

/** Counts observers created and disconnected during a test. */
function trackObservers() {
  const Real = globalThis.MutationObserver;
  const live = new Set<MutationObserver>();
  vi.stubGlobal(
    'MutationObserver',
    class extends Real {
      constructor(callback: MutationCallback) {
        super(callback);
        live.add(this);
      }
      override disconnect() {
        live.delete(this);
        super.disconnect();
      }
    },
  );
  return live;
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('waitFor', () => {
  it('resolves at once when the target already exists, without observing', async () => {
    document.body.innerHTML = '<p id="here"></p>';
    const live = trackObservers();
    await expect(waitFor('#here')).resolves.toBe(document.getElementById('here'));
    expect(live.size).toBe(0);
  });

  it('resolves when the target is added later, then releases its observer and timer', async () => {
    const live = trackObservers();
    const found = waitFor('#late', { timeout: 5000 });
    expect(live.size).toBe(1);
    const late = document.createElement('p');
    late.id = 'late';
    document.body.append(late);
    await expect(found).resolves.toBe(late);
    expect(live.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a predicate and resolves with its value', async () => {
    const found = waitFor(() => document.body.dataset.ready && 'ready');
    document.body.dataset.ready = 'yes';
    await expect(found).resolves.toBe('ready');
  });

  it('only looks inside the given root', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const found = waitFor('.target', { root, timeout: 100 });
    const outside = document.createElement('i');
    outside.className = 'target';
    document.body.append(outside);
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    await expect(found).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('rejects on timeout and releases its observer', async () => {
    const live = trackObservers();
    const found = waitFor('#never', { timeout: 250 });
    const outcome = expect(found).rejects.toMatchObject({ name: 'TimeoutError' });
    vi.advanceTimersByTime(250);
    await outcome;
    expect(live.size).toBe(0);
  });

  it('rejects when the signal aborts, and releases its observer and timer', async () => {
    const live = trackObservers();
    const controller = new AbortController();
    const found = waitFor('#never', { signal: controller.signal, timeout: 5000 });
    const outcome = expect(found).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await outcome;
    expect(live.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects without observing when the signal is already aborted', async () => {
    const live = trackObservers();
    const controller = new AbortController();
    controller.abort();
    await expect(waitFor('#never', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(live.size).toBe(0);
  });
});
