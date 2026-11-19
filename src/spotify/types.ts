/**
 * Spotify, as Better X uses it: the Web API with the Authorization Code + PKCE flow, which needs
 * no client secret (there is none anywhere in the extension). The person supplies the Client ID
 * of their own Spotify app; tokens are kept in `chrome.storage.local` under `bx.spotify.auth` and
 * are used only by the background worker, never sent to the X page.
 */
export const SPOTIFY_AUTH_KEY = 'bx.spotify.auth';

/** Read what is playing, and control playback (control needs Spotify Premium). */
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'user-read-private',
] as const;

export interface SpotifyAuth {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms after which the access token must be refreshed. */
  expiresAt: number;
  /** Who connected, for the settings panel. `product` is `premium`, `free`… when Spotify says. */
  user?: { name: string; product?: string };
  /** Set once Spotify has refused a playback command for lack of Premium. */
  controlsDenied?: boolean;
}

export type RepeatMode = 'off' | 'context' | 'track';

export interface SpotifyTrack {
  title: string;
  /** Artists, or the show for a podcast episode. May be empty. */
  artists: string;
  album: string;
  /** A small cover as a `data:image/…` URL (X's page may only show images from its own hosts). */
  art: string | null;
  /**
   * The largest cover's address on Spotify's image host, for the big cover view. The page never
   * loads it itself: it asks the worker (`spotifyArt`) for it as a data URL, only when opened.
   */
  artLarge?: string | null;
  /** The item's page on open.spotify.com. */
  url: string | null;
  durationMs: number;
}

/** What Spotify allows right now. A control that is false is not drawn. */
export interface PlayerControls {
  toggle: boolean;
  next: boolean;
  previous: boolean;
  seek: boolean;
  shuffle: boolean;
  repeat: boolean;
}

export type PlayerState =
  /** No Client ID has been entered yet. */
  | { status: 'setup' }
  /** A Client ID is set but no account is connected (or the connection was revoked). */
  | { status: 'disconnected' }
  /** Connected; nothing is playing on any device. */
  | { status: 'idle' }
  | { status: 'error'; message: string; retryInMs?: number }
  | {
      status: 'playing';
      track: SpotifyTrack;
      isPlaying: boolean;
      progressMs: number;
      /** Epoch ms at which `progressMs` was true. */
      at: number;
      shuffle: boolean;
      repeat: RepeatMode;
      controls: PlayerControls;
      /** Why controls are missing, when they are (no Premium, a restricted device). */
      note?: string;
    };

export type SpotifyCommand =
  | { action: 'play' | 'pause' | 'next' | 'previous' }
  | { action: 'seek'; positionMs: number }
  | { action: 'shuffle'; on: boolean }
  | { action: 'repeat'; mode: RepeatMode };

const ACTIONS = new Set(['play', 'pause', 'next', 'previous', 'seek', 'shuffle', 'repeat']);
const REPEATS = new Set<unknown>(['off', 'context', 'track']);
/** No track is longer than a day; a seek past that is not a seek. */
const MAX_SEEK_MS = 24 * 60 * 60 * 1000;

/** A command exactly as allowed, or null. Messages from an X tab are checked with this. */
export function parseCommand(input: unknown): SpotifyCommand | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  const action = value.action;
  if (typeof action !== 'string' || !ACTIONS.has(action)) return null;
  if (action === 'seek') {
    const positionMs = value.positionMs;
    return typeof positionMs === 'number' &&
      Number.isFinite(positionMs) &&
      positionMs >= 0 &&
      positionMs <= MAX_SEEK_MS
      ? { action, positionMs: Math.round(positionMs) }
      : null;
  }
  if (action === 'shuffle') return typeof value.on === 'boolean' ? { action, on: value.on } : null;
  if (action === 'repeat')
    return REPEATS.has(value.mode) ? { action, mode: value.mode as RepeatMode } : null;
  return { action: action as 'play' | 'pause' | 'next' | 'previous' };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Stored auth, or null when it is missing or not whole. */
export function parseAuth(input: unknown): SpotifyAuth | null {
  if (!isRecord(input)) return null;
  const { clientId, accessToken, refreshToken, expiresAt, user } = input;
  if (
    typeof clientId !== 'string' ||
    typeof accessToken !== 'string' ||
    typeof refreshToken !== 'string' ||
    !refreshToken ||
    typeof expiresAt !== 'number'
  )
    return null;
  const auth: SpotifyAuth = { clientId, accessToken, refreshToken, expiresAt };
  if (isRecord(user) && typeof user.name === 'string')
    auth.user = {
      name: user.name.slice(0, 80),
      ...(typeof user.product === 'string' ? { product: user.product.slice(0, 20) } : {}),
    };
  if (input.controlsDenied === true) auth.controlsDenied = true;
  return auth;
}
