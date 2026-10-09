// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshEnvironment } from '../test/fakes';
import { info, settle, tableTransport, testRuntime, until } from '../test/insights-env';
import { addPost } from '../test/x-markup';

const TABLE = { alice: info('alice', 'Germany'), bob: info('bob', 'Japan') };
let cleanup: Array<() => void> = [];
beforeEach(async () => {
  await freshEnvironment();
  document.body.innerHTML = '';
  cleanup = [];
});
afterEach(() => {
  cleanup.forEach((fn) => fn());
  document.body.innerHTML = '';
});

function setup() {
  const { transport, calls } = tableTransport(TABLE);
  const env = testRuntime(transport);
  cleanup.push(() => env.scope.dispose());
  return { ...env, calls };
}

describe('runtime.accounts', () => {
  it('asks for nothing until something is tracked, and creates no service before then', async () => {
    const { runtime, calls } = setup();
    addPost({ id: '1', handle: 'alice' });
    await settle();
    expect(calls).toEqual([]);
    expect(runtime.accounts.service.stats().cached).toBe(0);
  });

  it('looks up tracked accounts only when asked to (auto), and once per account', async () => {
    const { runtime, calls } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    const b = addPost({ id: '2', handle: 'alice' });
    const owner = {};
    runtime.accounts.track(owner, a, ['alice'], { auto: false });
    await settle();
    expect(calls).toEqual([]);
    runtime.accounts.track(owner, a, ['alice'], { auto: true });
    runtime.accounts.track(owner, b, ['Alice'], { auto: true });
    await until(() => calls.length > 0);
    await settle();
    expect(calls).toEqual(['alice']);
  });

  it('keeps one owner’s interest apart from another’s', async () => {
    const { runtime, calls } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    const one = {};
    const two = {};
    runtime.accounts.track(one, a, ['alice'], { auto: true });
    runtime.accounts.track(two, a, ['bob'], { auto: true });
    await until(() => calls.length === 2);
    expect([...calls].sort()).toEqual(['alice', 'bob']);
    const changed: string[] = [];
    runtime.accounts.onChange((articles) => articles.forEach(() => changed.push('x')));
    runtime.accounts.untrack(one, a);
    await runtime.accounts.service.request('alice', { force: true });
    await settle();
    // bob is still tracked by the other owner; alice is not, so a new answer for alice reports nothing.
    expect(changed).toEqual([]);
    await runtime.accounts.service.request('bob', { force: true });
    await settle();
    expect(changed.length).toBe(1);
  });

  it('reports the articles of an account whose answer arrives, once per frame', async () => {
    const { runtime } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    const b = addPost({ id: '2', handle: 'alice' });
    const seen: number[] = [];
    runtime.accounts.onChange((articles) => seen.push(articles.size));
    const owner = {};
    runtime.accounts.track(owner, a, ['alice'], { auto: true });
    runtime.accounts.track(owner, b, ['alice'], { auto: true });
    await until(() => seen.length > 0);
    expect(seen).toEqual([2]);
  });

  it('forgets posts that left the page', async () => {
    const { runtime, calls } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    await settle(150); // the post stream has seen the post
    const owner = {};
    runtime.accounts.track(owner, a, ['alice'], { auto: true });
    a.closest('[data-testid="cellInnerDiv"]')!.remove();
    // A later post batch prunes the removed article's interest.
    addPost({ id: '2', handle: 'bob' });
    await settle(150);
    const seen: number[] = [];
    runtime.accounts.onChange((articles) => seen.push(articles.size));
    await runtime.accounts.service.request('alice', { force: true });
    await settle();
    expect(seen).toEqual([]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('asks again for what is on screen after the cache is cleared', async () => {
    const { runtime, calls } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    runtime.accounts.track({}, a, ['alice'], { auto: true });
    await until(() => calls.length === 1);
    await runtime.accounts.service.clear();
    await until(() => calls.length === 2);
    expect(calls).toEqual(['alice', 'alice']);
  });

  it('stops everything with its scope', async () => {
    const { runtime, scope, calls } = setup();
    const a = addPost({ id: '1', handle: 'alice' });
    scope.dispose();
    runtime.accounts.track({}, a, ['alice'], { auto: true });
    await settle();
    expect(calls).toEqual([]);
  });
});
