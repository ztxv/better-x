import type { PlayerState, RepeatMode, SpotifyCommand } from '../../spotify/types';

/**
 * The Spotify player's element: a card in its own shadow root, so neither X's styles nor Better
 * X's reach in, and nothing here leaks out. It only draws what it is given and reports clicks;
 * `./index.ts` owns fetching and timing. Everything from Spotify is written as text (never as
 * markup), the cover must be a `data:image/` URL, and the track link must be on open.spotify.com.
 * A control Spotify does not allow right now is not drawn at all.
 *
 * Colors follow the Better X theme when one is painting X (`--bx-t-*` on <html>), and X's own
 * Default or Lights out otherwise (`data-theme` on the host).
 */
export type ViewState = PlayerState | { status: 'loading' };

export interface PlayerView {
  host: HTMLElement;
  render(state: ViewState): void;
  /** Moves the progress bar to where playback is at `now` (between polls). */
  tick(now: number): void;
  /** Shows a short message under the player for a moment (a command Spotify refused). */
  flash(message: string): void;
  setTheme(theme: 'light' | 'dark'): void;
  /** Whether the big cover view is open. */
  coverOpen(): boolean;
  /** Closes the big cover view, if open. Also part of switching the plugin off. */
  closeCover(): void;
}

export interface PlayerHandlers {
  onCommand(command: SpotifyCommand): void;
  onRetry(): void;
  onOpenPanel(): void;
  /** The full-size cover as a data URL, fetched by the worker; null when it cannot be had. */
  loadCover?(url: string): Promise<string | null>;
}

/**
 * Events that must not reach X from the player. X's menu around the player handles presses
 * itself (a press on the player opened the account switcher above it), and X's keyboard
 * shortcuts would act on keys meant for the player. Stopped on the way out of the player, after
 * its own controls have had them; nothing is prevented, so links and buttons work as usual.
 */
const CONTAINED = [
  'click',
  'dblclick',
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'keydown',
  'keyup',
  'keypress',
] as const;
export function containEvents(host: HTMLElement): void {
  for (const type of CONTAINED) host.addEventListener(type, (event) => event.stopPropagation());
}

