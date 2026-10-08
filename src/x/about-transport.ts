/*
 * The AboutAccountQuery id and the way the request is made follow X-Posed (MIT, Alexander Hagenah)
 * and X Profile Location (MIT, Copyright (c) 2026 Aleksandr Smyshliaev); the rate-limit header
 * reading follows X-Posed's `readRateLimitReset`. See THIRD_PARTY_NOTICES.md.
 */
import { parseAboutAccount, type AccountInfo } from './about-account';

/**
 * The one place that knows how to ask X about an account. Everything else in Better X deals in
 * `AccountInfo` and `LookupOutcome`; no GraphQL detail leaks past this file.
 *
 * The request is the one X's own page makes: same-origin, with the signed-in session's cookies and
 * the `ct0` token read from that cookie for this single request. Better X never stores the cookie,
 * the token or any header, and sends nothing anywhere but x.com.
 */
export const ABOUT_QUERY_ID = 'XRqGa7EeokUU5kppkh13EA';
/**
 * The application token X's own web client sends with every request. It identifies the web app,
 * not a person, and is the same for every visitor; X publishes it in its page scripts. It is not a
 * secret and not a credential of the user.
 */
const WEB_APP_TOKEN =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const TIMEOUT_MS = 8000;

/** What X said about its own rate limit, when the response carried it. */
export interface RateInfo {
  /** Requests X says are left in the window. */
  remaining?: number;
  /** When X says the window resets or the cooldown ends, epoch ms. */
  resetAt?: number;
}

export type LookupOutcome =
  | { kind: 'ok'; info: AccountInfo }
  | { kind: 'notFound' }
  /** X refused for now (HTTP 429); `until` is when to try again. */
  | { kind: 'rateLimited'; until: number }
  /** Signed out, or X rejected the request (HTTP 401/403, or no session token). */
  | { kind: 'unauthorized' }
  /** The query itself is gone or changed (HTTP 400/404 on the endpoint, or an unreadable body). */
  | { kind: 'unsupported' }
  | { kind: 'error'; status?: number };

export interface LookupResponse {
  outcome: LookupOutcome;
  rate: RateInfo;
}

export interface AboutTransport {
  lookup(handle: string, signal?: AbortSignal): Promise<LookupResponse>;
}

export interface TransportDeps {
  fetch?: typeof fetch;
  /** The page's cookie string; read once per request, never kept. */
  cookie?: () => string;
  now?: () => number;
}

function csrfToken(cookie: string): string | undefined {
  const match = /(?:^|;\s*)ct0=([^;]+)/.exec(cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** Reads X's rate-limit headers. Missing or malformed ones are simply not reported. */
export function readRate(headers: Headers, now: number): RateInfo {
  const rate: RateInfo = {};
  const remaining = Number(headers.get('x-rate-limit-remaining'));
  if (headers.get('x-rate-limit-remaining') !== null && Number.isInteger(remaining))
    rate.remaining = remaining;
  const reset = Number(headers.get('x-rate-limit-reset')) * 1000;
  if (Number.isFinite(reset) && reset > now) rate.resetAt = reset;
  const retry = headers.get('retry-after');
  if (retry !== null && retry.trim() !== '') {
    const seconds = Number(retry);
    const at = Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000 : Date.parse(retry);
    if (Number.isFinite(at) && at > now) rate.resetAt = Math.max(rate.resetAt ?? 0, at);
  }
  return rate;
}

export function createAboutTransport(deps: TransportDeps = {}): AboutTransport {
  const doFetch = deps.fetch ?? ((...args) => fetch(...args));
  const readCookie = deps.cookie ?? (() => document.cookie);
  const now = deps.now ?? Date.now;

  return {
    async lookup(handle, signal) {
      const token = csrfToken(readCookie());
      if (!token) return { outcome: { kind: 'unauthorized' }, rate: {} };
      const variables = encodeURIComponent(JSON.stringify({ screenName: handle }));
      const url = `/i/api/graphql/${ABOUT_QUERY_ID}/AboutAccountQuery?variables=${variables}`;

      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
      const abort = () => timeout.abort();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const response = await doFetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          signal: timeout.signal,
          headers: {
            authorization: WEB_APP_TOKEN,
            'x-csrf-token': token,
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
            'x-twitter-client-language': 'en',
            // Country names are compared in English.
            'accept-language': 'en-US,en;q=0.9',
          },
        });
        const rate = readRate(response.headers, now());
        if (response.status === 429)
          return {
            outcome: { kind: 'rateLimited', until: rate.resetAt ?? now() + 60_000 },
            rate,
          };
        if (response.status === 401 || response.status === 403)
          return { outcome: { kind: 'unauthorized' }, rate };
        if (response.status === 400 || response.status === 404 || response.status === 410)
          return { outcome: { kind: 'unsupported' }, rate };
        if (!response.ok) return { outcome: { kind: 'error', status: response.status }, rate };

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return { outcome: { kind: 'unsupported' }, rate };
        }
        const parsed = parseAboutAccount(body, handle);
        if (parsed.ok) return { outcome: { kind: 'ok', info: parsed.info }, rate };
        if (parsed.reason === 'unavailable') return { outcome: { kind: 'notFound' }, rate };
        // A different account in the answer, or a body of an unknown shape: neither is data.
        return { outcome: { kind: 'unsupported' }, rate };
      } catch {
        // Offline, aborted, or timed out.
        return { outcome: { kind: 'error' }, rate: {} };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}
