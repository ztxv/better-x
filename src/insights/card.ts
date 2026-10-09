import { anchorVisible, el, xTheme } from '../content/popover';
import type { Scope } from '../runtime/scope';
import type { AccountService } from './accounts';
import type { Entry } from './accounts-store';
import { ACCOUNT_ICONS, type AccountIcon } from './icons';
import { connectionLabel, joinedLabel, placeLabel, WARNING_TITLE } from './model';
import { flagOf } from './places';
import type { AccountInfo } from '../x/about-account';

const MARGIN = 8;
const GAP = 6;
/** How long a pointer must rest on a badge before its card opens, and how long it may stray. */
const OPEN_DELAY = 350;
const CLOSE_DELAY = 220;

export interface AccountCard {
  /** Opens (or, for the same badge, closes) the card as a pinned dialog: click or keyboard. */
  toggle(anchor: HTMLElement, handle: string): void;
  /** A pointer rests on a badge: opens the card after a short delay, unless already open. */
  hoverIn(anchor: HTMLElement, handle: string): void;
  /** The pointer left a badge: closes an unpinned card after a short grace. */
  hoverOut(): void;
  close(restoreFocus?: boolean): void;
  readonly open: boolean;
}

function row(icon: AccountIcon, label: string, value: string | Node): HTMLElement {
  const item = el('div', 'bx-acct-row');
  const term = el('dt', 'bx-acct-term');
  term.insertAdjacentHTML('afterbegin', ACCOUNT_ICONS[icon]);
  term.append(el('span', '', label));
  const detail = el('dd', 'bx-acct-detail');
  detail.append(value);
  item.append(term, detail);
  return item;
}

function ago(at: number): string {
  const seconds = Math.max(0, (Date.now() - at) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (seconds < 90) return 'just now';
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86_400), 'day');
}

function verificationText(info: AccountInfo): string | null {
  const v = info.verification;
  if (!v) return null;
  const parts: string[] = [];
  if (v.type === 'government') parts.push('Government account');
  else if (v.type === 'business') parts.push('Verified organization');
  if (v.blue) parts.push('Premium verification');
  if (!parts.length) return null;
  if (v.since) {
    const date = new Date(v.since);
    if (!Number.isNaN(date.getTime()))
      parts[parts.length - 1] +=
        ` since ${new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date)}`;
  }
  return parts.join(' · ');
}

/** The card's rows: only what X reported. A fact that is not known has no row. */
export function cardRows(info: AccountInfo): HTMLElement[] {
  const rows: HTMLElement[] = [];
  if (info.basedIn) {
    const value = el('span', 'bx-acct-value');
    const glyph = flagOf(info.basedIn);
    if (glyph) value.append(el('span', 'bx-acct-flag', glyph, { 'aria-hidden': 'true' }));
    value.append(placeLabel(info.basedIn));
    rows.push(row('mapPin', 'Based in', value));
  }
  if (info.connection) {
    const text = el('span', 'bx-acct-value');
    const icon =
      info.connection.platform === 'ios'
        ? 'apple'
        : info.connection.platform === 'android'
          ? 'android'
          : null;
    if (icon) text.insertAdjacentHTML('afterbegin', ACCOUNT_ICONS[icon]);
    text.append(
      connectionLabel(info.connection) +
        (info.connection.storeCountry ? ` · ${info.connection.storeCountry} store` : ''),
    );
    rows.push(row('globe', 'Connected via', text));
  }
  if (info.locationAccurate === false)
    rows.push(row('alert', 'Location accuracy', 'X reports possible uncertainty'));
  const joined = joinedLabel(info);
  if (joined) rows.push(row('info', 'Joined', joined));
  if (info.usernameChanges !== undefined)
    rows.push(row('info', 'Username changes', String(info.usernameChanges)));
  if (info.affiliate) rows.push(row('shield', 'Affiliation', info.affiliate.name));
  const verified = verificationText(info);
  if (verified) rows.push(row('shield', 'Verification', verified));
  return rows;
}

/**
 * The account details card: one element for the whole page, shown beside a badge. It lives in
 * `document.body`, outside X's markup, so X re-rendering a post never moves or removes it
 * (only a badge that no longer belongs to the same account closes it).
 */
