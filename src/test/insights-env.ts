import type { AccountStore, PersistedAccounts, StoreEvent } from '../insights/accounts-store';
import { resolvePlace } from '../insights/places';
import { startRuntime, type Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import type { AccountInfo } from '../x/about-account';
import type { AboutTransport, LookupResponse } from '../x/about-transport';

export function memoryStore(initial?: PersistedAccounts) {
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
    emit: (event: StoreEvent) => listeners.forEach((listener) => listener(event)),
  };
}

export const info = (handle: string, country: string | null, extra: Partial<AccountInfo> = {}) =>
  ({ handle, ...(country ? { basedIn: resolvePlace(country)! } : {}), ...extra }) as AccountInfo;

/** A transport answering from a table of handle → info (unknown handles are "unavailable"). */
export function tableTransport(table: Record<string, AccountInfo>) {
  const calls: string[] = [];
  const transport: AboutTransport = {
    lookup: async (handle) => {
      calls.push(handle);
      const found = table[handle];
      const response: LookupResponse = found
        ? { outcome: { kind: 'ok', info: found }, rate: {} }
        : { outcome: { kind: 'notFound' }, rate: {} };
      return response;
    },
  };
  return { transport, calls };
}

/** A runtime on a fresh scope whose account lookups go to `transport`. */
export function testRuntime(transport: AboutTransport, store = memoryStore()) {
  const scope = new Scope();
  const runtime: Runtime = startRuntime(scope, {
    accounts: {
      transport,
      store: store.store,
      config: { spacingMs: 0, concurrency: 4 },
      intersection: null,
    },
  });
  return { scope, runtime, store };
}

/** Lets mutation observers, frames and promise chains run (real timers). */
export const settle = (ms = 90) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits (real timers) until `check` holds, up to `ms`; a slow machine only makes it wait longer. */
export async function until(check: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await settle(20);
}
