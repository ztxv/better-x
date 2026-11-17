import { loadPluginState } from '../plugins/state';
import {
  apiError,
  commandRequest,
  describeFailure,
  parsePlayback,
  PLAYER_URL,
  PREMIUM_NOTE,
} from './api';
import { freshAuth, loadAuth, saveAuth } from './auth';
import type { PlayerState, SpotifyAuth, SpotifyCommand } from './types';

/** Several X tabs asking at once share one answer for this long. */
const CACHE_MS = 1000;
/** Spotify applies a command a moment after accepting it. */
const SETTLE_MS = 350;
const DEFAULT_RETRY_MS = 5000;
const MAX_ART = 12;

export interface SpotifyService {
  /** What is playing now, or why nothing can be shown. Never throws. */
  state(): Promise<PlayerState>;
  /** Sends a playback command and answers with the state after it. Never throws. */
  command(command: SpotifyCommand): Promise<PlayerState>;
  /** Forgets the shared answer: the account or the Client ID just changed. */
  reset(): void;
}

interface Deps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * The background worker's Spotify client. It holds nothing that must survive the worker
 * stopping: tokens are in storage, and what it keeps in memory (the last answer for a second,
 * a rate-limit pause, a few covers) is only there to spare Spotify requests.
 */
export function createSpotifyService({
  fetch: fetcher = (...args) => fetch(...args),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: Deps = {}): SpotifyService {
  let cached: { state: PlayerState; at: number } | null = null;
  let inFlight: Promise<PlayerState> | null = null;
  /** Bumped by `reset`: a read started before it belongs to the old account and is not shared. */
  let generation = 0;
  let pausedUntil = 0;
  const art = new Map<string, string>();

  /** A cover as a data URL: X's page cannot load images from Spotify's hosts itself. */
  async function artData(url: string | null): Promise<string | null> {
    if (!url) return null;
    const known = art.get(url);
    if (known) return known;
    try {
      const response = await fetcher(url);
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 400_000) return null;
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const data = `data:${type};base64,${btoa(binary)}`;
      if (art.size >= MAX_ART) art.delete(art.keys().next().value!);
      art.set(url, data);
      return data;
    } catch {
      return null;
    }
  }

  /** An authorized request; a 401 gets one more try with a refreshed token. */
  async function call(
    url: string,
    method: string,
  ): Promise<{ response: Response; auth: SpotifyAuth } | PlayerState> {
    let token = await freshAuth(fetcher, now);
    for (let attempt = 0; ; attempt++) {
      if (!token) {
        const { spotify } = await loadPluginState();
        return { status: spotify.clientId ? 'disconnected' : 'setup' };
      }
      if (!token.ok)
        return token.reason === 'revoked'
          ? { status: 'disconnected' }
          : { status: 'error', message: token.message };
      const response = await fetcher(url, {
        method,
        headers: { Authorization: `Bearer ${token.auth.accessToken}` },
      });
      if (response.status !== 401 || attempt > 0) return { response, auth: token.auth };
      token = await freshAuth(fetcher, now, true);
    }
  }

  function rateLimited(response: Response): PlayerState {
    const seconds = Number(response.headers.get('retry-after'));
    const retryInMs =
      Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : DEFAULT_RETRY_MS;
    pausedUntil = now() + retryInMs;
    return {
      status: 'error',
      message: describeFailure(429, { message: '', reason: '' }),
      retryInMs,
    };
  }

  async function read(): Promise<PlayerState> {
    if (pausedUntil > now())
      return {
        status: 'error',
        message: describeFailure(429, { message: '', reason: '' }),
        retryInMs: pausedUntil - now(),
      };
    const result = await call(PLAYER_URL, 'GET');
    if ('status' in result && !('response' in result)) return result;
    const { response, auth } = result as { response: Response; auth: SpotifyAuth };
    if (response.status === 204) return { status: 'idle' };
    if (response.status === 429) return rateLimited(response);
    if (response.status === 401)
      return {
        status: 'error',
        message: 'Spotify did not accept the saved sign-in. Reconnect it in Better X → Plugins.',
      };
    if (!response.ok)
      return {
        status: 'error',
        message: describeFailure(response.status, await apiError(response)),
      };
    const denied =
      auth.controlsDenied || (auth.user?.product && auth.user.product !== 'premium')
        ? PREMIUM_NOTE
        : undefined;
    const parsed = parsePlayback(await response.json().catch(() => null), now(), denied);
    if (!parsed) return { status: 'idle' };
    parsed.state.track.art = await artData(parsed.artUrl);
    return parsed.state;
  }

  function state(): Promise<PlayerState> {
    if (cached && now() - cached.at < CACHE_MS) return Promise.resolve(cached.state);
    if (inFlight) return inFlight;
    const mine = generation;
    const reading = read()
      .catch((): PlayerState => ({ status: 'error', message: 'Could not reach Spotify.' }))
      .then((result) => {
        if (mine !== generation) return result;
        // Only answers that cost Spotify a request are shared; the others are free to recompute.
        cached =
          result.status === 'setup' || result.status === 'disconnected'
            ? null
            : { state: result, at: now() };
        inFlight = null;
        return result;
      });
    inFlight = reading;
    return reading;
  }

  async function command(input: SpotifyCommand): Promise<PlayerState> {
    try {
      const { method, url } = commandRequest(input);
      const result = await call(url, method);
      if ('status' in result && !('response' in result)) return result;
      const { response, auth } = result as { response: Response; auth: SpotifyAuth };
      if (response.status === 429) return rateLimited(response);
      if (!response.ok) {
        const error = await apiError(response);
        if (response.status === 403 && error.reason === 'PREMIUM_REQUIRED') {
          // Remembered, so the controls are not offered again until the account reconnects.
          const latest = (await loadAuth()) ?? auth;
          await saveAuth({ ...latest, controlsDenied: true });
          cached = null;
          return state();
        }
        return { status: 'error', message: describeFailure(response.status, error) };
      }
      cached = null;
      await sleep(SETTLE_MS);
      cached = null;
      return state();
    } catch {
      return { status: 'error', message: 'Could not reach Spotify.' };
    }
  }

  return {
    state,
    command,
    reset() {
      generation++;
      inFlight = null;
      cached = null;
      pausedUntil = 0;
    },
  };
}
