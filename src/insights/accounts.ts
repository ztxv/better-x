import type { Scope, Disposer } from '../runtime/scope';
import type { AccountInfo } from '../x/about-account';
import type { AboutTransport, LookupOutcome, LookupResponse } from '../x/about-transport';
import {
  MAX_ENTRIES,
  ACCOUNTS_VERSION,
  type AccountStore,
  type Entry,
  type FailReason,
  type PersistedAccounts,
} from './accounts-store';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long an answer is trusted before it is asked for again (when someone looks at it again). */
export const TTL = {
  ok: 14 * DAY,
  /** An account X says is unavailable. Short, because accounts come back. */
  missing: DAY,
  /** Entries older than this are dropped when the cache loads. */
  drop: 60 * DAY,
};

/** Retry delays for a failed lookup of one account: 2 min, then x3 each time, never beyond 6 h. */
export const BACKOFF = { first: 2 * MINUTE, factor: 3, max: 6 * HOUR };
/** After X refuses our session, nothing is asked for this long. */
const UNAUTHORIZED_PAUSE = 10 * MINUTE;
/** After the query itself stops working, nothing is asked for this long. */
const UNSUPPORTED_PAUSE = HOUR;
/** After this many failures in a row (any account), nothing is asked for a short while. */
const STREAK_LIMIT = 5;
const STREAK_PAUSE = 2 * MINUTE;
/** When this many lookups are queued, those no longer wanted are dropped before adding more. */
const PRUNE_AT = 60;
/** What a subscriber is told when everything may have changed (the cache was cleared). */
export const ALL_HANDLES = '*';
/** The cache is written at most this often, however many answers arrive. */
const SAVE_DELAY = 3000;

/**
 * Who asked. A person's own click always goes first, then a pointer resting on a name, then
 * posts that are on screen. Lookups never start for posts that are not on screen.
 */
export type Priority = 'manual' | 'hover' | 'visible';
const RANK: Record<Priority, number> = { manual: 0, hover: 1, visible: 2 };

export interface RequestOptions {
  priority?: Priority;
  /** Ask even when a fresh answer is cached (a manual refresh). */
  force?: boolean;
  /**
   * Checked just before the request would start; when it says no the lookup is dropped. Posts
   * that scrolled away while queued therefore cost nothing.
   */
  wanted?: () => boolean;
}

export interface AccountsConfig {
  /** Lookups in flight at once. */
  concurrency: number;
  /** The least time between two lookups starting. */
  spacingMs: number;
}

export const DEFAULT_CONFIG: AccountsConfig = { concurrency: 2, spacingMs: 500 };

export interface AccountService {
  /** What is cached for a handle right now, fresh or not. Never starts a request. */
  peek(handle: string): Entry | undefined;
  /** The cached account info (only for a successful answer). */
  info(handle: string): AccountInfo | undefined;
  /** True when a cached answer exists and is still trusted. */
  isFresh(handle: string): boolean;
  /**
   * Ensures an answer, asking X only when needed: a fresh cached answer is returned as is, a
   * lookup already running for the same account is shared, and a failure that is still backing
   * off is not retried. Resolves with the entry, or `undefined` when the lookup was dropped.
   */
  request(handle: string, options?: RequestOptions): Promise<Entry | undefined>;
  /**
   * Calls `listener` (at most once per frame) with the handles whose entries changed, or with
   * `ALL_HANDLES` when everything may have (the cache was cleared).
   */
  subscribe(listener: (changed: ReadonlySet<string>) => void): Disposer;
  /** Empties the cache everywhere. */
  clear(): Promise<void>;
  stats(): { cached: number; queued: number; active: number; pausedUntil: number | null };
  /** Writes pending changes now. */
  flush(): Promise<void>;
}

interface Waiting {
  handle: string;
  rank: number;
  seq: number;
  force: boolean;
  /** True when someone needs the answer regardless of what is on screen. */
  always: boolean;
  wanted: Array<() => boolean>;
  resolvers: Array<(entry: Entry | undefined) => void>;
}

