// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings, type FilterSettings } from '../lib/settings';
import { Scope } from '../runtime/scope';
import { extractPost } from '../x/selectors';
import { freshEnvironment } from '../test/fakes';
import { info, settle, tableTransport, testRuntime, until } from '../test/insights-env';
import { addPost } from '../test/x-markup';
import type { AccountInfo } from '../x/about-account';
import { startCountryFilter } from './filter';

const TABLE: Record<string, AccountInfo> = {
  german: info('german', 'Germany', { id: '10' }),
  american: info('american', 'United States', { id: '11' }),
  indian: info('indian', 'India', { id: '12' }),
  asian: info('asian', 'South Asia', { id: '13' }),
  friend: info('friend', 'Germany', { id: '14' }),
  unknown: info('unknown', null, { id: '15' }),
};

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

async function setup(filter: Partial<FilterSettings>, table = TABLE) {
  await saveSettings({ filter });
  const { transport, calls } = tableTransport(table);
  const env = testRuntime(transport);
  const feature = env.scope.child();
  startCountryFilter({ scope: feature, runtime: env.runtime });
  cleanup.push(() => env.scope.dispose());
  return { ...env, feature, calls };
}
const cellOf = (article: HTMLElement) =>
  article.closest<HTMLElement>('[data-testid="cellInnerDiv"]')!;
const cards = () => [...document.querySelectorAll<HTMLElement>('.bx-filter-card')];

