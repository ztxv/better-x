import { parseConnection, type AccountInfo, type Verification } from '../x/about-account';
import { resolvePlace } from './places';

/**
 * What the account cache keeps between visits: public account facts only, in `chrome.storage.local`
 * (so every open X tab shares one cache). It never holds cookies, tokens, headers, request URLs or
 * anything about the person using Better X. It is kept apart from the settings, so a settings
 * backup never carries it and clearing it never touches a setting.
 */
export const ACCOUNTS_KEY = 'bx.accounts';
export const COOLDOWN_KEY = 'bx.accounts.cooldown';
export const ACCOUNTS_VERSION = 1;
/** The most accounts kept; the oldest answers go first. At ~250 bytes each this stays under 1 MB. */
export const MAX_ENTRIES = 3000;

export type FailReason = 'error' | 'unauthorized' | 'unsupported';

export type Entry =
  /** X answered. `info` holds only what it said. */
  | { state: 'ok'; info: AccountInfo; at: number }
  /** X says the account is unavailable (suspended, deleted, or no such handle). */
  | { state: 'missing'; at: number }
  /** Asking failed; do not ask again before `retryAt`. */
  | { state: 'failed'; at: number; retryAt: number; tries: number; reason: FailReason };

export interface PersistedAccounts {
  v: typeof ACCOUNTS_VERSION;
  entries: Record<string, Entry>;
}

export interface StoreEvent {
  /** The whole cache after another tab changed it, `null` when it was cleared. */
  accounts?: PersistedAccounts | null;
  cooldown?: number;
}

export interface AccountStore {
  load(): Promise<PersistedAccounts | undefined>;
  save(data: PersistedAccounts): Promise<void>;
  clear(): Promise<void>;
  loadCooldown(): Promise<number>;
  saveCooldown(until: number): Promise<void>;
  watch(listener: (event: StoreEvent) => void): () => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const HANDLE = /^[a-z0-9_]{1,15}$/;
const str = (value: unknown, max: number) =>
  typeof value === 'string' && value && value.length <= max ? value : undefined;
const date = (value: unknown) => {
  const s = str(value, 40);
  return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
};

/** Rebuilds account info from stored JSON, keeping only well-formed fields. */
export function reviveInfo(raw: unknown, handle: string): AccountInfo | null {
  if (!isObject(raw) || raw.handle !== handle) return null;
  const info: AccountInfo = { handle };
  const id = str(raw.id, 30);
  if (id && /^\d+$/.test(id)) info.id = id;
  const displayName = str(raw.displayName, 100);
  if (displayName) info.displayName = displayName;
  const place = isObject(raw.basedIn) ? resolvePlace(raw.basedIn.name) : null;
  if (place) info.basedIn = place;
  const connection = isObject(raw.connection) ? parseConnection(raw.connection.raw) : undefined;
  if (connection) info.connection = connection;
  if (typeof raw.locationAccurate === 'boolean') info.locationAccurate = raw.locationAccurate;
  const createdAt = date(raw.createdAt);
  if (createdAt) info.createdAt = createdAt;
  if (
    typeof raw.usernameChanges === 'number' &&
    Number.isSafeInteger(raw.usernameChanges) &&
    raw.usernameChanges >= 0
  )
    info.usernameChanges = raw.usernameChanges;
  const lastChange = date(raw.lastUsernameChangeAt);
  if (lastChange) info.lastUsernameChangeAt = lastChange;
  const affiliate = isObject(raw.affiliate) ? str(raw.affiliate.name, 100) : undefined;
  if (affiliate) info.affiliate = { name: affiliate };
  if (isObject(raw.verification)) {
    const v: Verification = {};
    if (raw.verification.blue === true) v.blue = true;
    if (raw.verification.type === 'business' || raw.verification.type === 'government')
      v.type = raw.verification.type;
    const since = date(raw.verification.since);
    if (since) v.since = since;
    if (Object.keys(v).length) info.verification = v;
  }
  return info;
}

const REASONS = new Set<FailReason>(['error', 'unauthorized', 'unsupported']);

export function reviveEntry(raw: unknown, handle: string): Entry | null {
  if (!isObject(raw) || typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null;
  if (raw.state === 'ok') {
    const info = reviveInfo(raw.info, handle);
    return info ? { state: 'ok', info, at: raw.at } : null;
  }
  if (raw.state === 'missing') return { state: 'missing', at: raw.at };
  if (
    raw.state === 'failed' &&
    typeof raw.retryAt === 'number' &&
    Number.isFinite(raw.retryAt) &&
    typeof raw.tries === 'number' &&
    REASONS.has(raw.reason as FailReason)
  )
    return {
      state: 'failed',
      at: raw.at,
      retryAt: raw.retryAt,
      tries: Math.max(0, Math.min(20, Math.floor(raw.tries))),
      reason: raw.reason as FailReason,
    };
  return null;
}

/** Reads whatever was stored; anything not understood is dropped, never trusted. */
export function revive(raw: unknown): PersistedAccounts | undefined {
  if (!isObject(raw) || raw.v !== ACCOUNTS_VERSION || !isObject(raw.entries)) return undefined;
  const entries: Record<string, Entry> = {};
  for (const [handle, value] of Object.entries(raw.entries).slice(0, MAX_ENTRIES * 2)) {
    if (!HANDLE.test(handle)) continue;
    const entry = reviveEntry(value, handle);
    if (entry) entries[handle] = entry;
  }
  return { v: ACCOUNTS_VERSION, entries };
}

export function chromeAccountStore(): AccountStore {
  return {
    async load() {
      try {
        const stored = await chrome.storage.local.get(ACCOUNTS_KEY);
        return revive(stored[ACCOUNTS_KEY]);
      } catch {
        return undefined;
      }
    },
    async save(data) {
      await chrome.storage.local.set({ [ACCOUNTS_KEY]: data });
    },
    async clear() {
      // The rate-limit cooldown stays: emptying the cache must not let a limited session retry.
      await chrome.storage.local.remove(ACCOUNTS_KEY);
    },
    async loadCooldown() {
      try {
        const stored = await chrome.storage.local.get(COOLDOWN_KEY);
        const value = stored[COOLDOWN_KEY];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      } catch {
        return 0;
      }
    },
    async saveCooldown(until) {
      await chrome.storage.local.set({ [COOLDOWN_KEY]: until });
    },
    watch(listener) {
      const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area !== 'local') return;
        const event: StoreEvent = {};
        if (changes[ACCOUNTS_KEY]) event.accounts = revive(changes[ACCOUNTS_KEY].newValue) ?? null;
        const cooldown = changes[COOLDOWN_KEY];
        if (cooldown)
          event.cooldown = typeof cooldown.newValue === 'number' ? cooldown.newValue : 0;
        if ('accounts' in event || 'cooldown' in event) listener(event);
      };
      chrome.storage.onChanged.addListener(onChanged);
      return () => chrome.storage.onChanged.removeListener(onChanged);
    },
  };
}

/** How many accounts the stored cache holds; for the settings screen. */
export async function storedAccountCount(): Promise<number> {
  const data = await chromeAccountStore().load();
  return data ? Object.keys(data.entries).length : 0;
}

/** Empties the cache everywhere: every open tab hears the removal and forgets too. */
export function clearStoredAccounts(): Promise<void> {
  return chromeAccountStore().clear();
}