export function createAccountCard(scope: Scope, service: AccountService): AccountCard {
  let node: HTMLElement | undefined;
  let anchor: HTMLElement | undefined;
  let handle = '';
  let pinned = false;
  let openTimer: (() => void) | undefined;
  let closeTimer: (() => void) | undefined;
  let removeListeners: Array<() => void> = [];
  let refreshing = false;
  let frame = 0;

  const isOpen = () => Boolean(node);

  function build() {
    if (!node || !anchor) return;
    const entry: Entry | undefined = service.peek(handle);
    const card = node;
    const info = entry?.state === 'ok' ? entry.info : undefined;

    const head = el('header', 'bx-acct-head');
    const title = el('div', 'bx-acct-title');
    title.append(el('strong', '', info?.displayName ?? `@${handle}`));
    if (info?.displayName) title.append(el('span', 'bx-acct-handle', `@${handle}`));
    const close = el('button', 'bx-acct-close', '', {
      type: 'button',
      'aria-label': 'Close account details',
    });
    close.insertAdjacentHTML('afterbegin', ACCOUNT_ICONS.close);
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      api.close(true);
    });
    head.append(title, close);

    const body = el('div', 'bx-acct-body');
    if (info) {
      const rows = cardRows(info);
      if (rows.length) {
        const list = el('dl', 'bx-acct-rows');
        list.append(...rows);
        body.append(list);
      } else
        body.append(el('p', 'bx-acct-empty', 'X did not report anything more for this account.'));
      const notes: string[] = [];
      if (info.basedIn)
        notes.push(
          'Based in is X’s estimate from account activity. It is not nationality, birthplace or where a post was written.',
        );
      if (info.connection)
        notes.push('Connected via is the account’s platform, not the app used for any one post.');
      if (info.locationAccurate === false) notes.push(WARNING_TITLE);
      for (const note of notes) body.append(el('p', 'bx-acct-note', note));
    } else if (entry?.state === 'failed') {
      body.append(el('p', 'bx-acct-empty', 'Could not load this account. Try refreshing.'));
    } else if (entry?.state === 'missing') {
      body.append(el('p', 'bx-acct-empty', 'X reports this account as unavailable.'));
    } else {
      body.append(el('p', 'bx-acct-empty', 'Looking up this account…'));
    }

    const foot = el('footer', 'bx-acct-foot');
    foot.append(
      el(
        'span',
        'bx-acct-updated',
        entry && entry.state !== 'failed' ? `Updated ${ago(entry.at)}` : 'Not updated yet',
      ),
    );
    const refresh = el('button', 'bx-acct-refresh', '', { type: 'button' });
    refresh.insertAdjacentHTML('afterbegin', ACCOUNT_ICONS.refresh);
    refresh.append(el('span', '', refreshing ? 'Refreshing…' : 'Refresh'));
    refresh.disabled = refreshing;
    refresh.addEventListener('click', (event) => {
      event.stopPropagation();
      refreshing = true;
      build();
      void service.request(handle, { priority: 'manual', force: true }).finally(() => {
        refreshing = false;
        if (isOpen()) build();
      });
    });
    foot.append(refresh);

    const hadFocus = card.contains(document.activeElement);
    const focusedRefresh = hadFocus && document.activeElement?.className === 'bx-acct-refresh';
    card.replaceChildren(head, body, foot);
    card.setAttribute('aria-label', `Account details for @${handle}`);
    if (focusedRefresh) refresh.focus({ preventScroll: true });
    reposition();
  }

  function position() {
    if (!node || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    const fitsBelow = below + height <= innerHeight - MARGIN;
    const top = Math.max(
      MARGIN,
      Math.min(fitsBelow || above < MARGIN ? below : above, innerHeight - MARGIN - height),
    );
    const left = Math.max(MARGIN, Math.min(rect.left, innerWidth - MARGIN - width));
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
    node.dataset.side = top >= rect.bottom ? 'below' : 'above';
  }

  function reposition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!node || !anchor) return;
      if (!anchorVisible(anchor) || anchor.dataset.bxAcct !== handle) return api.close();
      position();
    });
  }

  function show(target: HTMLElement, forHandle: string, pin: boolean) {
    closeTimer?.();
    openTimer?.();
    if (node && anchor === target && handle === forHandle) {
      pinned ||= pin;
      return;
    }
    api.close();
    anchor = target;
    handle = forHandle;
    pinned = pin;
    node = el('div', 'bx-acctcard', '', { role: 'dialog' });
    node.dataset.theme = xTheme();
    node.id = 'bx-acctcard';
    document.body.append(node);
    target.setAttribute('aria-expanded', 'true');
    target.setAttribute('aria-controls', node.id);
    build();
    position();

    const card = node;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      api.close(card.contains(document.activeElement) || document.activeElement === target);
    };
    const onPointer = (event: PointerEvent) => {
      const at = event.target as Node;
      if (!card.contains(at) && !target.contains(at)) api.close();
    };
    const onEnter = () => {
      closeTimer?.();
    };
    const onLeave = () => {
      if (!pinned) api.hoverOut();
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (pinned && next && !card.contains(next) && next !== target) api.close();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    addEventListener('scroll', reposition, { capture: true, passive: true });
    addEventListener('resize', reposition, { passive: true });
    card.addEventListener('pointerenter', onEnter);
    card.addEventListener('pointerleave', onLeave);
    card.addEventListener('focusout', onFocusOut);
    removeListeners = [
      () => document.removeEventListener('keydown', onKey, true),
      () => document.removeEventListener('pointerdown', onPointer, true),
      () => removeEventListener('scroll', reposition, { capture: true }),
      () => removeEventListener('resize', reposition),
    ];
  }

  // New answers for the open account (a refresh, or another tab) redraw the card in place.
  scope.add(
    service.subscribe((changed) => {
      if (isOpen() && (changed.has(handle) || changed.has('*'))) build();
    }),
  );
  scope.add(() => api.close());

  const api: AccountCard = {
    get open() {
      return isOpen();
    },

    toggle(target, forHandle) {
      if (node && anchor === target && handle === forHandle && pinned) return api.close(true);
      show(target, forHandle, true);
      node?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    },

    hoverIn(target, forHandle) {
      closeTimer?.();
      if (node && anchor === target) return;
      if (node && pinned) return; // a pinned card is not replaced by a pointer passing over another badge
      openTimer?.();
      openTimer = scope.setTimeout(() => show(target, forHandle, false), OPEN_DELAY);
    },

    hoverOut() {
      openTimer?.();
      openTimer = undefined;
      if (!node || pinned) return;
      closeTimer?.();
      closeTimer = scope.setTimeout(() => api.close(), CLOSE_DELAY);
    },

    close(restoreFocus = false) {
      openTimer?.();
      closeTimer?.();
      cancelAnimationFrame(frame);
      if (!node) return;
      const card = node;
      const target = anchor;
      node = undefined;
      anchor = undefined;
      pinned = false;
      refreshing = false;
      removeListeners.forEach((stop) => stop());
      removeListeners = [];
      card.remove();
      target?.removeAttribute('aria-expanded');
      target?.removeAttribute('aria-controls');
      if (restoreFocus && target?.isConnected) target.focus({ preventScroll: true });
    },
  };
  return api;
}
