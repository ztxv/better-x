import { beforeEach, describe, expect, it } from 'vitest';
import { PLUGINS_KEY } from '../plugins/state';
import { freshEnvironment } from '../test/fakes';
import { commandRequest, parsePlayback, pickArt, PLAYER_URL, PREMIUM_NOTE } from './api';
import { authorizeUrl, challengeFor, TOKEN_URL } from './auth';
import { createSpotifyService } from './service';
import { parseCommand, SPOTIFY_AUTH_KEY, type SpotifyAuth } from './types';

const CLIENT = 'a'.repeat(32);
const auth = (over: Partial<SpotifyAuth> = {}): SpotifyAuth => ({
  clientId: CLIENT,
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: 10_000_000,
  ...over,
});
const playback = (over: Record<string, unknown> = {}) => ({
  is_playing: true,
  progress_ms: 23_000,
  shuffle_state: false,
  repeat_state: 'off',
  currently_playing_type: 'track',
  device: { is_restricted: false },
  actions: { disallows: { resuming: true } },
  item: {
    name: 'And 1 : 100 sum',
    duration_ms: 204_000,
    artists: [{ name: '406ahmad' }, { name: 'Dragnutz' }],
    album: {
      name: 'LIFE OF AHMAD 3',
      images: [
        { url: 'https://i.scdn.co/image/big', width: 640 },
        { url: 'https://i.scdn.co/image/mid', width: 300 },
        { url: 'https://i.scdn.co/image/small', width: 64 },
      ],
    },
    external_urls: { spotify: 'https://open.spotify.com/track/abc' },
  },
  ...over,
});
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

let data: Record<string, unknown>;
let clock: number;
/** A scripted Spotify: each URL answers from a queue (the last answer repeats). */
function spotify(routes: Record<string, Array<() => Response>>) {
  const calls: Array<{ url: string; method: string; token: string | null; body: string }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      token: headers.get('authorization'),
      body: String(init?.body ?? ''),
    });
    const queue = routes[url];
    if (!queue?.length) throw new TypeError('Failed to fetch');
    return (queue.length > 1 ? queue.shift()! : queue[0]!)();
  }) as typeof fetch;
  const service = createSpotifyService({
    fetch: fetcher,
    now: () => clock,
    sleep: async () => {},
  });
  return { service, calls };
}

beforeEach(async () => {
  ({ data } = await freshEnvironment());
  clock = 1_000_000;
});

describe('parsing', () => {
  it('reads a track, its controls and the cover to fetch', () => {
    const parsed = parsePlayback(playback(), 5)!;
    expect(parsed.artUrl).toBe('https://i.scdn.co/image/mid');
    expect(parsed.state).toMatchObject({
      status: 'playing',
      isPlaying: true,
      progressMs: 23_000,
      at: 5,
      repeat: 'off',
      track: { title: 'And 1 : 100 sum', artists: '406ahmad, Dragnutz', album: 'LIFE OF AHMAD 3' },
      controls: {
        toggle: true,
        next: true,
        previous: true,
        seek: true,
        shuffle: true,
        repeat: true,
      },
    });
  });

  it('draws no control Spotify disallows, and none at all without Premium or on a restricted device', () => {
    const limited = parsePlayback(
      playback({ actions: { disallows: { pausing: true, skipping_prev: true, seeking: true } } }),
      0,
    )!.state;
    expect(limited.controls).toMatchObject({
      toggle: false,
      previous: false,
      seek: false,
      next: true,
    });
    const free = parsePlayback(playback(), 0, PREMIUM_NOTE)!.state;
    expect(Object.values(free.controls).some(Boolean)).toBe(false);
    expect(free.note).toBe(PREMIUM_NOTE);
    const restricted = parsePlayback(playback({ device: { is_restricted: true } }), 0)!.state;
    expect(Object.values(restricted.controls).some(Boolean)).toBe(false);
  });

  it('handles an advertisement, an episode and junk without inventing a song', () => {
    const ad = parsePlayback(playback({ item: null, currently_playing_type: 'ad' }), 0)!.state;
    expect(ad.track).toMatchObject({ title: 'Advertisement', artists: '', art: null, url: null });
    expect(ad.controls.seek).toBe(false);
    const episode = parsePlayback(
      playback({ item: { name: 'Ep 1', duration_ms: 1000, show: { name: 'A Show' } } }),
      0,
    )!.state;
    expect(episode.track.artists).toBe('A Show');
    expect(parsePlayback('nope', 0)).toBeNull();
  });

  it('only takes cover art from Spotify’s hosts, and links only to open.spotify.com', () => {
    expect(pickArt([{ url: 'https://evil.example/x.png', width: 300 }])).toBeNull();
    expect(pickArt([{ url: 'http://i.scdn.co/image/x', width: 300 }])).toBeNull();
    expect(pickArt([{ url: 'https://image-cdn-ak.spotifycdn.com/image/x', width: 64 }])).toBe(
      'https://image-cdn-ak.spotifycdn.com/image/x',
    );
    const item = { ...playback().item, external_urls: { spotify: 'javascript:alert(1)' } };
    expect(parsePlayback(playback({ item }), 0)!.state.track.url).toBeNull();
  });

  it('accepts only well-formed commands', () => {
    expect(parseCommand({ action: 'pause', extra: 1 })).toEqual({ action: 'pause' });
    expect(parseCommand({ action: 'seek', positionMs: 1500.6 })).toEqual({
      action: 'seek',
      positionMs: 1501,
    });
    for (const bad of [
      null,
      'play',
      { action: 'volume' },
      { action: 'seek', positionMs: -1 },
      { action: 'seek', positionMs: '5' },
      { action: 'shuffle', on: 'yes' },
      { action: 'repeat', mode: 'forever' },
    ])
      expect(parseCommand(bad)).toBeNull();
    expect(commandRequest({ action: 'repeat', mode: 'track' })).toEqual({
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/repeat?state=track',
    });
  });
});

