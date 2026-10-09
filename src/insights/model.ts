import type { Entry } from './accounts-store';
import { flagOf, type Place } from './places';
import type { AccountInfo, Connection, ConnectionPlatform } from '../x/about-account';

/** The four things Account insights can show; each is its own setting. */
export type BadgePart = 'flags' | 'connection' | 'details' | 'warnings';

/** "Connected via" in words. This is the account's platform, never the client of a single post. */
export function connectionLabel(connection: Connection): string {
  switch (connection.platform) {
    case 'ios':
      return 'Apple App Store';
    case 'android':
      return 'Android app';
    case 'web':
      return 'Web';
    default:
      return connection.raw;
  }
}

/** "Based in" in words. */
export const placeLabel = (place: Place) => place.name;

export type ItemKind = 'flag' | 'region' | 'connection' | 'warning';

export interface BadgeItem {
  kind: ItemKind;
  /** A flag glyph, for a country. */
  glyph?: string;
  platform?: ConnectionPlatform;
  /** What a screen reader and the tooltip say; always names what the item is and is not. */
  title: string;
}

export const WARNING_TITLE =
  'X reports that this account’s location may not be accurate. That is a note from X, not proof of anything.';

export const basedInTitle = (place: Place) =>
  `Account based in ${placeLabel(place)}. X’s estimate for the account, not nationality and not where a post was written.`;

export const connectionTitle = (connection: Connection) =>
  `Account connected via ${connectionLabel(connection)}. This is the account’s platform, not necessarily the app used for this post.`;

export type BadgeState =
  /** Nothing is known yet and a lookup waits for a click or a pointer rest. */
  | 'idle'
  /** A lookup is allowed to happen on its own and has not answered yet. */
  | 'waiting'
  | 'loaded'
  /** The last lookup failed; it may be tried again. */
  | 'failed'
  /** Nothing to show for this account (unavailable, or nothing shown applies). */
  | 'none';

export interface BadgeView {
  state: BadgeState;
  items: BadgeItem[];
}

/**
 * What a badge should show for an account, from only what X reported. A part that is switched off
 * or has no data contributes nothing; nothing is filled in.
 */
export function badgeView(
  entry: Entry | undefined,
  parts: ReadonlySet<BadgePart>,
  automatic: boolean,
): BadgeView {
  if (!entry) return { state: automatic ? 'waiting' : 'idle', items: [] };
  if (entry.state === 'missing') return { state: 'none', items: [] };
  // Where lookups happen on their own, a failure is not worth a mark on every post.
  if (entry.state === 'failed') return { state: automatic ? 'none' : 'failed', items: [] };
  return { state: 'loaded', items: itemsFor(entry.info, parts) };
}

export function itemsFor(info: AccountInfo, parts: ReadonlySet<BadgePart>): BadgeItem[] {
  const items: BadgeItem[] = [];
  if (parts.has('flags') && info.basedIn) {
    const glyph = flagOf(info.basedIn);
    items.push(
      glyph
        ? { kind: 'flag', glyph, title: basedInTitle(info.basedIn) }
        : { kind: 'region', title: basedInTitle(info.basedIn) },
    );
  }
  if (parts.has('connection') && info.connection && info.connection.platform !== 'unknown') {
    items.push({
      kind: 'connection',
      platform: info.connection.platform,
      title: connectionTitle(info.connection),
    });
  }
  if (parts.has('warnings') && info.locationAccurate === false)
    items.push({ kind: 'warning', title: WARNING_TITLE });
  return items;
}

/** One line a screen reader reads for the whole badge. */
export function badgeSummary(handle: string, view: BadgeView): string {
  const facts = view.items.map((item) => item.title.split('. ')[0]);
  return facts.length ? `@${handle}: ${facts.join('; ')}` : `Account information for @${handle}`;
}

/** Two views draw the same pixels when this is equal; used to skip redundant DOM work. */
export const viewKey = (view: BadgeView, interactive: boolean, handle: string) =>
  `${handle}|${view.state}|${interactive ? 1 : 0}|${view.items
    .map((item) => `${item.kind}:${item.glyph ?? item.platform ?? ''}`)
    .join(',')}`;

export function joinedLabel(info: AccountInfo): string | null {
  if (!info.createdAt) return null;
  const date = new Date(info.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}