describe('whole-post filtering', () => {
  it('collapses a post from a selected country and leaves the rest', async () => {
    await setup({ countries: ['Germany'] });
    const hit = addPost({ id: '1', handle: 'german' });
    const miss = addPost({ id: '2', handle: 'american' });
    await settle(250);
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('collapse');
    expect(cellOf(miss).hasAttribute('data-bx-filter')).toBe(false);
    const [card] = cards();
    expect(card!.textContent).toContain('Post hidden by Better X');
    expect(card!.textContent).toContain('Country: Germany');
    expect(card!.querySelector('button')!.textContent).toBe('Show post');
    expect(cellOf(hit).contains(card!)).toBe(true);
    // No node is removed: the post is still in the document.
    expect(hit.isConnected).toBe(true);
    expect(hit.textContent).toContain('Post text');
  });

  it('reveals a collapsed post on request and keeps it revealed', async () => {
    await setup({ countries: ['Germany'] });
    const hit = addPost({ id: '1', handle: 'german' });
    await settle(250);
    cards()[0]!.querySelector('button')!.click();
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('revealed');
    expect(cards()).toHaveLength(0);
    hit.querySelector('[data-testid="tweetText"]')!.textContent = 'changed';
    await settle(250);
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('revealed');
  });

  it('hide mode marks without a placeholder; highlight marks without hiding', async () => {
    const { feature } = await setup({ countries: ['Germany'], mode: 'hide' });
    const hit = addPost({ id: '1', handle: 'german' });
    await settle(250);
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('hide');
    expect(cards()).toHaveLength(0);
    await saveSettings({ filter: { mode: 'highlight' } });
    await settle(250);
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('highlight');
    await saveSettings({ filter: { mode: 'collapse' } });
    await settle(250);
    expect(cellOf(hit).getAttribute('data-bx-filter')).toBe('collapse');
    expect(cards()).toHaveLength(1);
    feature.dispose();
  });

  it('never acts on an account whose country is unknown, unavailable or not selected', async () => {
    await setup({ countries: ['Germany'] });
    const posts = ['unknown', 'indian', 'ghost'].map((handle, i) =>
      addPost({ id: String(i + 1), handle }),
    );
    await settle(250);
    for (const post of posts) expect(cellOf(post).hasAttribute('data-bx-filter')).toBe(false);
  });

  it('does nothing and asks for nothing with no country selected', async () => {
    const { calls } = await setup({ countries: [] });
    addPost({ id: '1', handle: 'german' });
    await settle(250);
    expect(calls).toEqual([]);
    expect(cards()).toHaveLength(0);
  });

  it('matches a region label only as itself', async () => {
    await setup({ countries: ['South Asia'] });
    const region = addPost({ id: '1', handle: 'asian' });
    const country = addPost({ id: '2', handle: 'indian' });
    await settle(250);
    expect(cellOf(region).getAttribute('data-bx-filter')).toBe('collapse');
    expect(cellOf(country).hasAttribute('data-bx-filter')).toBe(false);
    expect(cards()[0]!.textContent).toContain('Region: South Asia');
  });

  it('shows Always Show accounts, by handle', async () => {
    await setup({ countries: ['Germany'], alwaysShow: [{ handle: 'friend' }] });
    const friend = addPost({ id: '1', handle: 'friend' });
    const other = addPost({ id: '2', handle: 'german' });
    await settle(250);
    expect(cellOf(friend).hasAttribute('data-bx-filter')).toBe(false);
    expect(cellOf(other).getAttribute('data-bx-filter')).toBe('collapse');
  });

  it('learns an Always Show account’s id once, writing from what is stored now', async () => {
    await setup({ countries: ['Germany'], alwaysShow: [{ handle: 'friend' }] });
    await settle(250);
    // Another tab adds an entry while ours resolved the first.
    await saveSettings({
      filter: { alwaysShow: [{ handle: 'friend', id: '14' }, { handle: 'late' }] },
    });
    await settle(250);
    const list = (await loadSettings()).filter.alwaysShow;
    expect(list.find((e) => e.handle === 'friend')?.id).toBe('14');
    expect(list.map((e) => e.handle)).toContain('late');
  });

  it('keeps showing the post the page was opened on, and the person’s own posts', async () => {
    const { runtime } = await setup({ countries: ['Germany'] });
    history.replaceState({}, '', '/german/status/1');
    runtime.routes.check();
    const focal = addPost({ id: '1', handle: 'german' });
    const other = addPost({ id: '2', handle: 'german' });
    await settle(250);
    expect(cellOf(focal).hasAttribute('data-bx-filter')).toBe(false);
    expect(cellOf(other).getAttribute('data-bx-filter')).toBe('collapse');
    history.replaceState({}, '', '/');
  });

  it('turns everything back when the filter is switched off', async () => {
    const { feature } = await setup({ countries: ['Germany'] });
    const hit = addPost({ id: '1', handle: 'german', quote: { id: '5', handle: 'german' } });
    await settle(250);
    expect(cards().length).toBeGreaterThan(0);
    feature.dispose();
    expect(cards()).toHaveLength(0);
    expect(document.querySelectorAll('[data-bx-filter], [data-bx-quote]')).toHaveLength(0);
    expect(hit.isConnected).toBe(true);
  });

  it('re-evaluates a recycled post element for its new author', async () => {
    await setup({ countries: ['Germany'] });
    const article = addPost({ id: '1', handle: 'german' });
    await settle(250);
    expect(cellOf(article).getAttribute('data-bx-filter')).toBe('collapse');
    const cell = cellOf(article);
    const donor = addPost({ id: '9', handle: 'american', cell: false });
    article.replaceChildren(...donor.childNodes);
    donor.remove();
    await settle(300);
    expect(cell.hasAttribute('data-bx-filter')).toBe(false);
    expect(cards()).toHaveLength(0);
  });

  it('releases a timeline cell that X reuses for something that is not a post', async () => {
    await setup({ countries: ['Germany'] });
    const article = addPost({ id: '1', handle: 'german' });
    const cell = cellOf(article);
    await settle(250);
    expect(cell.getAttribute('data-bx-filter')).toBe('collapse');
    cell.replaceChildren(
      Object.assign(document.createElement('div'), { textContent: 'Show more' }),
    );
    // The post stream reports the removal with its next batch; the filter's own check finds it
    // within a second.
    await settle(1300);
    expect(cell.hasAttribute('data-bx-filter')).toBe(false);
  });
});

