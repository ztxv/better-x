import { IDBFactory } from 'fake-indexeddb';
import { resetConnection } from '../storage/db';

/** A fresh, empty IndexedDB and a minimal `chrome.storage` for each test. */
export async function freshEnvironment() {
  await resetConnection();
  globalThis.indexedDB = new IDBFactory();
  const data: Record<string, unknown> = {};
  const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
  globalThis.chrome = {
    storage: {
      local: {
        // One key or several, as Chrome accepts.
        get: async (keys: string | string[]) =>
          Object.fromEntries(
            [keys]
              .flat()
              .filter((key) => key in data)
              .map((key) => [key, data[key]]),
          ),
        set: async (values: Record<string, unknown>) => {
          const changes: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: data[key], newValue: value };
            data[key] = value;
          }
          listeners.forEach((listener) => listener(changes, 'local'));
        },
      },
      onChanged: {
        addListener: (listener: never) => listeners.add(listener),
        removeListener: (listener: never) => listeners.delete(listener),
      },
    },
  } as unknown as typeof chrome;
  return { data };
}

/** A `fetch` stand-in answering from a table of URL → response. Unknown URLs reject. */
export function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });
    const route = routes[url];
    if (!route) throw new TypeError('Failed to fetch');
    return route();
  }) as typeof fetch;
  return { fetcher, calls };
}

export const ok = (type: string) => () =>
  new Response(null, { status: 200, headers: { 'content-type': type } });
export const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