export interface AccountsDeps {
  transport: AboutTransport;
  store: AccountStore;
  scope: Scope;
  now?: () => number;
  config?: Partial<AccountsConfig>;
}

export function failDelay(tries: number): number {
  return Math.min(BACKOFF.max, BACKOFF.first * BACKOFF.factor ** Math.max(0, tries - 1));
}

/**
 * The account cache and request manager. One per page. It answers from memory, shares one lookup
 * between everyone asking about the same account, keeps lookups few and spaced, waits out X's own
 * rate-limit answers, remembers failures for a shorter time than successes, and persists the
 * cache so other tabs and later visits start warm.
 *
 * Accounts are keyed by handle (the only thing a post shows), and one entry is kept per X account
 * id: when a lookup shows a known id under a new handle, the old handle's entry is dropped.
 */
export function createAccountService(deps: AccountsDeps): AccountService {
  const { transport, store, scope } = deps;
  const now = deps.now ?? Date.now;
  const config = { ...DEFAULT_CONFIG, ...deps.config };
  const cache = new Map<string, Entry>();
  const idToHandle = new Map<string, string>();
  const listeners = new Set<(changed: ReadonlySet<string>) => void>();
  const changed = new Set<string>();
  const waiting = new Map<string, Waiting>();
  /** When a stale-but-shown answer may be asked for again after a failed refresh. */
  const failedRetry = new Map<string, number>();
  const running = new Map<string, Promise<Entry | undefined>>();
  let seq = 0;
  let active = 0;
  let nextStart = 0;
  let pausedUntil = 0;
  let streak = 0;
  let timer: Disposer | undefined;
  let saveTimer: Disposer | undefined;
  let dirty = false;
  let frame: Disposer | undefined;

  const ready = (async () => {
    const [saved, cooldown] = await Promise.all([store.load(), store.loadCooldown()]);
    if (saved) merge(saved, false);
    pausedUntil = Math.max(pausedUntil, cooldown);
    pump();
  })();

  /** Merges another copy of the cache in, keeping the newer entry for each handle. */
  function merge(data: PersistedAccounts, notify: boolean) {
    for (const [handle, entry] of Object.entries(data.entries)) {
      if (now() - entry.at > TTL.drop) continue;
      const mine = cache.get(handle);
      if (mine && mine.at >= entry.at) continue;
      set(handle, entry, notify, false);
    }
  }

  function set(handle: string, entry: Entry, notify: boolean, persist: boolean) {
    const old = cache.get(handle);
    if (old?.state === 'ok' && old.info.id) {
      if (
        idToHandle.get(old.info.id) === handle &&
        entry.state === 'ok' &&
        entry.info.id !== old.info.id
      )
        idToHandle.delete(old.info.id);
    }
    if (entry.state === 'ok' && entry.info.id) {
      const other = idToHandle.get(entry.info.id);
      if (other && other !== handle) {
        // The same account under a new handle: keep the newer name only.
        cache.delete(other);
        if (notify) changed.add(other);
      }
      idToHandle.set(entry.info.id, handle);
    }
    cache.set(handle, entry);
    if (notify) {
      changed.add(handle);
      schedule();
    }
    if (persist) {
      dirty = true;
      scheduleSave();
    }
  }

  function schedule() {
    if (frame || listeners.size === 0) return;
    frame = scope.requestFrame(() => {
      frame = undefined;
      const handles = new Set(changed);
      changed.clear();
      for (const listener of [...listeners]) {
        try {
          listener(handles);
        } catch (error) {
          console.error('[Better X] account listener failed', error);
        }
      }
    });
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = scope.setTimeout(() => {
      saveTimer = undefined;
      void flush();
    }, SAVE_DELAY);
  }

  async function flush() {
    if (!dirty) return;
    dirty = false;
    saveTimer?.();
    saveTimer = undefined;
    const entries = [...cache.entries()];
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].at - a[1].at);
      for (const [handle] of entries.splice(MAX_ENTRIES)) {
        const entry = cache.get(handle);
        if (entry?.state === 'ok' && entry.info.id) idToHandle.delete(entry.info.id);
        cache.delete(handle);
      }
    }
    try {
      await store.save({ v: ACCOUNTS_VERSION, entries: Object.fromEntries(entries) });
    } catch (error) {
      dirty = true;
      console.error('[Better X] could not save the account cache', error);
    }
  }

  const trusted = (entry: Entry | undefined): boolean => {
    if (!entry) return false;
    const age = now() - entry.at;
    if (entry.state === 'ok') return age < TTL.ok;
    if (entry.state === 'missing') return age < TTL.missing;
    return now() < entry.retryAt;
  };

  function pause(until: number, persist = false) {
    if (until <= pausedUntil) return;
    pausedUntil = until;
    if (persist) void store.saveCooldown(until).catch(() => {});
  }

  function record(handle: string, response: LookupResponse): Entry | undefined {
    const { outcome, rate } = response;
    const at = now();
    if (rate.remaining !== undefined && rate.remaining <= 1 && rate.resetAt)
      pause(rate.resetAt, false);
    switch (outcome.kind) {
      case 'ok': {
        streak = 0;
        const entry: Entry = { state: 'ok', info: outcome.info, at };
        set(handle, entry, true, true);
        return entry;
      }
      case 'notFound': {
        streak = 0;
        const entry: Entry = { state: 'missing', at };
        set(handle, entry, true, true);
        return entry;
      }
      case 'rateLimited':
        // Not this account's fault: remember nothing about it, and wait as long as X says.
        pause(outcome.until, true);
        return undefined;
      default:
        return fail(handle, outcome, at);
    }
  }

  function fail(handle: string, outcome: LookupOutcome, at: number): Entry {
    const reason: FailReason =
      outcome.kind === 'unauthorized' || outcome.kind === 'unsupported' ? outcome.kind : 'error';
    const previous = cache.get(handle);
    const tries = (previous?.state === 'failed' ? previous.tries : 0) + 1;
    let retryAt = at + failDelay(tries);
    if (reason === 'unauthorized') {
      pause(at + UNAUTHORIZED_PAUSE);
      retryAt = at + UNAUTHORIZED_PAUSE;
    } else if (reason === 'unsupported') {
      pause(at + UNSUPPORTED_PAUSE);
      retryAt = at + UNSUPPORTED_PAUSE;
    } else if (++streak >= STREAK_LIMIT) {
      streak = 0;
      pause(at + STREAK_PAUSE);
    }
    const entry: Entry = { state: 'failed', at, retryAt, tries, reason };
    // A failure must not overwrite an older successful answer: keep showing that one.
    if (previous?.state === 'ok') {
      failedRetry.set(handle, retryAt);
      return previous;
    }
    set(handle, entry, true, true);
    return entry;
  }

  /** Drops queued lookups nobody on screen wants any more. */
  function prune() {
    for (const [handle, item] of waiting)
      if (!item.always && !item.wanted.some((wanted) => wanted())) {
        waiting.delete(handle);
        for (const resolve of item.resolvers) resolve(undefined);
      }
  }

  function pick(): Waiting | undefined {
    let best: Waiting | undefined;
    for (const item of waiting.values()) {
      if (
        !best ||
        item.rank < best.rank ||
        // Within a rank the newest first: it is what is on screen now.
        (item.rank === best.rank && item.seq > best.seq)
      )
        best = item;
    }
    return best;
  }

  function pump() {
    timer?.();
    timer = undefined;
    if (scope.disposed) return;
    while (active < config.concurrency && waiting.size) {
      const t = now();
      const wait = Math.max(pausedUntil - t, nextStart - t);
      if (wait > 0) {
        timer = scope.setTimeout(pump, wait + 5);
        return;
      }
      const item = pick();
      if (!item) return;
      waiting.delete(item.handle);
      if (!item.always && !item.wanted.some((wanted) => wanted())) {
        for (const resolve of item.resolvers) resolve(undefined);
        continue;
      }
      const have = cache.get(item.handle);
      if (!item.force && trusted(have)) {
        for (const resolve of item.resolvers) resolve(have);
        continue;
      }
      start(item);
    }
  }

  function start(item: Waiting) {
    active++;
    nextStart = now() + config.spacingMs;
    const abort = new AbortController();
    const stop = scope.add(() => abort.abort());
    const run = transport
      .lookup(item.handle, abort.signal)
      .then((response) => record(item.handle, response))
      .catch(() => fail(item.handle, { kind: 'error' }, now()))
      .finally(() => {
        stop();
        active--;
        running.delete(item.handle);
        pump();
      });
    running.set(item.handle, run);
    void run.then((entry) => {
      for (const resolve of item.resolvers) resolve(entry);
    });
  }

  // Another tab changed the cache or hit a rate limit: follow it.
  scope.add(
    store.watch((event) => {
      if (event.accounts === null) {
        cache.clear();
        idToHandle.clear();
        failedRetry.clear();
        dirty = false;
        for (const handle of [...changed]) changed.delete(handle);
        notifyAll();
      } else if (event.accounts) merge(event.accounts, true);
      if (event.cooldown) pause(event.cooldown);
    }),
  );
  function notifyAll() {
    // Everything may have changed; listeners re-read what they show.
    changed.add(ALL_HANDLES);
    schedule();
  }
  scope.add(() => {
    listeners.clear();
    for (const item of waiting.values()) for (const resolve of item.resolvers) resolve(undefined);
    waiting.clear();
    if (dirty) void store.save({ v: ACCOUNTS_VERSION, entries: Object.fromEntries(cache) });
  });

  return {
    peek: (handle) => cache.get(handle.toLowerCase()),
    info(handle) {
      const entry = cache.get(handle.toLowerCase());
      return entry?.state === 'ok' ? entry.info : undefined;
    },
    isFresh: (handle) => {
      const entry = cache.get(handle.toLowerCase());
      if (!entry) return false;
      if (entry.state === 'ok') {
        const retry = failedRetry.get(handle.toLowerCase());
        return trusted(entry) || (retry !== undefined && now() < retry);
      }
      return trusted(entry);
    },

    async request(rawHandle, options = {}) {
      const handle = rawHandle.toLowerCase();
      if (!/^[a-z0-9_]{1,15}$/.test(handle)) return undefined;
      await ready;
      if (scope.disposed) return undefined;
      const have = cache.get(handle);
      if (!options.force) {
        const retry = failedRetry.get(handle);
        if (trusted(have) || (have?.state === 'ok' && retry !== undefined && now() < retry))
          return have;
      }
      const inflight = running.get(handle);
      if (inflight) return inflight;
      if (waiting.size > PRUNE_AT) prune();

      return new Promise<Entry | undefined>((resolve) => {
        const rank = RANK[options.priority ?? 'visible'];
        const queued = waiting.get(handle);
        if (queued) {
          queued.rank = Math.min(queued.rank, rank);
          queued.seq = ++seq;
          queued.force ||= Boolean(options.force);
          if (options.wanted) queued.wanted.push(options.wanted);
          else queued.always = true;
          queued.resolvers.push(resolve);
        } else {
          waiting.set(handle, {
            handle,
            rank,
            seq: ++seq,
            force: Boolean(options.force),
            always: !options.wanted,
            wanted: options.wanted ? [options.wanted] : [],
            resolvers: [resolve],
          });
        }
        failedRetry.delete(handle);
        pump();
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async clear() {
      cache.clear();
      idToHandle.clear();
      failedRetry.clear();
      dirty = false;
      streak = 0;
      notifyAll();
      await store.clear();
    },

    stats: () => ({
      cached: cache.size,
      queued: waiting.size,
      active,
      pausedUntil: pausedUntil > now() ? pausedUntil : null,
    }),
    flush,
  };
}
