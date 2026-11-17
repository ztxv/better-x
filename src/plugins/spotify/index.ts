import { xTheme } from '../../content/popover';
import { request } from '../../lib/api';
import { observe } from '../../runtime/observe';
import type { Scope } from '../../runtime/scope';
import { waitFor } from '../../runtime/wait';
import { SPOTIFY_AUTH_KEY, type PlayerState, type SpotifyCommand } from '../../spotify/types';
import { SPOTIFY_PLUGIN_ID } from '../catalog';
import type { ContentPlugin } from '../host';
import { PLUGINS_KEY } from '../state';
import { createPlayerView } from './view';

/** X's left menu, and the account switcher at its foot that the player sits above. */
const MENU = 'header[role="banner"]';
const ACCOUNT = '[data-testid="SideNav_AccountSwitcher_Button"]';

/** How often to ask Spotify while this tab is visible. Hidden tabs do not ask at all. */
const POLL_PLAYING_MS = 5000;
const POLL_PAUSED_MS = 10_000;
const POLL_OTHER_MS = 20_000;
/** Look again just after a track should have ended. */
const AFTER_END_MS = 700;

type Playing = Extract<PlayerState, { status: 'playing' }>;

/** What a command will most likely do, shown at once; Spotify's answer replaces it. */
function predict(state: Playing, command: SpotifyCommand, now: number): Playing {
  const position = state.progressMs + (state.isPlaying ? Math.max(0, now - state.at) : 0);
  switch (command.action) {
    case 'play':
      return { ...state, isPlaying: true, at: now };
    case 'pause':
      return { ...state, isPlaying: false, progressMs: position, at: now };
    case 'seek':
      return { ...state, progressMs: command.positionMs, at: now };
    case 'shuffle':
      return { ...state, shuffle: command.on };
    case 'repeat':
      return { ...state, repeat: command.mode };
    default:
      return state;
  }
}

/**
 * The Spotify player in X's left menu, above the account switcher.
 *
 * It asks the background worker what is playing (the worker holds the tokens and talks to
 * Spotify; this page never sees them) every few seconds while the tab is visible, moves the
 * progress bar itself in between, and sends playback commands the same way. Everything it
 * creates (the element, timers, listeners, one managed observer on X's menu) is on the plugin's
 * scope, so switching the plugin off removes it all at once. X re-renders its menu now and then;
 * the player puts itself back whenever it finds it is no longer above the account switcher.
 */