describe('quoted-post filtering', () => {
  const quoted = (handle: string) => ({ id: '77', handle });

  it('collapses only the quote when its author matches, keeping the parent', async () => {
    await setup({ countries: ['Germany'] });
    const article = addPost({
      id: '1',
      handle: 'american',
      text: 'Parent post',
      quote: quoted('german'),
    });
    await settle(250);
    expect(cellOf(article).hasAttribute('data-bx-filter')).toBe(false);
    const block = article.querySelector<HTMLElement>('[data-testid="quoteTweet"]')!;
    expect(block.getAttribute('data-bx-quote')).toBe('collapse');
    const card = block.nextElementSibling as HTMLElement;
    expect(card.classList.contains('bx-filter-card')).toBe(true);
    expect(card.textContent).toContain('Quoted post hidden by Better X');
    expect(card.textContent).toContain('Country: Germany');
    expect(card.querySelector('button')!.textContent).toBe('Show quoted post');
  });

  it('does not give the parent’s country to the quoted author, or the quote’s to the parent', async () => {
    await setup({ countries: ['Germany'] });
    const parentGerman = addPost({
      id: '1',
      handle: 'german',
      quote: quoted('american'),
    });
    await settle(250);
    expect(cellOf(parentGerman).getAttribute('data-bx-filter')).toBe('collapse');
    expect(
      parentGerman.querySelector('[data-testid="quoteTweet"]')!.hasAttribute('data-bx-quote'),
    ).toBe(false);
  });

  it('reveals the quote without touching the parent, and the bookmark still reads both', async () => {
    await setup({ countries: ['Germany'] });
    const article = addPost({
      id: '1',
      handle: 'american',
      text: 'Parent post',
      quote: { id: '77', handle: 'german', text: 'Quoted words' },
    });
    const before = extractPost(article);
    await settle(250);
    const during = extractPost(article);
    expect(during).toEqual(before);
    expect(during?.quote?.authorHandle).toBe('german');
    expect(during?.quote?.text).toBe('Quoted words');
    document.querySelector<HTMLButtonElement>('.bx-filter-card button')!.click();
    const block = article.querySelector('[data-testid="quoteTweet"]')!;
    expect(block.getAttribute('data-bx-quote')).toBe('revealed');
    expect(cards()).toHaveLength(0);
    expect(extractPost(article)).toEqual(before);
  });

  it('filters the post and its quote independently when both match', async () => {
    await setup({ countries: ['Germany', 'India'] });
    const article = addPost({ id: '1', handle: 'german', quote: quoted('indian') });
    await settle(250);
    expect(cellOf(article).getAttribute('data-bx-filter')).toBe('collapse');
    expect(article.querySelector('[data-testid="quoteTweet"]')!.getAttribute('data-bx-quote')).toBe(
      'collapse',
    );
    expect(cards()).toHaveLength(2);
  });

  it('respects the separate post and quote switches', async () => {
    await setup({ countries: ['Germany'], posts: false, quotes: true });
    const a = addPost({ id: '1', handle: 'german', quote: quoted('german') });
    await settle(250);
    expect(cellOf(a).hasAttribute('data-bx-filter')).toBe(false);
    expect(a.querySelector('[data-testid="quoteTweet"]')!.getAttribute('data-bx-quote')).toBe(
      'collapse',
    );
    await saveSettings({ filter: { posts: true, quotes: false } });
    await settle(300);
    expect(cellOf(a).getAttribute('data-bx-filter')).toBe('collapse');
    expect(a.querySelector('[data-testid="quoteTweet"]')!.hasAttribute('data-bx-quote')).toBe(
      false,
    );
    expect(cards()).toHaveLength(1);
  });

  it('applies Always Show to quoted authors as well', async () => {
    await setup({ countries: ['Germany'], alwaysShow: [{ handle: 'friend' }] });
    const a = addPost({ id: '1', handle: 'american', quote: quoted('friend') });
    await settle(250);
    expect(a.querySelector('[data-testid="quoteTweet"]')!.hasAttribute('data-bx-quote')).toBe(
      false,
    );
  });

  it('clears a quote mark when X drops the quote from the post', async () => {
    await setup({ countries: ['Germany'] });
    const a = addPost({ id: '1', handle: 'american', quote: quoted('german') });
    await settle(250);
    expect(cards()).toHaveLength(1);
    a.querySelector('[data-testid="quoteTweet"]')!.remove();
    a.querySelector('[data-testid="tweetText"]')!.textContent = 'edited';
    await until(() => cards().length === 0);
    expect(cards()).toHaveLength(0);
  });

  it('keeps a stray scope from leaking: nothing remains after dispose', async () => {
    const env = await setup({ countries: ['Germany'] });
    addPost({ id: '1', handle: 'american', quote: quoted('german') });
    await settle(250);
    env.scope.dispose();
    expect(document.querySelectorAll('[data-bx-quote], .bx-filter-card')).toHaveLength(0);
    void Scope;
  });
});
