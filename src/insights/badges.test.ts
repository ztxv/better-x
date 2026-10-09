// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveSettings } from '../lib/settings';
import { freshEnvironment } from '../test/fakes';
import { info, settle, tableTransport, testRuntime } from '../test/insights-env';
import { addPost } from '../test/x-markup';
import { badgeSlot, badgesFor } from './badges';
import { badgeView, itemsFor } from './model';
import { resolvePlace } from './places';
import type { AccountInfo } from '../x/about-account';

const GERMANY = info('alice', 'Germany', {
  connection: { platform: 'ios', raw: 'Germany App Store', storeCountry: 'Germany' },
  locationAccurate: true,
  id: '1',
  displayName: 'Alice',
  createdAt: '2018-10-10T20:19:24.000Z',
  usernameChanges: 2,
});
const NIGERIA: AccountInfo = info('bob', 'Nigeria', {
  connection: { platform: 'android', raw: 'Nigeria Android App' },
  locationAccurate: false,
});

let cleanup: Array<() => void> = [];
beforeEach(async () => {
  await freshEnvironment();
  document.body.innerHTML = '';
  cleanup = [];
});
afterEach(() => {
  cleanup.forEach((fn) => fn());
  document.body.innerHTML = '';
});

function setup(table: Record<string, AccountInfo> = { alice: GERMANY, bob: NIGERIA }) {
  const { transport, calls } = tableTransport(table);
  const env = testRuntime(transport);
  cleanup.push(() => env.scope.dispose());
  return { ...env, calls };
}
const badges = () => [...document.querySelectorAll<HTMLElement>('.bx-acct')];

describe('badge view', () => {
  const parts = (...p: Array<'flags' | 'connection' | 'details' | 'warnings'>) => new Set(p);

  it('shows only what is switched on and what X reported', () => {
    expect(itemsFor(GERMANY, parts('flags')).map((i) => i.kind)).toEqual(['flag']);
    expect(itemsFor(GERMANY, parts('flags', 'connection')).map((i) => i.kind)).toEqual([
      'flag',
      'connection',
    ]);
    expect(itemsFor(GERMANY, parts('warnings'))).toEqual([]); // accurate: no warning
    expect(itemsFor(NIGERIA, parts('warnings')).map((i) => i.kind)).toEqual(['warning']);
    expect(itemsFor(info('x', null), parts('flags', 'connection', 'warnings'))).toEqual([]);
  });

  it('uses a flag for a country, a pin for a region, and nothing for an unknown platform', () => {
    expect(itemsFor(GERMANY, parts('flags'))[0]).toMatchObject({ kind: 'flag', glyph: '🇩🇪' });
    const region = { handle: 'r', basedIn: resolvePlace('South Asia')! };
    expect(itemsFor(region, parts('flags'))[0]).toMatchObject({ kind: 'region' });
    const odd = info('o', null, { connection: { platform: 'unknown', raw: 'Something' } });
    expect(itemsFor(odd, parts('connection'))).toEqual([]);
  });

  it('says plainly what each mark is and is not', () => {
    const [flag, connection] = itemsFor(GERMANY, parts('flags', 'connection'));
    expect(flag!.title).toMatch(/based in Germany/);
    expect(flag!.title).toMatch(/not nationality/);
    expect(connection!.title).toMatch(/Apple App Store/);
    expect(connection!.title).toMatch(/not necessarily the app used for this post/);
    expect(itemsFor(NIGERIA, parts('warnings'))[0]!.title).toMatch(/not proof/);
  });

  it('is idle before a lookup in manual modes, waiting in automatic mode', () => {
    expect(badgeView(undefined, parts('flags'), false).state).toBe('idle');
    expect(badgeView(undefined, parts('flags'), true).state).toBe('waiting');
    const failed = { state: 'failed', at: 1, retryAt: 2, tries: 1, reason: 'error' } as const;
    expect(badgeView(failed, parts('flags'), false).state).toBe('failed');
    expect(badgeView(failed, parts('flags'), true).state).toBe('none');
  });
});

describe('badge slot', () => {
  it('goes right after the @handle cell, inside the name row, not inside the profile link', () => {
    const article = addPost({ id: '1', handle: 'alice' });
    const slot = badgeSlot(article, 'alice')!;
    expect(slot.parent.querySelector('time')).not.toBeNull();
    expect((slot.after as Element).textContent).toContain('@alice');
    expect((slot.after as Element).closest('a')).toBeNull();
  });

  it('has no slot where X’s name block is absent', () => {
    const bare = document.createElement('article');
    document.body.append(bare);
    expect(badgeSlot(bare, 'alice')).toBeNull();
  });
});

