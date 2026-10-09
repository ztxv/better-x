import { describe, expect, it } from 'vitest';
import type { AccountInfo } from '../x/about-account';
import type { Entry } from './accounts-store';
import { resolvePlace } from './places';
import { isExempt, reasonText, selectionOf, verdictFor } from './verdict';

const ok = (handle: string, country: string | null, extra: Partial<AccountInfo> = {}): Entry => ({
  state: 'ok',
  at: 1,
  info: { handle, ...(country ? { basedIn: resolvePlace(country)! } : {}), ...extra },
});
const select = (countries: string[], alwaysShow: Array<{ handle: string; id?: string }> = []) =>
  selectionOf({ countries, alwaysShow });

describe('verdictFor', () => {
  it('matches an account X places in a selected country, under any spelling', () => {
    expect(verdictFor(select(['United States']), 'a', ok('a', 'USA')).match).toBe(true);
    expect(verdictFor(select(['Germany']), 'a', ok('a', 'Germany'))).toMatchObject({
      match: true,
      place: { name: 'Germany' },
    });
  });

  it('does not match another country, or a region for a country in it', () => {
    expect(verdictFor(select(['Germany']), 'a', ok('a', 'Japan')).match).toBe(false);
    expect(verdictFor(select(['India']), 'a', ok('a', 'South Asia')).match).toBe(false);
    expect(verdictFor(select(['South Asia']), 'a', ok('a', 'India')).match).toBe(false);
    expect(verdictFor(select(['South Asia']), 'a', ok('a', 'South Asia')).match).toBe(true);
  });

  it('never matches what is unknown, loading, failed or unavailable', () => {
    const s = select(['Germany']);
    expect(verdictFor(s, 'a', undefined).match).toBe(false);
    expect(verdictFor(s, 'a', ok('a', null)).match).toBe(false);
    expect(verdictFor(s, 'a', { state: 'missing', at: 1 }).match).toBe(false);
    expect(
      verdictFor(s, 'a', { state: 'failed', at: 1, retryAt: 2, tries: 1, reason: 'error' }).match,
    ).toBe(false);
    expect(verdictFor(s, null, ok('a', 'Germany')).match).toBe(false);
  });

  it('does nothing without a selection', () => {
    expect(verdictFor(select([]), 'a', ok('a', 'Germany')).match).toBe(false);
  });

  it('lets Always Show win over a selected country', () => {
    const s = select(['Germany'], [{ handle: 'friend' }]);
    expect(verdictFor(s, 'friend', ok('friend', 'Germany')).match).toBe(false);
    expect(verdictFor(s, 'stranger', ok('stranger', 'Germany')).match).toBe(true);
  });

  it('never filters the person’s own account or the post they opened', () => {
    const s = select(['Germany']);
    expect(verdictFor(s, 'me', ok('me', 'Germany'), { self: 'me' }).match).toBe(false);
    expect(verdictFor(s, 'a', ok('a', 'Germany'), { focal: true }).match).toBe(false);
    expect(verdictFor(s, 'a', ok('a', 'Germany'), { self: 'me' }).match).toBe(true);
  });

  it('words the reason by kind', () => {
    expect(reasonText(resolvePlace('Germany')!)).toBe('Country: Germany');
    expect(reasonText(resolvePlace('South Asia')!)).toBe('Region: South Asia');
  });
});

describe('Always Show by id', () => {
  const info = (id?: string): AccountInfo => ({ handle: 'newname', ...(id ? { id } : {}) });

  it('follows the account through a rename', () => {
    expect(isExempt([{ handle: 'oldname', id: '7' }], 'newname', info('7'))).toBe(true);
  });

  it('does not exempt a different account that took the old handle', () => {
    expect(
      isExempt([{ handle: 'oldname', id: '7' }], 'oldname', { handle: 'oldname', id: '8' }),
    ).toBe(false);
  });

  it('falls back to the handle until an id is known on either side', () => {
    expect(isExempt([{ handle: 'newname' }], 'newname', info('7'))).toBe(true);
    expect(isExempt([{ handle: 'newname', id: '7' }], 'newname', info())).toBe(true);
    expect(isExempt([{ handle: 'other' }], 'newname', info('7'))).toBe(false);
  });
});
