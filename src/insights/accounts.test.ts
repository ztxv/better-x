// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../runtime/scope';
import type { AccountInfo } from '../x/about-account';
import type { AboutTransport, LookupResponse } from '../x/about-transport';
import { createAccountService, failDelay, TTL, ALL_HANDLES } from './accounts';
import {
  ACCOUNTS_VERSION,
  revive,
  type AccountStore,
  type PersistedAccounts,
  type StoreEvent,
} from './accounts-store';
import { resolvePlace } from './places';

const T0 = 1_800_000_000_000;
let scope: Scope;

const info = (handle: string, extra: Partial<AccountInfo> = {}): AccountInfo => ({
  handle,
  basedIn: resolvePlace('Germany')!,
  ...extra,
});
const okResponse = (i: AccountInfo): LookupResponse => ({
  outcome: { kind: 'ok', info: i },
  rate: {},
});

function memoryStore(initial?: PersistedAccounts) {
  let data = initial;
  let cooldown = 0;
  const listeners = new Set<(event: StoreEvent) => void>();
  const store: AccountStore = {
    load: async () => data,
    save: async (next) => {
      data = JSON.parse(JSON.stringify(next));
    },
    clear: async () => {
      data = undefined;
    },
    loadCooldown: async () => cooldown,
    saveCooldown: async (until) => {
      cooldown = until;
    },
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    saved: () => data,
    cooldown: () => cooldown,
    emit: (event: StoreEvent) => listeners.forEach((l) => l(event)),
  };
}

/** A transport answering from a script; each lookup is recorded and can be held open. */
function scripted(
  answer: (handle: string, call: number) => LookupResponse | Promise<LookupResponse>,
) {
  const calls: string[] = [];
  const transport: AboutTransport = {
    lookup: async (handle) => {
      calls.push(handle);
      return answer(handle, calls.length);
    },
  };
  return { transport, calls };
}

function build(
  transport: AboutTransport,
  options: { store?: ReturnType<typeof memoryStore>; spacing?: number; concurrency?: number } = {},
) {
  const memory = options.store ?? memoryStore();
  const service = createAccountService({
    transport,
    store: memory.store,
    scope,
    now: () => Date.now(),
    config: { spacingMs: options.spacing ?? 0, concurrency: options.concurrency ?? 2 },
  });
  return { service, memory };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  scope = new Scope();
});
afterEach(() => {
  scope.dispose();
  vi.useRealTimers();
});

describe('cache and deduplication', () => {
  it('answers a repeat from memory and asks X once', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport);
    const first = await service.request('Alice');
    expect(first?.state).toBe('ok');
    await service.request('alice');
    await service.request('ALICE');
    expect(calls).toEqual(['alice']);
    expect(service.info('alice')?.basedIn?.name).toBe('Germany');
    expect(service.isFresh('alice')).toBe(true);
  });

  it('shares one lookup between everyone asking at the same time', async () => {
    let release: (r: LookupResponse) => void = () => {};
    const { transport, calls } = scripted(() => new Promise<LookupResponse>((r) => (release = r)));
    const { service } = build(transport);
    const a = service.request('bob');
    const b = service.request('bob', { priority: 'hover' });
    const c = service.request('bob', { priority: 'manual' });
    await vi.advanceTimersByTimeAsync(10);
    release(okResponse(info('bob')));
    const results = await Promise.all([a, b, c]);
    expect(calls).toEqual(['bob']);
    expect(results.every((r) => r?.state === 'ok')).toBe(true);
  });

  it('shares a lookup that is already running with a later asker', async () => {
    let release: (r: LookupResponse) => void = () => {};
    const { transport, calls } = scripted(() => new Promise<LookupResponse>((r) => (release = r)));
    const { service } = build(transport);
    const first = service.request('carol');
    await vi.advanceTimersByTimeAsync(10);
    const second = service.request('carol');
    release(okResponse(info('carol')));
    await Promise.all([first, second]);
    expect(calls).toEqual(['carol']);
  });

  it('refuses a handle X could not have', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport);
    for (const bad of ['', 'has space', 'x'.repeat(20), 'a/b', '../etc'])
      expect(await service.request(bad)).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('asks again only after the answer is old, and still shows the old one meanwhile', async () => {
    const { transport, calls } = scripted((h, n) =>
      okResponse(info(h, { basedIn: resolvePlace(n === 1 ? 'Germany' : 'Japan')! })),
    );
    const { service } = build(transport);
    await service.request('dave');
    vi.setSystemTime(Date.now() + (TTL.ok + 1));
    expect(service.isFresh('dave')).toBe(false);
    expect(service.info('dave')?.basedIn?.name).toBe('Germany');
    await service.request('dave');
    expect(calls).toHaveLength(2);
    expect(service.info('dave')?.basedIn?.name).toBe('Japan');
  });

  it('refreshes one account on demand, even when fresh', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport);
    await service.request('erin');
    await service.request('erin', { force: true, priority: 'manual' });
    expect(calls).toEqual(['erin', 'erin']);
  });

  it('keeps one entry per account id when a handle changes', async () => {
    const { transport } = scripted((h) => okResponse(info(h, { id: '77' })));
    const { service } = build(transport);
    await service.request('old_name');
    await service.request('new_name');
    expect(service.peek('old_name')).toBeUndefined();
    expect(service.info('new_name')?.id).toBe('77');
  });
});

