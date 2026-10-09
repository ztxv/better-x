import type { AlwaysShowEntry, FilterSettings } from '../lib/settings';
import type { AccountInfo } from '../x/about-account';
import type { Entry } from './accounts-store';
import { placeKey, resolveSelectable, type Place } from './places';

/** The filter's selected places as keys, ready to test an account against. */
export interface Selection {
  keys: ReadonlySet<string>;
  alwaysShow: readonly AlwaysShowEntry[];
}

export function selectionOf(filter: Pick<FilterSettings, 'countries' | 'alwaysShow'>): Selection {
  const keys = new Set<string>();
  for (const name of filter.countries) {
    const place = resolveSelectable(name);
    if (place) keys.add(placeKey(place));
  }
  return { keys, alwaysShow: filter.alwaysShow };
}

/**
 * Whether an Always Show entry is this account. By X's numeric id when both sides have one, so a
 * rename keeps matching and a handle another person later takes does not; by handle when either
 * side lacks the id.
 */
export function isExempt(
  entries: readonly AlwaysShowEntry[],
  handle: string,
  info: AccountInfo | undefined,
): boolean {
  for (const entry of entries) {
    if (entry.id && info?.id) {
      if (entry.id === info.id) return true;
      continue;
    }
    if (entry.handle === handle) return true;
  }
  return false;
}

export interface Exemptions {
  /** The signed-in person's own handle: their own posts are never filtered. */
  self?: string | null;
  /** The post the page was opened on: opening a post always shows it. */
  focal?: boolean;
}

export type Verdict = { match: false } | { match: true; place: Place };

const NO: Verdict = { match: false };

/**
 * Should this account's post (or quote) be acted on? Only when X has told us where the account is
 * based and that place is selected. Unknown, loading, failed, unavailable and region-less
 * answers never match, and neither does anything exempt.
 */
export function verdictFor(
  selection: Selection,
  handle: string | null,
  entry: Entry | undefined,
  exemptions: Exemptions = {},
): Verdict {
  if (!handle || selection.keys.size === 0) return NO;
  if (entry?.state !== 'ok') return NO;
  const place = entry.info.basedIn;
  if (!place || !selection.keys.has(placeKey(place))) return NO;
  if (exemptions.focal) return NO;
  if (exemptions.self && exemptions.self === handle) return NO;
  if (isExempt(selection.alwaysShow, handle, entry.info)) return NO;
  return { match: true, place };
}

/** The line a placeholder gives as the reason. */
export function reasonText(place: Place): string {
  return `${place.kind === 'region' ? 'Region' : 'Country'}: ${place.name}`;
}
