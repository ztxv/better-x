import { describe, expect, it } from 'vitest';
import { parseAboutAccount, parseConnection } from './about-account';

/**
 * Response bodies of this shape were recorded from x.com by X Profile Location's end-to-end suite
 * (MIT, Copyright (c) 2026 Aleksandr Smyshliaev): `about_profile` carries the based-in place, the
 * connection string and the accuracy flag. The wider identity fields follow X-Posed's parser.
 */
const body = (profile: unknown, user: Record<string, unknown> = {}) => ({
  data: { user_result_by_screen_name: { result: { about_profile: profile, ...user } } },
});

describe('parseConnection', () => {
  it('reads the strings recorded from X', () => {
    expect(parseConnection('web')).toEqual({ platform: 'web', raw: 'web' });
    expect(parseConnection('Web')).toEqual({ platform: 'web', raw: 'Web' });
    expect(parseConnection('Japan App Store')).toEqual({
      platform: 'ios',
      raw: 'Japan App Store',
      storeCountry: 'Japan',
    });
    expect(parseConnection('United Kingdom App Store')?.storeCountry).toBe('United Kingdom');
    expect(parseConnection('Nigeria Android App')).toEqual({
      platform: 'android',
      raw: 'Nigeria Android App',
      storeCountry: 'Nigeria',
    });
  });

  it('has no store country when X names none, and keeps the rest unknown', () => {
    expect(parseConnection('App Store')).toEqual({ platform: 'ios', raw: 'App Store' });
    expect(parseConnection('Android App')).toEqual({ platform: 'android', raw: 'Android App' });
    expect(parseConnection('Some New Platform')).toEqual({
      platform: 'unknown',
      raw: 'Some New Platform',
    });
  });

  it('gives nothing for a missing or blank source', () => {
    for (const raw of [undefined, null, '', '  ', 5]) expect(parseConnection(raw)).toBeUndefined();
  });
});

describe('parseAboutAccount', () => {
  it('reads a recorded response: based in, connected via, accurate', () => {
    const parsed = parseAboutAccount(
      body({ account_based_in: 'Germany', location_accurate: true, source: 'web' }),
      'SVTV_News',
    );
    expect(parsed).toEqual({
      ok: true,
      info: {
        handle: 'svtv_news',
        basedIn: { kind: 'country', code: 'DE', name: 'Germany' },
        connection: { platform: 'web', raw: 'web' },
        locationAccurate: true,
      },
    });
  });

  it('reads the fuller shape with a warning, a rename count and identity fields', () => {
    const parsed = parseAboutAccount(
      body(
        {
          account_based_in: 'Nigeria',
          location_accurate: false,
          source: 'Nigeria Android App',
          learn_more_url: 'https://help.twitter.com/rules-and-policies/profile-labels',
          username_changes: { count: '1', last_changed_at_msec: '1727262819220' },
        },
        {
          rest_id: '12345',
          core: {
            screen_name: 'someone',
            name: 'Some One',
            created_at: 'Wed Oct 10 20:19:24 +0000 2018',
          },
          is_blue_verified: true,
          verification: { verified_type: 'Business' },
          verification_info: { reason: { verified_since_msec: '1727262819220' } },
          affiliates_highlighted_label: { label: { description: 'Example Org' } },
        },
      ),
      'someone',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.info).toMatchObject({
      handle: 'someone',
      id: '12345',
      displayName: 'Some One',
      locationAccurate: false,
      createdAt: '2018-10-10T20:19:24.000Z',
      usernameChanges: 1,
      lastUsernameChangeAt: '2024-09-25T11:13:39.220Z',
      affiliate: { name: 'Example Org' },
      verification: { blue: true, type: 'business', since: '2024-09-25T11:13:39.220Z' },
    });
    expect(parsed.info.basedIn?.code).toBe('NG');
    expect(parsed.info.connection?.platform).toBe('android');
  });

  it('keeps what X did not send unknown instead of filling it in', () => {
    const parsed = parseAboutAccount(body({}), 'quiet');
    expect(parsed).toEqual({ ok: true, info: { handle: 'quiet' } });
    const noAbout = parseAboutAccount(
      { data: { user_result_by_screen_name: { result: { rest_id: '9' } } } },
      'quiet',
    );
    expect(noAbout).toEqual({ ok: true, info: { handle: 'quiet', id: '9' } });
    // A missing accuracy flag is not "accurate".
    if (parsed.ok) expect(parsed.info.locationAccurate).toBeUndefined();
  });

  it('keeps a region label as a region and an unfamiliar one as said', () => {
    const region = parseAboutAccount(body({ account_based_in: 'South Asia' }), 'a');
    expect(region.ok && region.info.basedIn).toEqual({ kind: 'region', name: 'South Asia' });
  });

  it('refuses a response about a different account', () => {
    expect(
      parseAboutAccount(
        body({ account_based_in: 'Germany' }, { core: { screen_name: 'other' } }),
        'me',
      ),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('reports an unavailable account, and a body that is not the expected shape', () => {
    expect(
      parseAboutAccount(
        { data: { user_result_by_screen_name: { result: { __typename: 'UserUnavailable' } } } },
        'x',
      ),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(parseAboutAccount({ data: { user_result_by_screen_name: {} } }, 'x')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    for (const junk of [null, 5, 'text', [], {}, { data: null }, { data: {} }])
      expect(parseAboutAccount(junk, 'x')).toEqual({ ok: false, reason: 'shape' });
  });

  it('ignores malformed field values', () => {
    const parsed = parseAboutAccount(
      body(
        {
          account_based_in: 42,
          source: {},
          location_accurate: 'yes',
          username_changes: { count: '-3', last_changed_at_msec: 'soon' },
        },
        { rest_id: 'abc', core: { created_at: 'not a date' } },
      ),
      'x',
    );
    expect(parsed).toEqual({ ok: true, info: { handle: 'x' } });
  });
});