describe('queue, priority and concurrency', () => {
  it('runs a bounded number at once and spaces their starts', async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let peak = 0;
    const transport: AboutTransport = {
      lookup: (handle) =>
        new Promise((resolve) => {
          active++;
          peak = Math.max(peak, active);
          releases.push(() => {
            active--;
            resolve(okResponse(info(handle)));
          });
        }),
    };
    const { service } = build(transport, { concurrency: 2, spacing: 100 });
    const all = ['a', 'b', 'c', 'd'].map((h) => service.request(h));
    await vi.advanceTimersByTimeAsync(0);
    expect(active).toBe(1); // spaced: the second waits 100 ms
    await vi.advanceTimersByTimeAsync(110);
    expect(active).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(active).toBe(2); // the third waits for a free slot
    releases.splice(0).forEach((r) => r());
    await vi.advanceTimersByTimeAsync(300);
    releases.splice(0).forEach((r) => r());
    await Promise.all(all);
    expect(peak).toBe(2);
  });

  it('serves a person’s click before a pointer rest before a visible post', async () => {
    const order: string[] = [];
    const { transport } = scripted((h) => {
      order.push(h);
      return okResponse(info(h));
    });
    const { service } = build(transport, { concurrency: 1, spacing: 50 });
    const blocker = service.request('first');
    const a = service.request('vis', { priority: 'visible' });
    const b = service.request('hov', { priority: 'hover' });
    const c = service.request('man', { priority: 'manual' });
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([blocker, a, b, c]);
    expect(order).toEqual(['first', 'man', 'hov', 'vis']);
  });

  it('serves the newest visible post first', async () => {
    const order: string[] = [];
    const { transport } = scripted((h) => {
      order.push(h);
      return okResponse(info(h));
    });
    const { service } = build(transport, { concurrency: 1, spacing: 50 });
    const all = ['one', 'two', 'three', 'four'].map((h) => service.request(h));
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(all);
    expect(order).toEqual(['one', 'four', 'three', 'two']);
  });

  it('drops a queued lookup for a post that scrolled away, costing nothing', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport, { concurrency: 1, spacing: 50 });
    let onScreen = true;
    const keep = service.request('keep', { wanted: () => true });
    const gone = service.request('gone', { wanted: () => onScreen });
    onScreen = false;
    await vi.advanceTimersByTimeAsync(500);
    expect(await keep).toBeDefined();
    expect(await gone).toBeUndefined();
    expect(calls).toEqual(['keep']);
  });
});

