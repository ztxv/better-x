import type {
  PlayerControls,
  PlayerState,
  RepeatMode,
  SpotifyCommand,
  SpotifyTrack,
} from './types';

/** The Web API's player endpoints. Everything Better X knows about their shapes is in this file. */
export const API = 'https://api.spotify.com/v1';
export const PLAYER_URL = `${API}/me/player?additional_types=track,episode`;

type Playing = Extract<PlayerState, { status: 'playing' }>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.slice(0, max) : '');
const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const NO_CONTROLS: PlayerControls = {
  toggle: false,
  next: false,
  previous: false,
  seek: false,
  shuffle: false,
  repeat: false,
};

/** Hosts Spotify serves cover art from. Art from anywhere else is not fetched. */
const ART_HOST = /(^|\.)(scdn\.co|spotifycdn\.com)$/;

/** The smallest cover that is still sharp at the player's size, from Spotify's list of sizes. */
export function pickArt(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const usable = images
    .filter(isRecord)
    .map((image) => ({ url: text(image.url, 500), width: count(image.width) }))
    .filter(({ url }) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && ART_HOST.test(parsed.hostname);
      } catch {
        return false;
      }
    });
  if (!usable.length) return null;
  // Sizes come largest first (640, 300, 64). 96 px or more covers a 2x screen at 40 px.
  const sharp = usable.filter((image) => image.width >= 96).sort((a, b) => a.width - b.width);
  return (sharp[0] ?? usable[0])!.url;
}

/** Whether `url` is an https address on Spotify's image hosts (the only art ever fetched). */
export function isArtUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 500) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ART_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** The largest cover Spotify lists, for the big cover view. */
export function pickLargestArt(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const usable = images
    .filter(isRecord)
    .map((image) => ({ url: text(image.url, 500), width: count(image.width) }))
    .filter(({ url }) => isArtUrl(url))
    .sort((a, b) => b.width - a.width);
  return usable[0]?.url ?? null;
}

const openUrl = (item: Record<string, unknown>) => {
  const url = isRecord(item.external_urls) ? text(item.external_urls.spotify, 300) : '';
  return url.startsWith('https://open.spotify.com/') ? url : null;
};

/**
 * Spotify's `GET /me/player` body as a player state. `artUrl` is the cover's address, for the
 * caller to turn into a data URL. A body without the expected shape is null. `denied` is why the
 * person has no controls at all (no Premium), when that is known.
 */
export function parsePlayback(
  data: unknown,
  now: number,
  denied?: string,
): { state: Playing; artUrl: string | null } | null {
  if (!isRecord(data)) return null;
  const item = isRecord(data.item) ? data.item : null;
  const kind = text(data.currently_playing_type, 20);
  let track: SpotifyTrack;
  let artUrl: string | null = null;
  if (item) {
    const album = isRecord(item.album) ? item.album : null;
    const show = isRecord(item.show) ? item.show : null;
    const artists = Array.isArray(item.artists)
      ? item.artists
          .filter(isRecord)
          .map((artist) => text(artist.name, 80))
          .filter(Boolean)
          .join(', ')
      : '';
    artUrl = pickArt(album?.images) ?? pickArt(item.images) ?? pickArt(show?.images);
    track = {
      title: text(item.name) || 'Unknown title',
      artists: artists || text(show?.name) || text(show?.publisher),
      album: text(album?.name),
      art: null,
      artLarge:
        pickLargestArt(album?.images) ??
        pickLargestArt(item.images) ??
        pickLargestArt(show?.images),
      url: openUrl(item),
      durationMs: count(item.duration_ms),
    };
  } else {
    // Spotify names no item for an advertisement (and some local or unknown items).
    track = {
      title: kind === 'ad' ? 'Advertisement' : 'Playing on Spotify',
      artists: '',
      album: '',
      art: null,
      url: null,
      durationMs: 0,
    };
  }

  const disallows =
    isRecord(data.actions) && isRecord(data.actions.disallows) ? data.actions.disallows : {};
  const allowed = (name: string) => disallows[name] !== true;
  const isPlaying = data.is_playing === true;
  const restricted = isRecord(data.device) && data.device.is_restricted === true;
  let controls: PlayerControls = {
    toggle: allowed(isPlaying ? 'pausing' : 'resuming'),
    next: allowed('skipping_next'),
    previous: allowed('skipping_prev'),
    seek: allowed('seeking') && track.durationMs > 0,
    shuffle: allowed('toggling_shuffle'),
    repeat: allowed('toggling_repeat_context') || allowed('toggling_repeat_track'),
  };
  let note: string | undefined;
  if (denied) {
    controls = NO_CONTROLS;
    note = denied;
  } else if (restricted) {
    controls = NO_CONTROLS;
    note = 'This device does not accept remote control.';
  }
  const repeat = text(data.repeat_state, 10);
  return {
    artUrl,
    state: {
      status: 'playing',
      track,
      isPlaying,
      progressMs: Math.min(count(data.progress_ms), track.durationMs || Infinity),
      at: now,
      shuffle: data.shuffle_state === true,
      repeat: (repeat === 'context' || repeat === 'track' ? repeat : 'off') as RepeatMode,
      controls,
      ...(note ? { note } : {}),
    },
  };
}

/** The request a command becomes. */
export function commandRequest(command: SpotifyCommand): { method: 'PUT' | 'POST'; url: string } {
  switch (command.action) {
    case 'play':
      return { method: 'PUT', url: `${API}/me/player/play` };
    case 'pause':
      return { method: 'PUT', url: `${API}/me/player/pause` };
    case 'next':
      return { method: 'POST', url: `${API}/me/player/next` };
    case 'previous':
      return { method: 'POST', url: `${API}/me/player/previous` };
    case 'seek':
      return { method: 'PUT', url: `${API}/me/player/seek?position_ms=${command.positionMs}` };
    case 'shuffle':
      return { method: 'PUT', url: `${API}/me/player/shuffle?state=${command.on}` };
    case 'repeat':
      return { method: 'PUT', url: `${API}/me/player/repeat?state=${command.mode}` };
  }
}

/** Spotify's error body: `{ error: { status, message, reason } }`. Missing parts are ''. */
export async function apiError(response: Response): Promise<{ message: string; reason: string }> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown; reason?: unknown } };
    return { message: text(body.error?.message), reason: text(body.error?.reason, 60) };
  } catch {
    return { message: '', reason: '' };
  }
}

export const PREMIUM_NOTE = 'Playback controls need Spotify Premium.';

/** A failed player request as something a person can act on. */
export function describeFailure(
  status: number,
  error: { message: string; reason: string },
): string {
  if (status === 403 && /not registered/i.test(error.message))
    return 'This Spotify account is not added to your Spotify app. Add it under User Management in the Spotify developer dashboard.';
  if (status === 403 && error.reason === 'PREMIUM_REQUIRED') return PREMIUM_NOTE;
  if (status === 403) return error.message || 'Spotify refused that request.';
  if (status === 404) return 'No active Spotify device. Start playing in a Spotify app first.';
  if (status === 429) return 'Spotify is limiting requests. Trying again shortly.';
  if (status >= 500) return 'Spotify is having trouble right now.';
  return error.message || `Spotify answered with an error (${status}).`;
}