function startSpotify(
  scope: Scope,
  openPanel: () => void,
  onRoute: (fn: () => void) => () => void,
) {
  let state: PlayerState | null = null;
  /** Every request takes the next number; an answer to an older one is out of date and dropped. */
  let latest = 0;
  /** A command is on its way. Polls wait for it rather than racing it. */
  let commanding = false;
  /** Something asked for a fresh look while a command was on its way. */
  let again = false;
  let cancelPoll: (() => void) | null = null;
  let ticking: ReturnType<typeof setInterval> | undefined;
  let watched: Element | null = null;
  let watching: Scope | null = null;

  const view = createPlayerView({
    onCommand: (command) => void send(command),
    onRetry: () => void refresh(true),
    onOpenPanel: openPanel,
  });
  view.render({ status: 'loading' });
  scope.add(() => {
    clearInterval(ticking);
    view.host.remove();
  });

  /** Keeps the player directly above X's account switcher, and watches the menu it is in. */
  function mount() {
    if (scope.disposed) return;
    const menu = document.querySelector(MENU);
    const anchor = menu?.querySelector<HTMLElement>(ACCOUNT);
    if (menu !== watched) {
      watching?.dispose();
      watching = null;
      watched = menu;
      if (menu) {
        watching = scope.child();
        // The menu changes rarely (a badge, a re-render); the timeline is not inside it.
        observe(watching, menu, { childList: true, subtree: true }, mount);
      }
    }
    if (!anchor?.parentElement) {
      // Signed out, or a layout without the menu: nowhere to be.
      if (view.host.isConnected) view.host.remove();
      return;
    }
    if (view.host.parentElement !== anchor.parentElement || view.host.nextElementSibling !== anchor)
      anchor.before(view.host);
    view.setTheme(xTheme());
  }

  function show(next: PlayerState) {
    state = next;
    view.render(next);
    const moving = next.status === 'playing' && next.isPlaying;
    if (moving && !ticking) ticking = setInterval(() => view.tick(Date.now()), 500);
    else if (!moving && ticking) {
      clearInterval(ticking);
      ticking = undefined;
    }
  }

  function schedule() {
    cancelPoll?.();
    cancelPoll = null;
    if (scope.disposed || document.hidden || !state) return;
    let wait = POLL_OTHER_MS;
    if (state.status === 'playing') {
      wait = state.isPlaying ? POLL_PLAYING_MS : POLL_PAUSED_MS;
      if (state.isPlaying && state.track.durationMs > 0) {
        const left = state.track.durationMs - state.progressMs - (Date.now() - state.at);
        if (left > 0) wait = Math.min(wait, left + AFTER_END_MS);
      }
    } else if (state.status === 'error' && state.retryInMs)
      wait = Math.max(wait, state.retryInMs + 500);
    cancelPoll = scope.setTimeout(() => void refresh(), wait);
  }

  async function ask(message: Parameters<typeof request>[0]): Promise<PlayerState | null> {
    try {
      return await request<PlayerState>(message);
    } catch {
      // The extension was reloaded or updated under this tab: this copy can no longer reach it.
      if (!scope.alive()) return null;
      return { status: 'error', message: 'Better X could not be reached. Reload this tab.' };
    }
  }

  /**
   * Asks what is playing. A newer call supersedes one still on its way (connecting in the Plugins
   * tab while a poll is out must show the new account, not the poll's old answer); during a
   * command it waits and runs once the command's answer is in.
   */
  async function refresh(showLoading = false) {
    if (scope.disposed) return;
    if (commanding) {
      again = true;
      return;
    }
    const mine = ++latest;
    cancelPoll?.();
    cancelPoll = null;
    mount();
    if (showLoading) view.render({ status: 'loading' });
    const next = await ask({ type: 'spotifyState' });
    if (!next || scope.disposed || mine !== latest) return;
    show(next);
    schedule();
  }

  async function send(command: SpotifyCommand) {
    if (commanding || scope.disposed || state?.status !== 'playing') return;
    commanding = true;
    again = false;
    // Any poll still out is older than this command: its answer would undo the button press.
    const mine = ++latest;
    cancelPoll?.();
    cancelPoll = null;
    const before = state;
    show(predict(before, command, Date.now()));
    const next = await ask({ type: 'spotifyCommand', command });
    commanding = false;
    if (!next || scope.disposed || mine !== latest) return;
    if (again) {
      // The account or the Client ID changed meanwhile: what Spotify said about the command
      // may be about the old one. Look again instead.
      again = false;
      void refresh();
      return;
    }
    if (next.status === 'error') {
      // Spotify refused (no active device, a restriction): say so, and show what is true.
      show(before);
      view.flash(next.message);
      cancelPoll = scope.setTimeout(() => void refresh(), 1500);
      return;
    }
    show(next);
    schedule();
  }

  scope.listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      cancelPoll?.();
      cancelPoll = null;
    } else void refresh();
  });
  // Connecting, disconnecting or a new Client ID in the Plugins tab shows here at once.
  const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && (changes[SPOTIFY_AUTH_KEY] || changes[PLUGINS_KEY])) void refresh();
  };
  chrome.storage.onChanged.addListener(onStorage);
  scope.add(() => chrome.storage.onChanged.removeListener(onStorage));
  scope.add(onRoute(mount));

  mount();
  // X may not have drawn its menu yet when the content script starts.
  waitFor(`${MENU} ${ACCOUNT}`, { signal: scope.signal }).then(mount, () => {});
  void refresh();
}

export const spotifyPlugin: ContentPlugin = {
  id: SPOTIFY_PLUGIN_ID,
  start({ scope, runtime, openPanel }) {
    startSpotify(scope, openPanel, (fn) => {
      const stopRoute = runtime.routes.onRoute(fn);
      const stopLayout = runtime.layout.onLayout(fn);
      return () => {
        stopRoute();
        stopLayout();
      };
    });
  },
};