describe('failures and rate limits', () => {
  it('remembers a failure briefly and does not retry before it is due', async () => {
    const { transport, calls } = scripted(() => ({ outcome: { kind: 'error' }, rate: {} }));
    const { service } = build(transport);
    const first = await service.request('flaky');
    expect(first).toMatchObject({ state: 'failed', reason: 'error', tries: 1 });
    await service.request('flaky');
    expect(calls).toHaveLength(1);
    vi.setSystemTime(Date.now() + (failDelay(1) + 1));
    await service.request('flaky');
    expect(calls).toHaveLength(2);
    expect(service.peek('flaky')).toMatchObject({ state: 'failed', tries: 2 });
  });

  it('backs off exponentially up to a cap', () => {
    expect(failDelay(1)).toBe(120_000);
    expect(failDelay(2)).toBe(360_000);
    expect(failDelay(3)).toBe(1_080_000);
    expect(failDelay(10)).toBe(6 * 60 * 60_000);
  });

  it('keeps showing an older good answer when a refresh fails', async () => {
    let n = 0;
    const { transport } = scripted((h) =>
      ++n === 1 ? okResponse(info(h)) : { outcome: { kind: 'error' }, rate: {} },
    );
    const { service } = build(transport);
    await service.request('steady');
    vi.setSystemTime(Date.now() + (TTL.ok + 1));
    await service.request('steady');
    expect(service.info('steady')?.basedIn?.name).toBe('Germany');
    expect(service.peek('steady')?.state).toBe('ok');
  });

  it('remembers an unavailable account for a day', async () => {
    const { transport, calls } = scripted(() => ({ outcome: { kind: 'notFound' }, rate: {} }));
    const { service } = build(transport);
    expect((await service.request('gone'))?.state).toBe('missing');
    await service.request('gone');
    expect(calls).toHaveLength(1);
    vi.setSystemTime(Date.now() + (TTL.missing + 1));
    await service.request('gone');
    expect(calls).toHaveLength(2);
  });

  it('waits out a 429 for as long as X says, for every account, and tells other tabs', async () => {
    let limited = true;
    const { transport, calls } = scripted((h) =>
      limited
        ? { outcome: { kind: 'rateLimited', until: T0 + 60_000 }, rate: {} }
        : okResponse(info(h)),
    );
    const { service, memory } = build(transport, { concurrency: 1 });
    const first = service.request('a');
    const second = service.request('b');
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(1); // the 429 stopped the queue
    expect(memory.cooldown()).toBe(T0 + 60_000);
    expect(service.stats().pausedUntil).toBe(T0 + 60_000);
    limited = false;
    vi.setSystemTime(Date.now() + 61_000);
    await vi.advanceTimersByTimeAsync(61_000);
    // The rate-limited account is not cached as failed; the queued one goes once the pause ends.
    expect((await second)?.state).toBe('ok');
    expect(await first).toBeUndefined();
    expect(service.peek('a')).toBeUndefined();
  });

  it('pauses on its own when X says no calls are left', async () => {
    const { transport, calls } = scripted((h) => ({
      outcome: { kind: 'ok', info: info(h) },
      rate: { remaining: 0, resetAt: Date.now() + 30_000 },
    }));
    const { service } = build(transport, { concurrency: 1 });
    await service.request('a');
    const next = service.request('b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual(['a']);
    vi.setSystemTime(Date.now() + 31_000);
    await vi.advanceTimersByTimeAsync(31_000);
    await next;
    expect(calls).toEqual(['a', 'b']);
  });

  it('stops asking for a while after X refuses the session or the query', async () => {
    for (const kind of ['unauthorized', 'unsupported'] as const) {
      scope.dispose();
      scope = new Scope();
      const { transport, calls } = scripted(() => ({ outcome: { kind }, rate: {} }));
      const { service } = build(transport, { concurrency: 1 });
      expect((await service.request('a'))?.state).toBe('failed');
      const other = service.request('b');
      await vi.advanceTimersByTimeAsync(5000);
      expect(calls, kind).toEqual(['a']);
      expect(service.stats().pausedUntil, kind).not.toBeNull();
      void other;
    }
  });

  it('follows a rate limit another tab hit', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service, memory } = build(transport, { concurrency: 1 });
    await service.request('warm');
    memory.emit({ cooldown: Date.now() + 20_000 });
    const next = service.request('cold');
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual(['warm']);
    vi.setSystemTime(Date.now() + 21_000);
    await vi.advanceTimersByTimeAsync(21_000);
    await next;
    expect(calls).toEqual(['warm', 'cold']);
  });
});

