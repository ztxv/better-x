import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseClientId, updatePluginState, type PluginState } from '../plugins/state';
import {
  connectSpotify,
  disconnectSpotify,
  loadAuth,
  redirectUri,
  SpotifyConnectError,
} from '../spotify/auth';
import { parseAuth, SPOTIFY_AUTH_KEY, type SpotifyAuth } from '../spotify/types';

const DASHBOARD = 'https://developer.spotify.com/dashboard';

/** The connected account, from storage, kept up to date. Undefined until first read. */
function useSpotifyAuth(): SpotifyAuth | null | undefined {
  const [auth, setAuth] = useState<SpotifyAuth | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadAuth().then(
      (loaded) => live && setAuth(loaded),
      () => live && setAuth(null),
    );
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[SPOTIFY_AUTH_KEY])
        setAuth(parseAuth(changes[SPOTIFY_AUTH_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);
  return auth;
}

const productLabel = (product: string | undefined) =>
  product === 'premium' ? 'Premium' : product ? 'Free' : null;

/**
 * Spotify's settings: the three setup steps (make a Spotify app, add this extension's redirect
 * address to it, paste its Client ID), then Connect. Spotify gives third-party apps no shared
 * sign-in: each person registers their own app, and only its public Client ID is ever entered
 * here. There is no field for a client secret because none is used (Authorization Code + PKCE).
 */
export function SpotifySettings({ state }: { state: PluginState }) {
  const auth = useSpotifyAuth();
  const saved = state.spotify.clientId;
  const [clientId, setClientId] = useState(saved);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setClientId(saved), [saved]);

  let redirect = '';
  try {
    redirect = redirectUri();
  } catch {
    /* no identity API here */
  }
  const typed = clientId.trim();
  const parsed = parseClientId(typed);
  const invalid = typed !== '' && !parsed;
  const connected = !!auth && auth.clientId === saved;

  async function saveClientId(next: string) {
    if (next === saved) return;
    // Tokens belong to the app they were issued to: a different app means connecting again.
    if (auth) await disconnectSpotify();
    await updatePluginState((current) => ({ ...current, spotify: { clientId: next } }));
  }
  async function connect() {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveClientId(parsed);
      await connectSpotify(parsed);
    } catch (problem) {
      setError(
        problem instanceof SpotifyConnectError
          ? problem.message
          : 'Could not connect to Spotify. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(redirect);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the address can still be selected by hand */
    }
  }

  return (
    <div className="spotify-settings">
      <p className={`spotify-status ${connected ? 'is-on' : ''}`} role="status">
        <span className="themes-active-dot" aria-hidden="true" />
        {auth === undefined ? (
          'Checking…'
        ) : connected ? (
          <>
            Connected{auth.user ? ' as ' : ''}
            {auth.user && <strong>{auth.user.name}</strong>}
            {productLabel(auth.user?.product) && ` (${productLabel(auth.user?.product)})`}
          </>
        ) : (
          'Not connected'
        )}
      </p>
      {connected && (auth.controlsDenied || productLabel(auth.user?.product) === 'Free') && (
        <p className="setting-hint">
          This account has no Spotify Premium, so the player shows what is playing without play,
          skip or seek buttons: Spotify only lets Premium accounts be controlled by other apps.
        </p>
      )}

      <ol className="spotify-steps">
        <li>
          <a href={DASHBOARD} target="_blank" rel="noopener noreferrer">
            Open the Spotify developer dashboard <ExternalLink size={11} aria-hidden="true" />
          </a>{' '}
          and create an app (any name; tick <em>Web API</em>).
        </li>
        <li>
          In that app’s settings, add this exact Redirect URI:
          <span className="spotify-redirect">
            <code>{redirect || 'Unavailable in this browser'}</code>
            <button
              type="button"
              className="icon-button"
              aria-label="Copy redirect URI"
              title="Copy"
              disabled={!redirect}
              onClick={() => void copy()}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </span>
        </li>
        <li>
          Paste the app’s <strong>Client ID</strong> (not the secret; Better X never needs it):
          <input
            type="text"
            className="spotify-client-id"
            aria-label="Spotify Client ID"
            aria-invalid={invalid}
            spellCheck={false}
            autoComplete="off"
            placeholder="32 letters and digits"
            maxLength={40}
            value={clientId}
            disabled={busy}
            onChange={(event) => {
              setClientId(event.target.value);
              setError(null);
            }}
            onBlur={() => {
              if (parsed) void saveClientId(parsed);
            }}
          />
          {invalid && (
            <small className="spotify-error">
              A Client ID is 32 characters: digits and the letters a–f.
            </small>
          )}
        </li>
      </ol>

      <div className="theme-actions">
        {connected ? (
          <button type="button" className="text-button" onClick={() => void disconnectSpotify()}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="spotify-connect"
            disabled={!parsed || busy || !redirect}
            onClick={() => void connect()}
          >
            {busy ? 'Waiting for Spotify…' : 'Connect Spotify'}
          </button>
        )}
      </div>
      {error && (
        <p className="spotify-error" role="alert">
          {error}
        </p>
      )}
      <p className="setting-hint">
        Play, pause, skip, seek, shuffle and repeat need Spotify Premium; without it the player only
        shows what is playing. A new Spotify app is in development mode: it works for your own
        account and for accounts you add under its User Management. Your sign-in stays in this
        browser and is never sent to X.
      </p>
    </div>
  );
}
