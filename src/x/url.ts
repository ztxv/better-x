export interface PostIdentity {
  tweetId: string;
  url: string;
  handle: string | null;
}

const HOSTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);

export function parsePostUrl(input: string): PostIdentity | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  const statusIndex = segments.findIndex((segment) => segment === 'status');
  if (statusIndex < 1 || statusIndex + 1 >= segments.length) return null;
  const id = segments[statusIndex + 1];
  if (!id || !/^\d+$/.test(id)) return null;
  const handle = segments[statusIndex - 1] ?? null;
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return { tweetId: id, url: `https://x.com/${handle}/status/${id}`, handle };
}

const TWITTER_EPOCH = 1288834974657n;

/** Post IDs are Snowflakes, so the creation time is encoded in the ID itself. */
export function postDateFromId(tweetId: string): string | null {
  if (!/^\d{15,20}$/.test(tweetId)) return null;
  const ms = Number((BigInt(tweetId) >> 22n) + TWITTER_EPOCH);
  return ms > Number(TWITTER_EPOCH) && ms < Date.now() + 86_400_000
    ? new Date(ms).toISOString()
    : null;
}