describe('persistence and clearing', () => {
  it('starts warm from the stored cache and drops what is too old or malformed', async () => {
    const good = { state: 'ok', info: info('cached'), at: T0 - 1000 };
    const stored = revive({
      v: ACCOUNTS_VERSION,
      entries: {
        cached: good,
        ancient: { state: 'ok', info: info('ancient'), at: T0 - TTL.drop - 1 },
        'bad handle': good,
        wrong: { state: 'ok', info: info('someoneelse'), at: T0 },
        junk: { state: 'ok' },
      },
    })!;
    expect(Object.keys(stored.entries).sort()).toEqual(['ancient', 'cached']);
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport, { store: memoryStore(stored) });
    expect((await service.request('cached'))?.state).toBe('ok');
    expect(calls).toEqual([]);
    await service.request('ancient');
    expect(calls).toEqual(['ancient']);
  });

  it('saves after answers, once, not on every one', async () => {
    const { transport } = scripted((h) => okResponse(info(h)));
    const memory = memoryStore();
    const saves = vi.spyOn(memory.store, 'save');
    const { service } = build(transport, { store: memory });
    await Promise.all(['a', 'b', 'c'].map((h) => service.request(h)));
    expect(saves).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3100);
    expect(saves).toHaveBeenCalledTimes(1);
    expect(Object.keys(memory.saved()!.entries).sort()).toEqual(['a', 'b', 'c']);
    await service.flush();
    expect(saves).toHaveBeenCalledTimes(1);
  });

  it('persists no credentials: only handles, state, times and public account facts', async () => {
    const { transport } = scripted((h) => okResponse(info(h, { id: '5' })));
    const memory = memoryStore();
    const { service } = build(transport, { store: memory });
    await service.request('safe');
    await service.flush();
    const text = JSON.stringify(memory.saved());
    expect(text).not.toMatch(/ct0|csrf|authorization|bearer|cookie|token/i);
  });

  it('empties the cache and tells listeners everything changed', async () => {
    const { transport } = scripted((h) => okResponse(info(h)));
    const { service, memory } = build(transport);
    const seen: ReadonlySet<string>[] = [];
    service.subscribe((changed) => seen.push(changed));
    await service.request('x');
    await service.flush();
    expect(memory.saved()).toBeDefined();
    await service.clear();
    expect(service.peek('x')).toBeUndefined();
    expect(memory.saved()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(50);
    expect(seen.some((s) => s.has(ALL_HANDLES))).toBe(true);
  });

  it('follows another tab: newer answers merge in, a clear empties', async () => {
    const { transport } = scripted((h) => okResponse(info(h)));
    const { service, memory } = build(transport);
    await service.request('mine');
    memory.emit({
      accounts: revive({
        v: ACCOUNTS_VERSION,
        entries: {
          theirs: {
            state: 'ok',
            info: info('theirs', { basedIn: resolvePlace('Japan')! }),
            at: Date.now(),
          },
          mine: { state: 'ok', info: info('mine'), at: Date.now() - 99999 },
        },
      })!,
    });
    expect(service.info('theirs')?.basedIn?.name).toBe('Japan');
    expect(service.peek('mine')!.at).toBe(Date.now()); // the newer local answer stays
    memory.emit({ accounts: null });
    expect(service.peek('theirs')).toBeUndefined();
    expect(service.peek('mine')).toBeUndefined();
  });

  it('coalesces change notifications to one per frame', async () => {
    const { transport } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport);
    const calls: string[][] = [];
    service.subscribe((changed) => calls.push([...changed].sort()));
    await Promise.all(['b', 'a'].map((h) => service.request(h)));
    await vi.advanceTimersByTimeAsync(50);
    expect(calls).toEqual([['a', 'b']]);
  });

  it('stops everything when its scope ends', async () => {
    const { transport, calls } = scripted((h) => okResponse(info(h)));
    const { service } = build(transport, { concurrency: 1, spacing: 100 });
    const a = service.request('a');
    const b = service.request('b');
    scope.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await b).toBeUndefined();
    expect(calls.length).toBeLessThanOrEqual(1);
    void a;
  });
});