describe('PKCE', () => {
  it('derives the S256 challenge (RFC 7636 appendix B) and asks for a code, with no secret', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    const url = new URL(authorizeUrl(CLIENT, 'https://x.chromiumapp.org/spotify', 'chal', 'st'));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT,
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: 'chal',
      state: 'st',
    });
    expect(url.search).not.toContain('secret');
  });
});

describe('service', () => {
  it('says setup with no Client ID, disconnected with one, and asks Spotify for neither', async () => {
    const { service, calls } = spotify({});
    expect(await service.state()).toEqual({ status: 'setup' });
    data[PLUGINS_KEY] = { spotify: { clientId: CLIENT } };
    clock += 5000;
    expect(await service.state()).toEqual({ status: 'disconnected' });
    expect(calls).toEqual([]);
  });

  it('reports what is playing with the cover as a data URL, sharing one answer between tabs', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const { service, calls } = spotify({
      [PLAYER_URL]: [() => reply(playback())],
      'https://i.scdn.co/image/mid': [
        () =>
          new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }),
      ],
    });
    const [first, second] = await Promise.all([service.state(), service.state()]);
    expect(first).toBe(second);
    expect(first).toMatchObject({
      status: 'playing',
      track: { art: 'data:image/jpeg;base64,AQID' },
    });
    expect(calls.filter((call) => call.url === PLAYER_URL)).toHaveLength(1);
    expect(calls[0]!.token).toBe('Bearer access-1');
  });

  it('is idle on 204, and pauses on 429 for as long as Spotify says', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const { service, calls } = spotify({
      [PLAYER_URL]: [() => reply(null, 204), () => reply({}, 429, { 'retry-after': '30' })],
    });
    expect(await service.state()).toEqual({ status: 'idle' });
    clock += 2000;
    expect(await service.state()).toMatchObject({ status: 'error', retryInMs: 30_000 });
    clock += 10_000;
    expect(await service.state()).toMatchObject({ status: 'error', retryInMs: 20_000 });
    expect(calls).toHaveLength(2);
  });

  it('refreshes an expired token without a secret and keeps the rotated refresh token', async () => {
    data[SPOTIFY_AUTH_KEY] = auth({ expiresAt: clock - 1 });
    const { service, calls } = spotify({
      [TOKEN_URL]: [
        () => reply({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 }),
      ],
      [PLAYER_URL]: [() => reply(null, 204)],
    });
    expect(await service.state()).toEqual({ status: 'idle' });
    expect(calls[0]!.body).toBe(
      `grant_type=refresh_token&refresh_token=refresh-1&client_id=${CLIENT}`,
    );
    expect(calls[1]!.token).toBe('Bearer access-2');
    expect(data[SPOTIFY_AUTH_KEY]).toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: clock + 3_600_000,
    });
  });

  it('forgets a revoked connection and says disconnected', async () => {
    data[SPOTIFY_AUTH_KEY] = auth({ expiresAt: 0 });
    data[PLUGINS_KEY] = { spotify: { clientId: CLIENT } };
    const { service } = spotify({
      [TOKEN_URL]: [() => reply({ error: 'invalid_grant' }, 400)],
    });
    expect(await service.state()).toEqual({ status: 'disconnected' });
    expect(SPOTIFY_AUTH_KEY in data).toBe(false);
  });

  it('explains an account that is not on the app’s user list, and a network failure', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const denied = spotify({
      [PLAYER_URL]: [
        () =>
          reply(
            { error: { status: 403, message: 'User not registered in the Developer Dashboard' } },
            403,
          ),
      ],
    });
    const state = await denied.service.state();
    expect(state.status === 'error' && state.message).toContain('User Management');
    expect(await spotify({}).service.state()).toEqual({
      status: 'error',
      message: 'Could not reach Spotify.',
    });
  });

  it('sends a command and answers with the state after it', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const { service, calls } = spotify({
      'https://api.spotify.com/v1/me/player/pause': [() => reply(null, 204)],
      [PLAYER_URL]: [
        () => reply(playback({ is_playing: false, item: { name: 'T', duration_ms: 5 } })),
      ],
    });
    expect(await service.command({ action: 'pause' })).toMatchObject({
      status: 'playing',
      isPlaying: false,
    });
    expect(calls[0]).toMatchObject({ method: 'PUT', token: 'Bearer access-1' });
  });

  it('stops offering controls once Spotify says Premium is required', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const { service } = spotify({
      'https://api.spotify.com/v1/me/player/next': [
        () => reply({ error: { status: 403, message: 'x', reason: 'PREMIUM_REQUIRED' } }, 403),
      ],
      [PLAYER_URL]: [() => reply(playback({ item: { name: 'T', duration_ms: 5 } }))],
    });
    const state = await service.command({ action: 'next' });
    expect(state).toMatchObject({ status: 'playing', note: PREMIUM_NOTE });
    expect(state.status === 'playing' && Object.values(state.controls).some(Boolean)).toBe(false);
    expect(data[SPOTIFY_AUTH_KEY]).toMatchObject({ controlsDenied: true });
  });

  it('says there is no active device instead of pretending the command worked', async () => {
    data[SPOTIFY_AUTH_KEY] = auth();
    const { service } = spotify({
      'https://api.spotify.com/v1/me/player/play': [
        () => reply({ error: { status: 404, message: 'x', reason: 'NO_ACTIVE_DEVICE' } }, 404),
      ],
    });
    const state = await service.command({ action: 'play' });
    expect(state.status === 'error' && state.message).toContain('No active Spotify device');
  });
});