const svg = (body: string, filled = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
/** Lucide icons (ISC), inlined so nothing loads from the network. */
const ICON = {
  play: svg('<polygon points="6 3 20 12 6 21 6 3"/>', true),
  pause: svg(
    '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    true,
  ),
  previous: svg(
    '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
    true,
  ),
  next: svg('<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>', true),
  shuffle: svg(
    '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  ),
  repeat: svg(
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  ),
  repeatOne: svg(
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>',
  ),
  music: svg(
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  ),
};

const CSS = `
:host {
  all: initial;
  display: block;
  container-type: inline-size;
  margin: 0 0 8px;
  font-family: inherit;
  --sp-bg: var(--bx-t-raised, #16181c);
  --sp-text: var(--bx-t-text, #e7e9ea);
  --sp-muted: var(--bx-t-muted, #8b98a5);
  --sp-border: var(--bx-t-border, #2f3336);
  --sp-accent: var(--bx-t-accent, #1d9bf0);
  --sp-hover: var(--bx-t-hover, rgba(231, 233, 234, 0.1));
  --sp-track: var(--bx-t-border, #3e4144);
}
:host([data-theme='light']) {
  --sp-bg: var(--bx-t-raised, #f7f9f9);
  --sp-text: var(--bx-t-text, #0f1419);
  --sp-muted: var(--bx-t-muted, #536471);
  --sp-border: var(--bx-t-border, #eff3f4);
  --sp-hover: var(--bx-t-hover, rgba(15, 20, 25, 0.1));
  --sp-track: var(--bx-t-border, #cfd9de);
}
* { box-sizing: border-box; }
.card {
  padding: 10px 12px;
  border: 1px solid var(--sp-border);
  border-radius: 12px;
  background: var(--sp-bg);
  color: var(--sp-text);
  font: 400 12px/1.35 TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  text-align: left;
}
[hidden] { display: none !important; }
.now { display: flex; align-items: center; gap: 10px; min-width: 0; }
.art {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--sp-track);
  color: var(--sp-muted);
}
.art img { display: block; width: 100%; height: 100%; object-fit: cover; }
.art[role='button'] { cursor: zoom-in; }
.art[role='button']:hover img { opacity: 0.85; }
.art[role='button']:focus-visible { outline: 2px solid var(--sp-accent); outline-offset: 2px; }
.art svg { width: 20px; height: 20px; }
.meta { flex: 1; min-width: 0; }
.meta > * { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.title { color: var(--sp-text); font-weight: 700; font-size: 13px; text-decoration: none; }
a.title:hover { text-decoration: underline; }
.artists, .album { color: var(--sp-muted); }
.progress {
  position: relative;
  height: 14px;
  margin-top: 8px;
  border-radius: 7px;
  outline: none;
}
.progress[role='slider'] { cursor: pointer; }
.bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 5px;
  height: 4px;
  border-radius: 2px;
  background: var(--sp-track);
}
.fill { width: 0; height: 100%; border-radius: 2px; background: var(--sp-accent); }
.knob {
  position: absolute;
  top: 2px;
  left: 0;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--sp-text);
  box-shadow: 0 0 0 1px var(--sp-bg);
}
.progress:not([role='slider']) .knob { display: none; }
.progress:focus-visible { box-shadow: 0 0 0 2px var(--sp-accent); }
.times {
  display: flex;
  justify-content: space-between;
  color: var(--sp-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.controls { display: flex; align-items: center; justify-content: space-around; margin-top: 4px; }
button {
  all: unset;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--sp-text);
}
.controls button { width: 30px; height: 30px; border-radius: 50%; transition: background-color 120ms ease; }
.controls button:hover { background: var(--sp-hover); }
.controls button:focus-visible, .action:focus-visible { box-shadow: 0 0 0 2px var(--sp-accent); }
.controls svg { width: 16px; height: 16px; }
.controls .toggle svg { width: 18px; height: 18px; }
.controls button[aria-pressed='true'] { color: var(--sp-accent); }
.controls button[aria-busy='true'] { opacity: 0.55; }
.note { margin-top: 6px; color: var(--sp-muted); font-size: 11px; }
.message { display: flex; flex-direction: column; gap: 4px; }
.message strong { font-size: 13px; }
.message span { color: var(--sp-muted); }
.action {
  align-self: flex-start;
  margin-top: 4px;
  padding: 4px 12px;
  border: 1px solid var(--sp-border);
  border-radius: 999px;
  font-weight: 700;
}
.action:hover { background: var(--sp-hover); }
.skeleton .art, .skeleton .line { animation: pulse 1.2s ease-in-out infinite alternate; }
.line { height: 9px; margin: 4px 0; border-radius: 4px; background: var(--sp-track); }
.line.short { width: 55%; }
@keyframes pulse { from { opacity: 0.45; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .skeleton .art, .skeleton .line { animation: none; }
  .controls button { transition: none; }
}
/* X's collapsed (icons-only) menu: just the cover and play/pause. */
@container (max-width: 170px) {
  .card { padding: 6px; }
  .now { justify-content: center; }
  .meta, .progress, .times, .note, .controls button:not(.toggle), .message span, .line { display: none; }
  .message { align-items: center; }
  .message strong { font-size: 10px; }
  .action { align-self: center; padding: 2px 6px; font-size: 10px; }
  .controls { margin-top: 2px; }
}
`;

/** The big cover view: its own element on <body>, over the page, styled like the card. */
const COVER_CSS = `
:host {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  margin: 0;
  container-type: normal;
}
.scrim {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.72);
  animation: fade 140ms ease-out;
}
.big {
  position: relative;
  width: min(440px, 92vw, calc(100vh - 230px));
  min-width: 240px;
  padding: 14px;
  border: 1px solid var(--sp-border);
  border-radius: 16px;
  background: var(--sp-bg);
  color: var(--sp-text);
  font: 400 12px/1.35 TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  animation: rise 160ms ease-out;
}
.cover {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
  background: var(--sp-track);
}
.caption { margin-top: 10px; min-width: 0; }
.caption > * { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.caption strong { font-size: 15px; }
.caption span { color: var(--sp-muted); }
.big .controls button { width: 36px; height: 36px; }
.big .controls svg { width: 18px; height: 18px; }
.big .controls .toggle svg { width: 22px; height: 22px; }
.close {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}
.close:hover { background: rgba(0, 0, 0, 0.75); }
.close:focus-visible { box-shadow: 0 0 0 2px var(--sp-accent); }
.close svg { width: 16px; height: 16px; }
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { opacity: 0; transform: scale(0.96); } }
@media (prefers-reduced-motion: reduce) {
  .scrim, .big { animation: none; }
}
`;
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = {
  off: 'context',
  context: 'track',
  track: 'off',
};
const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: 'Repeat: off',
  context: 'Repeat: all',
  track: 'Repeat: one track',
};
const SEEK_STEP_MS = 5000;

export function createPlayerView(handlers: PlayerHandlers, doc: Document = document): PlayerView {
  const host = doc.createElement('bx-spotify-player');
  host.setAttribute('data-theme', 'dark');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  const card = doc.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'Spotify player');
  shadow.append(style, card);

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  /** A button whose icon is one of the constants above (never anything from Spotify). */
  const iconButton = (className: string, onClick: () => void) => {
    const button = make('button', className);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  };
  const setIcon = (button: HTMLElement, icon: string, label: string) => {
    if (button.dataset.icon !== label) {
      button.innerHTML = icon;
      button.dataset.icon = label;
    }
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  // The playing layout, built once and updated in place.
  const playing = make('div');
  const art = make('div', 'art');
  const title = make('a', 'title');
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  const artists = make('span', 'artists');
  const album = make('span', 'album');
  const meta = make('div', 'meta');
  meta.append(title, artists, album);
  const now = make('div', 'now');
  now.append(art, meta);
  containEvents(host);
  const progress = make('div', 'progress');
  const fill = make('div', 'fill');
  const bar = make('div', 'bar');
  bar.append(fill);
  const knob = make('div', 'knob');
  progress.append(bar, knob);
  const elapsed = make('span');
  const duration = make('span');
  const times = make('div', 'times');
  times.append(elapsed, duration);
  const controls = make('div', 'controls');
  const note = make('div', 'note');
  note.setAttribute('role', 'status');
  playing.append(now, progress, times, controls, note);

  let current: Extract<PlayerState, { status: 'playing' }> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let flashed = '';

  const shuffle = iconButton('shuffle', () => {
    if (current) handlers.onCommand({ action: 'shuffle', on: !current.shuffle });
  });
  const previous = iconButton('previous', () => handlers.onCommand({ action: 'previous' }));
  const toggle = iconButton('toggle', () => {
    if (current) handlers.onCommand({ action: current.isPlaying ? 'pause' : 'play' });
  });
  const next = iconButton('next', () => handlers.onCommand({ action: 'next' }));
  const repeat = iconButton('repeat', () => {
    if (current) handlers.onCommand({ action: 'repeat', mode: NEXT_REPEAT[current.repeat] });
  });
  setIcon(previous, ICON.previous, 'Previous');
  setIcon(next, ICON.next, 'Next');
  controls.append(shuffle, previous, toggle, next, repeat);

  const positionAt = (time: number) => {
    if (!current) return 0;
    const moved = current.isPlaying ? time - current.at : 0;
    const position = current.progressMs + Math.max(0, moved);
    return current.track.durationMs ? Math.min(position, current.track.durationMs) : position;
  };
  const seekTo = (positionMs: number) => {
    if (!current?.controls.seek) return;
    const clamped = Math.max(0, Math.min(positionMs, current.track.durationMs));
    handlers.onCommand({ action: 'seek', positionMs: Math.round(clamped) });
  };
  progress.addEventListener('click', (event) => {
    if (!current?.controls.seek) return;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekTo(((event.clientX - rect.left) / rect.width) * current.track.durationMs);
  });
  progress.addEventListener('keydown', (event) => {
    if (!current?.controls.seek) return;
    const step =
      event.key === 'ArrowRight' ? SEEK_STEP_MS : event.key === 'ArrowLeft' ? -SEEK_STEP_MS : 0;
    if (!step) return;
    event.preventDefault();
    seekTo(positionAt(Date.now()) + step);
  });

  // ---- The big cover view (like Vencord's): click the cover to see it large, with the same
  // live progress bar and controls under it. Those elements are moved into the view while it is
  // open and put back when it closes, so there is one set of controls and nothing to keep in step.
  let cover: {
    host: HTMLElement;
    image: HTMLImageElement;
    heading: HTMLElement;
    sub: HTMLElement;
    shownArt: string | null;
    onKey: (event: KeyboardEvent) => void;
  } | null = null;

  const coverLabel = 'Show the cover larger';
  art.addEventListener('click', () => openCover());
  art.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openCover();
  });

  /** Shows the current cover in the view: the small one at once, the full-size one when it arrives. */
  function showCoverImage() {
    if (!cover || !current) return;
    const track = current.track;
    if (cover.shownArt === (track.artLarge ?? track.art)) return;
    cover.shownArt = track.artLarge ?? track.art;
    if (track.art?.startsWith('data:image/')) cover.image.src = track.art;
    cover.heading.textContent = track.title;
    cover.sub.textContent = [track.artists, track.album !== track.title ? track.album : '']
      .filter(Boolean)
      .join(' · ');
    const wanted = track.artLarge;
    if (wanted && handlers.loadCover)
      void handlers.loadCover(wanted).then((data) => {
        // Only if the view is still open on that same track.
        if (cover && current?.track.artLarge === wanted && data?.startsWith('data:image/'))
          cover.image.src = data;
      });
  }

  function openCover() {
    if (cover || !current?.track.art) return;
    const coverHost = doc.createElement('bx-spotify-cover');
    coverHost.setAttribute('data-theme', host.getAttribute('data-theme') ?? 'dark');
    const coverShadow = coverHost.attachShadow({ mode: 'open' });
    const coverStyle = doc.createElement('style');
    coverStyle.textContent = CSS + COVER_CSS;
    const scrim = make('div', 'scrim');
    const big = make('div', 'big');
    big.setAttribute('role', 'dialog');
    big.setAttribute('aria-modal', 'true');
    big.setAttribute('aria-label', 'Spotify cover');
    const image = doc.createElement('img');
    image.className = 'cover';
    image.alt = '';
    const close = make('button', 'close');
    close.type = 'button';
    close.innerHTML = CLOSE_ICON;
    close.setAttribute('aria-label', 'Close');
    close.title = 'Close';
    close.addEventListener('click', () => closeCover());
    const heading = make('strong');
    const sub = make('span');
    const caption = make('div', 'caption');
    caption.append(heading, sub);
    big.append(image, close, caption, progress, times, controls);
    scrim.append(big);
    coverShadow.append(coverStyle, scrim);
    scrim.addEventListener('click', (event) => {
      if (event.target === scrim) closeCover();
    });
    containEvents(coverHost);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeCover();
    };
    doc.addEventListener('keydown', onKey, true);
    cover = { host: coverHost, image, heading, sub, shownArt: null, onKey };
    (doc.body ?? doc.documentElement).append(coverHost);
    showCoverImage();
    tick(Date.now());
    close.focus();
  }

  function closeCover() {
    if (!cover) return;
    doc.removeEventListener('keydown', cover.onKey, true);
    cover.host.remove();
    cover = null;
    // The controls go back to the card, in their place above the note.
    playing.insertBefore(progress, note);
    playing.insertBefore(times, note);
    playing.insertBefore(controls, note);
    if (art.isConnected) art.focus();
  }

  function tick(time: number) {
    if (!current) return;
    const position = positionAt(time);
    const total = current.track.durationMs;
    const ratio = total > 0 ? Math.min(1, position / total) : 0;
    fill.style.width = `${(ratio * 100).toFixed(2)}%`;
    knob.style.left = `${(ratio * 100).toFixed(2)}%`;
    const label = formatTime(position);
    if (elapsed.textContent !== label) elapsed.textContent = label;
    if (current.controls.seek) {
      progress.setAttribute('aria-valuenow', String(Math.round(position / 1000)));
      progress.setAttribute('aria-valuetext', `${label} of ${formatTime(total)}`);
    }
  }

  function showNote() {
    const text = flashed || current?.note || '';
    note.textContent = text;
    note.hidden = !text;
  }

  function renderPlaying(state: Extract<PlayerState, { status: 'playing' }>) {
    const before = current?.track;
    current = state;
    const { track, controls: can } = state;
    if (!playing.isConnected) card.replaceChildren(playing);

    if (before?.art !== track.art || !art.firstChild) {
      if (track.art?.startsWith('data:image/')) {
        const image = doc.createElement('img');
        image.alt = '';
        image.src = track.art;
        art.replaceChildren(image);
      } else art.innerHTML = ICON.music;
    }
    title.textContent = track.title;
    title.title = track.title;
    if (track.url?.startsWith('https://open.spotify.com/')) title.href = track.url;
    else title.removeAttribute('href');
    artists.textContent = track.artists;
    artists.title = track.artists;
    artists.hidden = !track.artists;
    album.textContent = track.album;
    album.title = track.album;
    album.hidden = !track.album || track.album === track.title;
    art.title = [track.title, track.artists].filter(Boolean).join(' — ');
    if (track.art?.startsWith('data:image/')) {
      art.setAttribute('role', 'button');
      art.tabIndex = 0;
      art.setAttribute('aria-label', coverLabel);
      art.title = `${art.title} (click to enlarge)`;
    } else {
      art.removeAttribute('role');
      art.removeAttribute('tabindex');
      art.removeAttribute('aria-label');
    }
    showCoverImage();

    const timed = track.durationMs > 0;
    progress.hidden = times.hidden = !timed;
    duration.textContent = formatTime(track.durationMs);
    if (can.seek) {
      progress.setAttribute('role', 'slider');
      progress.tabIndex = 0;
      progress.setAttribute('aria-label', 'Seek');
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', String(Math.round(track.durationMs / 1000)));
    } else {
      progress.setAttribute('role', 'progressbar');
      progress.removeAttribute('tabindex');
      progress.setAttribute('aria-label', 'Playback position');
    }

    shuffle.hidden = !can.shuffle;
    previous.hidden = !can.previous;
    toggle.hidden = !can.toggle;
    next.hidden = !can.next;
    repeat.hidden = !can.repeat;
    controls.hidden = !Object.values(can).some(Boolean);
    setIcon(toggle, state.isPlaying ? ICON.pause : ICON.play, state.isPlaying ? 'Pause' : 'Play');
    setIcon(shuffle, ICON.shuffle, state.shuffle ? 'Shuffle: on' : 'Shuffle: off');
    shuffle.setAttribute('aria-pressed', String(state.shuffle));
    setIcon(
      repeat,
      state.repeat === 'track' ? ICON.repeatOne : ICON.repeat,
      REPEAT_LABEL[state.repeat],
    );
    repeat.setAttribute('aria-pressed', String(state.repeat !== 'off'));
    showNote();
    tick(Date.now());
  }

  function renderMessage(
    heading: string,
    text: string,
    action?: { label: string; run: () => void },
  ) {
    current = null;
    const box = make('div', 'message');
    box.append(make('strong', '', heading), make('span', '', text));
    if (action) {
      const button = make('button', 'action', action.label);
      button.type = 'button';
      button.addEventListener('click', action.run);
      box.append(button);
    }
    card.replaceChildren(box);
  }

  function render(state: ViewState) {
    card.dataset.status = state.status;
    // Nothing playing any more: the big view has nothing to show.
    if (state.status !== 'playing') closeCover();
    switch (state.status) {
      case 'playing':
        return renderPlaying(state);
      case 'loading': {
        current = null;
        const box = make('div', 'skeleton');
        const row = make('div', 'now');
        const lines = make('div', 'meta');
        lines.append(make('div', 'line'), make('div', 'line short'));
        row.append(make('div', 'art'), lines);
        box.append(row);
        box.setAttribute('aria-label', 'Loading Spotify');
        return card.replaceChildren(box);
      }
      case 'setup':
        return renderMessage(
          'Spotify',
          'Finish setup in Better X → Plugins to show what is playing.',
          {
            label: 'Set up',
            run: handlers.onOpenPanel,
          },
        );
      case 'disconnected':
        return renderMessage(
          'Spotify',
          'Not connected. Connect your account in Better X → Plugins.',
          {
            label: 'Connect',
            run: handlers.onOpenPanel,
          },
        );
      case 'idle':
        return renderMessage('Spotify', 'Nothing is playing. Start something in a Spotify app.');
      case 'error':
        return renderMessage('Spotify', state.message, { label: 'Retry', run: handlers.onRetry });
    }
  }

  return {
    host,
    render,
    tick,
    flash(message) {
      flashed = message;
      showNote();
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashed = '';
        showNote();
      }, 4000);
    },
    setTheme(theme) {
      if (host.getAttribute('data-theme') !== theme) host.setAttribute('data-theme', theme);
      cover?.host.setAttribute('data-theme', theme);
    },
    coverOpen: () => cover !== null,
    closeCover,
  };
}
