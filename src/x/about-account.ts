/*
 * The response shape (`user_result_by_screen_name.result.about_profile`, with `account_based_in`,
 * `source`, `location_accurate`, `username_changes`, and the identity fields beside it) was
 * learned from X-Posed (MIT, Alexander Hagenah) and X Profile Location (MIT,
 * Copyright (c) 2026 Aleksandr Smyshliaev); the way a connection string is read follows the latter.
 * See THIRD_PARTY_NOTICES.md. Tests use response bodies recorded by X Profile Location's suite.
 */
import { resolvePlace, type Place } from '../insights/places';

/** Which platform X says an account is connected through. */
export type ConnectionPlatform = 'ios' | 'android' | 'web' | 'unknown';

/**
 * "Connected via": the app store or platform X reports for the ACCOUNT. It is not the client a
 * given post was published from, and it is not where the account is based.
 */
export interface Connection {
  platform: ConnectionPlatform;
  /** Exactly what X said, for the tooltip ("United Kingdom App Store"). */
  raw: string;
  /** The country in front of an app store, when X names one. Never used to decide a location. */
  storeCountry?: string;
}

export interface Verification {
  /** X's paid (blue) check. */
  blue?: boolean;
  /** An organisation or government check, when X says which. */
  type?: 'business' | 'government';
  /** When the account became verified, ISO date. */
  since?: string;
}

/**
 * Everything Better X reads from X's "About this account" data. A field X did not send is absent,
 * never filled in: absent means unknown.
 */
export interface AccountInfo {
  /** The handle that was looked up, lowercase. */
  handle: string;
  /** X's stable numeric id for the account; unlike a handle it survives a rename. */
  id?: string;
  displayName?: string;
  /** ACCOUNT BASED IN: the country or region X infers for the account. */
  basedIn?: Place;
  /** CONNECTED VIA: see `Connection`. */
  connection?: Connection;
  /**
   * `false` when X flags that the based-in location may not be accurate (X's own wording is
   * "location accuracy"); `true` when X sent no such flag. Absent when X sent neither.
   */
  locationAccurate?: boolean;
  /** When the account was created, ISO date. */
  createdAt?: string;
  usernameChanges?: number;
  /** When the handle last changed, ISO date. */
  lastUsernameChangeAt?: string;
  /** The organisation X shows the account as affiliated with. */
  affiliate?: { name: string };
  verification?: Verification;
}

export type AboutParse =
  { ok: true; info: AccountInfo } | { ok: false; reason: 'unavailable' | 'mismatch' | 'shape' };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 200): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/** An integer from a number or a numeric string (X sends counts as strings). */
function count(value: unknown): number | undefined {
  const n = typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

function isoDate(value: unknown): string | undefined {
  const time =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{9,14}$/.test(value)
        ? Number(value)
        : typeof value === 'string'
          ? Date.parse(value)
          : NaN;
  if (!Number.isFinite(time) || time <= 0) return undefined;
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const APP_STORE = /^(.*?)\s*app\s+store$/i;
const ANDROID = /^(.*?)\s*android(?:\s+app)?$/i;

/** Reads X's `source` string ("web", "Japan App Store", "Nigeria Android App") into a platform. */
export function parseConnection(raw: unknown): Connection | undefined {
  const value = text(raw, 120);
  if (!value) return undefined;
  const store = APP_STORE.exec(value) ?? undefined;
  const android = store ? undefined : (ANDROID.exec(value) ?? undefined);
  const prefix = (store ?? android)?.[1]?.trim();
  const country = prefix ? resolvePlace(prefix) : null;
  const storeCountry = country?.kind === 'country' ? country.name : undefined;
  const base = { raw: value, ...(storeCountry ? { storeCountry } : {}) };
  if (store) return { platform: 'ios', ...base };
  if (android) return { platform: 'android', ...base };
  if (/^web$/i.test(value)) return { platform: 'web', raw: value };
  return { platform: 'unknown', raw: value };
}

function verificationOf(user: Json): Verification | undefined {
  const verification = isObject(user.verification) ? user.verification : {};
  const info = isObject(user.verification_info) ? user.verification_info : {};
  const reason = isObject(info.reason) ? info.reason : {};
  const result: Verification = {};
  if (user.is_blue_verified === true) result.blue = true;
  const type = text(verification.verified_type, 20)?.toLowerCase();
  if (type === 'business' || type === 'government') result.type = type;
  const since = isoDate(reason.verified_since_msec);
  if (since) result.since = since;
  return Object.keys(result).length ? result : undefined;
}

/**
 * Turns an AboutAccountQuery response into typed account info. Anything that is not exactly what
 * was expected is left out; a response about a different account than the one requested is
 * refused, so one account's data can never be attached to another.
 */
export function parseAboutAccount(body: unknown, requestedHandle: string): AboutParse {
  if (!isObject(body) || !isObject(body.data)) return { ok: false, reason: 'shape' };
  const holder = body.data.user_result_by_screen_name;
  if (!isObject(holder)) return { ok: false, reason: 'shape' };
  const user = holder.result;
  if (!isObject(user) || user.__typename === 'UserUnavailable') {
    return { ok: false, reason: 'unavailable' };
  }
  const core = isObject(user.core) ? user.core : {};
  const returned = text(core.screen_name, 40);
  if (returned && returned.toLowerCase() !== requestedHandle.toLowerCase())
    return { ok: false, reason: 'mismatch' };

  const profile = isObject(user.about_profile) ? user.about_profile : {};
  const info: AccountInfo = { handle: requestedHandle.toLowerCase() };
  const id = text(user.rest_id, 30);
  if (id && /^\d{1,25}$/.test(id)) info.id = id;
  const displayName = text(core.name, 100);
  if (displayName) info.displayName = displayName;
  const basedIn = resolvePlace(profile.account_based_in);
  if (basedIn) info.basedIn = basedIn;
  const connection = parseConnection(profile.source);
  if (connection) info.connection = connection;
  if (profile.location_accurate === false) info.locationAccurate = false;
  else if (profile.location_accurate === true) info.locationAccurate = true;
  const createdAt = isoDate(core.created_at);
  if (createdAt) info.createdAt = createdAt;
  const changes = isObject(profile.username_changes) ? profile.username_changes : undefined;
  const changeCount = count(changes?.count);
  if (changeCount !== undefined) info.usernameChanges = changeCount;
  const lastChange = isoDate(changes?.last_changed_at_msec);
  if (lastChange) info.lastUsernameChangeAt = lastChange;

  // The organisation label sits on the user, under one of two names depending on the account.
  const highlighted = isObject(user.affiliates_highlighted_label)
    ? user.affiliates_highlighted_label
    : isObject(user.identity_profile_labels_highlighted_label)
      ? user.identity_profile_labels_highlighted_label
      : undefined;
  const label = isObject(highlighted?.label) ? highlighted.label : undefined;
  const affiliate = text(label?.description, 100);
  if (affiliate) info.affiliate = { name: affiliate };

  const verification = verificationOf(user);
  if (verification) info.verification = verification;
  return { ok: true, info };
}
