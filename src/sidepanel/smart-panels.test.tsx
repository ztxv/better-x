// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyPatch, DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../lib/settings';
import { freshEnvironment } from '../test/fakes';
import { FilterPanel } from './FilterPanel';
import { InsightsPanel } from './InsightsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let patches: SettingsPatch[];
let current: Settings;
beforeEach(async () => {
  await freshEnvironment();
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  patches = [];
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness({ panel, initial }: { panel: 'filter' | 'insights'; initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  current = settings;
  const onChange = (patch: SettingsPatch) => {
    patches.push(patch);
    setSettings((s) => applyPatch(s, patch));
  };
  return createElement(panel === 'filter' ? FilterPanel : InsightsPanel, { settings, onChange });
}
const render = (panel: 'filter' | 'insights', filter: Partial<Settings['filter']> = {}) =>
  act(() =>
    root.render(
      createElement(Harness, {
        panel,
        initial: { ...DEFAULT_SETTINGS, filter: { ...DEFAULT_SETTINGS.filter, ...filter } },
      }),
    ),
  );

function type(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });
const picker = () => host.querySelector<HTMLInputElement>('input[role="combobox"]')!;
const chips = () => [...host.querySelectorAll('.chip-row li')].map((li) => li.textContent?.trim());
const button = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
  )!;
const radio = (name: string, text: string) =>
  [...host.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].find((r) =>
    r.closest('label')!.textContent!.includes(text),
  )!;

describe('Smart filtering panel', () => {
  it('shows the defaults: nothing chosen, collapse, posts and quotes', () => {
    render('filter');
    expect(chips()).toEqual([]);
    expect(host.textContent).toContain('nothing is filtered and nothing is looked up');
    expect(radio('filter-mode', 'Collapse').checked).toBe(true);
    const boxes = [...host.querySelectorAll<HTMLInputElement>('.check-row input')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true]);
  });

  it('searches countries, picks several with the keyboard, and removes one', () => {
    render('filter');
    type(picker(), 'germ');
    const options = [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    expect(options[0]).toContain('Germany');
    expect(picker().getAttribute('aria-expanded')).toBe('true');
    key(picker(), 'Enter');
    expect(patches.at(-1)).toEqual({ filter: { countries: ['Germany'] } });
    type(picker(), 'south asia');
    key(picker(), 'Enter');
    expect(current.filter.countries).toEqual(['Germany', 'South Asia']);
    expect(chips()).toEqual(['🇩🇪 Germany', '🌐 South Asia']);
    act(() => button('Remove Germany').click());
    expect(current.filter.countries).toEqual(['South Asia']);
  });

  it('does not offer a place that is already chosen, and ignores a search with no match', () => {
    render('filter', { countries: ['Germany'] });
    type(picker(), 'germany');
    expect([...host.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual([]);
    type(picker(), 'qqqqq');
    key(picker(), 'Enter');
    expect(patches).toEqual([]);
  });

  it('clears all, and closes the list on Escape', () => {
    render('filter', { countries: ['Germany', 'France'] });
    act(() => button('Clear all').click());
    expect(current.filter.countries).toEqual([]);
    type(picker(), 'jap');
    key(picker(), 'Escape');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(picker().value).toBe('');
  });

  it('changes the mode and where it applies', () => {
    render('filter');
    act(() => radio('filter-mode', 'Hide').click());
    expect(current.filter.mode).toBe('hide');
    act(() => radio('filter-mode', 'Highlight').click());
    expect(current.filter.mode).toBe('highlight');
    const [posts, quotes] = [...host.querySelectorAll<HTMLInputElement>('.check-row input')];
    act(() => quotes!.click());
    expect(current.filter.quotes).toBe(false);
    expect(current.filter.posts).toBe(true);
    act(() => posts!.click());
    expect(current.filter.posts).toBe(false);
  });

  it('adds Always Show accounts as people type them, rejects bad and repeated ones, removes', () => {
    render('filter');
    const input = () => host.querySelector<HTMLInputElement>('.handle-form input')!;
    const add = () =>
      act(() => host.querySelector<HTMLFormElement>('.handle-form')!.requestSubmit());
    type(input(), '@Some_One');
    add();
    expect(current.filter.alwaysShow).toEqual([{ handle: 'some_one' }]);
    expect(input().value).toBe('');
    type(input(), 'someone with space');
    add();
    expect(host.querySelector('[role="alert"]')!.textContent).toMatch(/Enter an X username/);
    type(input(), 'some_one');
    add();
    expect(host.querySelector('[role="alert"]')!.textContent).toMatch(/already on the list/);
    expect(current.filter.alwaysShow).toHaveLength(1);
    act(() => button('Remove @some_one from the list').click());
    expect(current.filter.alwaysShow).toEqual([]);
  });

  it('says plainly that it only changes the person’s own view', () => {
    render('filter');
    expect(host.textContent).toMatch(/nobody is blocked, muted or reported/);
  });
});

describe('Account insights panel', () => {
  it('offers three lookup modes with the conservative one chosen', () => {
    render('insights');
    expect(radio('lookup-mode', 'point at it').checked).toBe(true);
    expect(host.querySelectorAll('input[name="lookup-mode"]')).toHaveLength(3);
  });

  it('changes the lookup mode', () => {
    render('insights');
    act(() => radio('lookup-mode', 'Only when I click').click());
    expect(current.insights.lookup).toBe('manual');
    act(() => radio('lookup-mode', 'Automatically').click());
    expect(current.insights.lookup).toBe('visible');
  });

  it('counts the cache and clears it', async () => {
    await chrome.storage.local.set({
      'bx.accounts': {
        v: 1,
        entries: {
          a: { state: 'missing', at: Date.now() },
          b: { state: 'missing', at: Date.now() },
        },
      },
    });
    render('insights');
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.textContent).toContain('2 accounts cached');
    // The fake storage has no remove(); the panel clears through the real API shape.
    (chrome.storage.local as unknown as { remove: (k: string) => Promise<void> }).remove = async (
      k: string,
    ) => {
      await chrome.storage.local.set({ [k]: undefined });
    };
    await act(async () => {
      button('Clear account cache').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Account cache cleared.');
  });
});
