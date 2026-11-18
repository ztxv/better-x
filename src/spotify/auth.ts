import { parseAuth, SPOTIFY_AUTH_KEY, SPOTIFY_SCOPES, type SpotifyAuth } from './types';

/**
 * Connecting a Spotify account: Authorization Code with PKCE, the flow Spotify prescribes for
 * apps that cannot keep a secret. There is no client secret anywhere: the token request proves
 * itself with the one-time code verifier this module makes for each connection.
 */
const AUTHORIZE = 'https://accounts.spotify.com/authorize';
export const TOKEN_URL = 'https://accounts.spotify.com/api/token';
/** Refresh a little early, so a token never expires between the check and the request. */
const EARLY_MS = 60_000;

/** The address Spotify sends the person back to. It must be listed, exactly, on their Spotify app. */
export const redirectUri = (): string => chrome.identity?.getRedirectURL?.('spotify') ?? '';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const randomToken = (bytes = 48) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(clientId: string, redirect: string, challenge: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
  });
  return `${AUTHORIZE}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Spotify's own words for a failed token request, when it gave any. */
async function tokenError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; error_description?: string };
    return body.error_description || body.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function requestToken(
  body: Record<string, string>,
  fetcher: typeof fetch,
): Promise<{ ok: true; token: TokenResponse } | { ok: false; status: number; error: string }> {
  const response = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!response.ok)
    return { ok: false, status: response.status, error: await tokenError(response) };
  const token = (await response.json()) as Partial<TokenResponse>;
  if (typeof token.access_token !== 'string' || typeof token.expires_in !== 'number')
    return { ok: false, status: 502, error: 'Spotify sent an unexpected reply.' };
  return { ok: true, token: token as TokenResponse };
}

export async function loadAuth(): Promise<SpotifyAuth | null> {
  const stored = await chrome.storage.local.get(SPOTIFY_AUTH_KEY);
  return parseAuth(stored[SPOTIFY_AUTH_KEY]);
}
export const saveAuth = (auth: SpotifyAuth) =>
  chrome.storage.local.set({ [SPOTIFY_AUTH_KEY]: auth });
/** Forgets the account on this browser. (Access can also be removed at spotify.com/account/apps.) */
export const disconnectSpotify = () => chrome.storage.local.remove(SPOTIFY_AUTH_KEY);

/** What went wrong while connecting, in words the settings panel can show as they are. */
export class SpotifyConnectError extends Error {}

/**
 * Asks Spotify about the sign-in address before showing it. When the app's settings do not match,
 * Spotify answers with a bare error page ("redirect_uri: Not matching configuration", "INVALID_CLIENT"),
 * which Chrome's sign-in window reports only as "could not be loaded" and a tab shows with nothing
 * to do but wait. Read here first, it becomes a message that says what to fix. A good address
 * answers with a redirect (to log in, or straight back with a code that is never used) or the
 * consent page. Spotify checks the app only for a signed-in person (signed out, it sends everyone
 * to its login page first), so the request carries Spotify's cookies, as the tab would. A network
 * failure or a login redirect is not a verdict, so the sign-in goes ahead.
 */
export async function checkAuthorizeUrl(
  url: string,
  redirect: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(url, {
      redirect: 'manual',
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return;
  }
  if (response.type === 'opaqueredirect' || response.status < 400) return;
  let text = '';
  try {
    text = (await response.text()).slice(0, 2000);
  } catch {
    /* the status is enough */
  }
  if (/redirect_uri/i.test(text))
    throw new SpotifyConnectError(
      `Spotify says the Redirect URI is not set up on your app. In the Spotify developer dashboard open your app → Settings → Edit, add exactly ${redirect} under Redirect URIs, press Add, then Save at the bottom of the page, and connect again.`,
    );
  if (/invalid.client|client_id/i.test(text))
    throw new SpotifyConnectError(
      'Spotify does not know that Client ID. Copy it again from your app’s page in the Spotify developer dashboard (Settings → Basic Information).',
    );
  if (response.status >= 400 && response.status < 500)
    throw new SpotifyConnectError(
      `Spotify refused the sign-in request${
        text
          ? `: ${text
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 160)}`
          : ` (HTTP ${response.status})`
      }.`,
    );
}

/** Chrome's wording when the person closes the sign-in window themselves. */
const CLOSED = /did not approve|cancel|closed/i;

/**
 * Shows Spotify's consent page and resolves with the address Spotify sent the person back to.
 *
 * First through `chrome.identity.launchWebAuthFlow`, Chrome's own sign-in window. That window can
 * fail to open from some places (Chrome reports "Authorization page could not be loaded" when it
 * is asked from a page framed inside x.com, and on some Chrome builds from the side panel), so the
 * worker runs it, and when it still fails for any reason other than the person closing it, the
 * same page opens in an ordinary tab instead: the tab is watched until Spotify sends it to the
 * redirect address, then closed. Chrome's own words are kept in the final error, so a wrong
 * Client ID or redirect URI can be told apart from a window that would not open.
 */
export async function openConsent(url: string, redirect: string): Promise<string> {
  let firstProblem = '';
  if (chrome.identity?.launchWebAuthFlow) {
    try {
      const returned = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
      if (returned) return returned;
      firstProblem = 'Chrome returned no address.';
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (CLOSED.test(text))
        throw new SpotifyConnectError('The Spotify window was closed before finishing.');
      firstProblem = text;
    }
  }
  if (chrome.tabs?.onUpdated) return consentInTab(url, redirect);
  throw new SpotifyConnectError(
    `Spotify’s sign-in page could not be loaded${firstProblem ? ` (${firstProblem})` : ''}. Check the Client ID, and that the redirect URI above is added to your Spotify app exactly.`,
  );
}

/** How long the tab fallback waits for the person to finish signing in. */
const TAB_TIMEOUT_MS = 10 * 60_000;

/** The consent page in a normal tab; resolves when the tab reaches `redirect`. */
function consentInTab(url: string, redirect: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let tabId: number | undefined;
    let done = false;
    const finish = (result: () => void) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timer);
      result();
    };
    const onUpdated = (id: number, change: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (id !== tabId) return;
      const at = change.url ?? tab.pendingUrl ?? tab.url ?? '';
      if (!at.startsWith(redirect)) return;
      finish(() => resolve(at));
      void chrome.tabs.remove(id).catch(() => {});
    };
    const onRemoved = (id: number) => {
      if (id === tabId)
        finish(() =>
          reject(new SpotifyConnectError('The Spotify tab was closed before finishing.')),
        );
    };
    const timer = setTimeout(
      () => finish(() => reject(new SpotifyConnectError('Signing in to Spotify timed out.'))),
      TAB_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.create({ url, active: true }).then(
      (tab) => (tabId = tab.id),
      () =>
        finish(() =>
          reject(new SpotifyConnectError('Spotify’s sign-in page could not be opened.')),
        ),
    );
  });
}

/**
 * Opens Spotify's consent window and stores the resulting tokens. Run by the background worker
 * (the Plugins tab asks it with `spotifyConnect`), because Chrome's sign-in window does not open
 * reliably from a framed or side-panel page. Throws `SpotifyConnectError` with a usable message.
 */
export async function connectSpotify(
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<SpotifyAuth> {
  if (!chrome.identity?.getRedirectURL)
    throw new SpotifyConnectError('This browser does not let extensions open a sign-in window.');
  const redirect = redirectUri();
  const verifier = randomToken(64);
  const state = randomToken(16);
  const url = authorizeUrl(clientId, redirect, await challengeFor(verifier), state);

  await checkAuthorizeUrl(url, redirect, fetcher);
  const returned = await openConsent(url, redirect);
  if (!returned) throw new SpotifyConnectError('Spotify did not send an answer.');
  const params = new URL(returned).searchParams;
  if (params.get('state') !== state)
    throw new SpotifyConnectError('Spotify’s answer did not match this request. Try again.');
  const denied = params.get('error');
  if (denied)
    throw new SpotifyConnectError(
      denied === 'access_denied' ? 'Access was not granted.' : `Spotify refused: ${denied}`,
    );
  const code = params.get('code');
  if (!code) throw new SpotifyConnectError('Spotify did not send an authorization code.');

  const result = await requestToken(
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
      client_id: clientId,
      code_verifier: verifier,
    },
    fetcher,
  ).catch(() => {
    throw new SpotifyConnectError('Could not reach Spotify. Check your connection and try again.');
  });
  if (!result.ok) throw new SpotifyConnectError(`Spotify refused the sign-in: ${result.error}`);
  if (!result.token.refresh_token)
    throw new SpotifyConnectError('Spotify did not send a refresh token.');

  const auth: SpotifyAuth = {
    clientId,
    accessToken: result.token.access_token,
    refreshToken: result.token.refresh_token,
    expiresAt: Date.now() + result.token.expires_in * 1000,
  };
  // Who this is, for the settings panel. Not needed for playback, so a failure here is fine.
  try {
    const me = await fetcher('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (me.ok) {
      const profile = (await me.json()) as {
        display_name?: unknown;
        id?: unknown;
        product?: unknown;
      };
      const name = typeof profile.display_name === 'string' ? profile.display_name : profile.id;
      if (typeof name === 'string' && name)
        auth.user = {
          name: name.slice(0, 80),
          ...(typeof profile.product === 'string' ? { product: profile.product } : {}),
        };
    }
  } catch {
    /* the name is a nicety */
  }
  await saveAuth(auth);
  return auth;
}

export type FreshToken =
  | { ok: true; auth: SpotifyAuth }
  /** The connection is gone (revoked, or the app was deleted): the stored auth was removed. */
  | { ok: false; reason: 'revoked' }
  | { ok: false; reason: 'error'; message: string };

let refreshing: Promise<FreshToken> | null = null;

/**
 * Stored auth with an access token that is still good, refreshing it first when it is not (or
 * when `force` says Spotify just refused it). One refresh at a time: Spotify rotates refresh
 * tokens, so two overlapping refreshes would invalidate each other.
 */
export function freshAuth(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
  force = false,
): Promise<FreshToken | null> {
  return (async () => {
    const auth = await loadAuth();
    if (!auth) return null;
    if (!force && auth.accessToken && auth.expiresAt - EARLY_MS > now()) return { ok: true, auth };
    refreshing ??= (async (): Promise<FreshToken> => {
      try {
        const result = await requestToken(
          {
            grant_type: 'refresh_token',
            refresh_token: auth.refreshToken,
            client_id: auth.clientId,
          },
          fetcher,
        );
        if (!result.ok) {
          // 400 invalid_grant: the refresh token is no longer valid. Anything else may pass.
          if (result.status === 400 || result.status === 401) {
            await disconnectSpotify();
            return { ok: false, reason: 'revoked' };
          }
          return { ok: false, reason: 'error', message: `Spotify sign-in failed: ${result.error}` };
        }
        const next: SpotifyAuth = {
          ...auth,
          accessToken: result.token.access_token,
          refreshToken: result.token.refresh_token ?? auth.refreshToken,
          expiresAt: now() + result.token.expires_in * 1000,
        };
        await saveAuth(next);
        return { ok: true, auth: next };
      } catch {
        return { ok: false, reason: 'error', message: 'Could not reach Spotify.' };
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  })();
}