describe('badges on the page', () => {
  it('stays idle until asked in hover mode: a globe control, no request', async () => {
    const { runtime, calls } = setup();
    addPost({ id: '1', handle: 'alice' });
    cleanup.push(badgesFor(runtime).retain('flags'));
    await settle();
    const [badge] = badges();
    expect(badge?.dataset.state).toBe('idle');
    expect(badge?.tagName).toBe('BUTTON');
    expect(badge?.getAttribute('aria-label')).toMatch(/Look up/);
    expect(calls).toEqual([]);
  });

  it('looks the account up when the globe is clicked, then shows the flag', async () => {
    const { runtime, calls } = setup();
    addPost({ id: '1', handle: 'alice' });
    cleanup.push(badgesFor(runtime).retain('flags'));
    await settle();
    badges()[0]!.click();
    await settle();
    expect(calls).toEqual(['alice']);
    expect(badges()).toHaveLength(1);
    expect(badges()[0]!.dataset.state).toBe('loaded');
    expect(badges()[0]!.textContent).toBe('🇩🇪');
  });

  it('looks up on its own for posts on screen in visible mode, one request per author', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime, calls } = setup();
    addPost({ id: '1', handle: 'alice' });
    addPost({ id: '2', handle: 'alice' });
    addPost({ id: '3', handle: 'bob' });
    cleanup.push(badgesFor(runtime).retain('flags'), badgesFor(runtime).retain('connection'));
    await settle(200);
    expect([...calls].sort()).toEqual(['alice', 'bob']);
    expect(badges()).toHaveLength(3);
    const first = badges()[0]!;
    expect(first.textContent).toContain('🇩🇪');
    expect(first.querySelectorAll('.bx-acct-item')).toHaveLength(2);
    expect(first.querySelector('svg')).not.toBeNull(); // the Apple mark
  });

  it('draws one badge per post, never duplicates, and updates when a part changes', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    addPost({ id: '1', handle: 'alice' });
    const flags = badgesFor(runtime).retain('flags');
    await settle(200);
    expect(badges()).toHaveLength(1);
    const connection = badgesFor(runtime).retain('connection');
    await settle();
    expect(badges()).toHaveLength(1);
    expect(badges()[0]!.querySelectorAll('.bx-acct-item')).toHaveLength(2);
    flags();
    await settle();
    expect(badges()[0]!.querySelectorAll('.bx-acct-item')).toHaveLength(1);
    connection();
    await settle();
    expect(badges()).toHaveLength(0);
  });

  it('removes every badge when the last part is switched off', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    addPost({ id: '1', handle: 'alice' });
    addPost({ id: '2', handle: 'bob' });
    const off = badgesFor(runtime).retain('flags');
    await settle(200);
    expect(badges()).toHaveLength(2);
    off();
    expect(badges()).toHaveLength(0);
  });

  it('shows the right account when X reuses a post element for another author', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    const article = addPost({ id: '1', handle: 'alice' });
    cleanup.push(badgesFor(runtime).retain('flags'));
    await settle(200);
    expect(badges()[0]!.textContent).toBe('🇩🇪');
    // X swaps the content of the same <article> for another post.
    const donor = addPost({ id: '9', handle: 'bob', cell: false });
    article.replaceChildren(...donor.childNodes);
    donor.remove();
    await settle(300);
    expect(badges()).toHaveLength(1);
    expect(badges()[0]!.dataset.bxAcct).toBe('bob');
    expect(badges()[0]!.querySelector('.bx-acct-item')?.getAttribute('data-kind')).toBe('flag');
    expect(badges()[0]!.textContent).toBe('🇳🇬');
  });

  it('puts back a badge that X’s re-render dropped', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    const article = addPost({ id: '1', handle: 'alice' });
    cleanup.push(badgesFor(runtime).retain('flags'));
    await settle(200);
    badges()[0]!.remove();
    // Any later change inside the post is another look at it.
    article.querySelector('[data-testid="tweetText"]')!.textContent = 'edited';
    await settle(200);
    expect(badges()).toHaveLength(1);
  });

  it('opens the details card from the badge, shows only known rows, closes on Escape', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    addPost({ id: '1', handle: 'alice' });
    const sparse = addPost({ id: '2', handle: 'bob' });
    void sparse;
    cleanup.push(badgesFor(runtime).retain('flags'), badgesFor(runtime).retain('details'));
    await settle(200);
    const [alice, bob] = badges() as [HTMLElement, HTMLElement];
    expect(alice.getAttribute('aria-haspopup')).toBe('dialog');
    alice.click();
    const card = document.getElementById('bx-acctcard')!;
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-label')).toBe('Account details for @alice');
    const labels = [...card.querySelectorAll('.bx-acct-term')].map((n) => n.textContent);
    expect(labels).toEqual(['Based in', 'Connected via', 'Joined', 'Username changes']);
    expect(card.textContent).toContain('Germany');
    expect(card.textContent).toContain('Apple App Store');
    expect(card.textContent).toMatch(/not nationality/);
    expect(alice.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('bx-acctcard')).toBeNull();
    expect(alice.getAttribute('aria-expanded')).toBeNull();
    // Bob has a warning and no created date: the card has a warning row and no Joined row.
    bob.click();
    const bobLabels = [...document.querySelectorAll('.bx-acct-term')].map((n) => n.textContent);
    expect(bobLabels).toEqual(['Based in', 'Connected via', 'Location accuracy']);
    expect(document.body.textContent).toContain('X reports possible uncertainty');
  });

  it('refreshes one account from the card', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime, calls } = setup();
    addPost({ id: '1', handle: 'alice' });
    cleanup.push(badgesFor(runtime).retain('flags'), badgesFor(runtime).retain('details'));
    await settle(200);
    badges()[0]!.click();
    document.querySelector<HTMLButtonElement>('.bx-acct-refresh')!.click();
    await settle();
    expect(calls).toEqual(['alice', 'alice']);
  });

  it('leaves X’s own controls and the Save control alone', async () => {
    await saveSettings({ insights: { lookup: 'visible' } });
    const { runtime } = setup();
    const article = addPost({ id: '1', handle: 'alice' });
    const before = article.querySelector('[role="group"]')!.outerHTML;
    const profileLinks = article.querySelectorAll('a[href="/alice"]').length;
    cleanup.push(badgesFor(runtime).retain('flags'));
    await settle(200);
    expect(article.querySelector('[role="group"]')!.outerHTML).toBe(before);
    expect(article.querySelectorAll('a[href="/alice"]')).toHaveLength(profileLinks);
    expect(article.querySelector('a .bx-acct')).toBeNull();
  });
});
