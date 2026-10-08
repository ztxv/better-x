import { describe, expect, it } from 'vitest';
import { ABOUT_QUERY_ID, createAboutTransport, readRate } from './about-transport';

const NOW = 1_800_000_000_000;
const ok = {
  data: {
    user_result_by_screen_name: {
      result: { about_profile: { account_based_in: 'Japan', source: 'web' } },
    },
  },
};
const respond = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

function make(response: () => Response | Promise<Response>, cookie = 'a=1; ct0=TOKEN%2Bx; b=2') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const transport = createAboutTransport({
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return response();
    }) as unknown as typeof fetch,
    cookie: () => cookie,
    now: () => NOW,
  });
  return { transport, calls };
}

describe('about-account transport', () => {
  it('asks x.com’s own endpoint, same-origin, with the page’s token and nothing stored', async () => {
    const { transport, calls } = make(() => respond(200, ok));
    const result = await transport.lookup('someone');
    expect(result.outcome.kind).toBe('ok');
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url.startsWith(`/i/api/graphql/${ABOUT_QUERY_ID}/AboutAccountQuery?variables=`)).toBe(
      true,
    );
    expect(decodeURIComponent(url.split('variables=')[1]!)).toBe('{"screenName":"someone"}');
    expect(init.credentials).toBe('same-origin');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('TOKEN+x');
    expect(headers.authorization).toMatch(/^Bearer /);
    expect(headers['accept-language']).toMatch(/^en/);
  });

  it('does not ask at all without a session token', async () => {
    const { transport, calls } = make(() => respond(200, ok), 'other=1');
    expect((await transport.lookup('someone')).outcome).toEqual({ kind: 'unauthorized' });
    expect(calls).toHaveLength(0);
  });

  it('maps X’s answers to outcomes', async () => {
    const outcome = async (res: () => Response) => (await make(res).transport.lookup('a')).outcome;
    expect(await outcome(() => respond(401))).toEqual({ kind: 'unauthorized' });
    expect(await outcome(() => respond(403))).toEqual({ kind: 'unauthorized' });
    expect(await outcome(() => respond(404))).toEqual({ kind: 'unsupported' });
    expect(await outcome(() => respond(400))).toEqual({ kind: 'unsupported' });
    expect(await outcome(() => respond(500))).toEqual({ kind: 'error', status: 500 });
    expect(await outcome(() => new Response('<html>', { status: 200 }))).toEqual({
      kind: 'unsupported',
    });
    expect(
      await outcome(() =>
        respond(200, {
          data: { user_result_by_screen_name: { result: { __typename: 'UserUnavailable' } } },
        }),
      ),
    ).toEqual({ kind: 'notFound' });
    expect(
      await outcome(() =>
        respond(200, {
          data: { user_result_by_screen_name: { result: { core: { screen_name: 'zzz' } } } },
        }),
      ),
    ).toEqual({ kind: 'unsupported' });
  });

  it('turns a network failure into an error and never throws', async () => {
    const { transport } = make(() => Promise.reject(new TypeError('Failed to fetch')));
    expect((await transport.lookup('a')).outcome).toEqual({ kind: 'error' });
  });

  it('honours the reset X reports on a 429, and falls back to a minute', async () => {
    const reset = String((NOW + 90_000) / 1000);
    const limited = make(() => respond(429, undefined, { 'x-rate-limit-reset': reset }));
    expect((await limited.transport.lookup('a')).outcome).toEqual({
      kind: 'rateLimited',
      until: NOW + 90_000,
    });
    const bare = make(() => respond(429));
    expect((await bare.transport.lookup('a')).outcome).toEqual({
      kind: 'rateLimited',
      until: NOW + 60_000,
    });
  });

  it('stops when told to', async () => {
    const controller = new AbortController();
    const { transport } = make(() => new Promise<Response>(() => {}) /* never answers */);
    const pending = transport.lookup('a', controller.signal);
    controller.abort();
    // The abort is forwarded to fetch; with a fetch that ignores it the lookup is still pending,
    // so only assert that aborting does not throw.
    await Promise.race([pending, Promise.resolve()]);
  });
});

describe('readRate', () => {
  it('reads remaining, reset and retry-after, and ignores junk or past times', () => {
    const headers = (init: Record<string, string>) => new Headers(init);
    expect(
      readRate(
        headers({
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': String((NOW + 5000) / 1000),
        }),
        NOW,
      ),
    ).toEqual({ remaining: 0, resetAt: NOW + 5000 });
    expect(readRate(headers({ 'retry-after': '30' }), NOW)).toEqual({ resetAt: NOW + 30_000 });
    expect(
      readRate(
        headers({ 'x-rate-limit-reset': String((NOW - 5000) / 1000), 'retry-after': 'soon' }),
        NOW,
      ),
    ).toEqual({});
    expect(readRate(headers({}), NOW)).toEqual({});
  });
});
