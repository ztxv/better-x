// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyPatch, DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../lib/settings';
import { freshEnvironment } from '../test/fakes';
import { XMODE_CACHE_KEY } from '../themes/host';
import { PRESETS } from '../themes/presets';
import { SectionTabs, type Section } from './SectionTabs';
import { Themes } from './Themes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let data: Record<string, unknown>;
let patches: SettingsPatch[];
let current: Settings;

beforeEach(async () => {
  ({ data } = await freshEnvironment());
  patches = [];
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Themes with real settings state: every patch is applied as the panel's storage would. */
function Harness({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  current = settings;
  return createElement(Themes, {
    settings,
    onChange: (patch: SettingsPatch) => {
      patches.push(patch);
      setSettings((s) => applyPatch(s, patch));
    },
  });
}
async function mount(initial: Settings = DEFAULT_SETTINGS) {
  await act(async () => root.render(createElement(Harness, { initial })));
}

const cards = () => [...host.querySelectorAll<HTMLButtonElement>('.theme-card')];
const card = (title: string) =>
  cards().find((c) => c.querySelector('strong')!.textContent === title)!;
const pressed = () =>
  cards()
    .filter((c) => c.getAttribute('aria-pressed') === 'true')
    .map((c) => c.querySelector('strong')!.textContent);
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.includes(text),
  )!;
const click = (el: HTMLElement) => act(() => el.click());

function type(input: HTMLInputElement, value: string) {
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    input.focus();
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Themes tab', () => {
  it('lists Lights out, every preset and Custom, with Lights out chosen by default', async () => {
    await mount();
    expect(cards().map((c) => c.querySelector('strong')!.textContent)).toEqual([
      'Lights out',
      ...PRESETS.map((p) => p.title),
      'Custom',
    ]);
    expect(pressed()).toEqual(['Lights out']);
    expect(host.querySelector('#themes-panel')!.getAttribute('aria-labelledby')).toBe('themes-tab');
  });

  it('switches between Dim and Lights out with one click each, writing only xTheme', async () => {
    await mount();
    click(card('Dim'));
    expect(patches.at(-1)).toEqual({ xTheme: { active: 'dim' } });
    expect(pressed()).toEqual(['Dim']);
    click(card('Lights out'));
    expect(patches.at(-1)).toEqual({ xTheme: { active: null } });
    expect(pressed()).toEqual(['Lights out']);
    for (const patch of patches) expect(Object.keys(patch)).toEqual(['xTheme']);
  });

  it('offers Undo after a switch, which puts the previous theme back', async () => {
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'nord' } });
    click(card('Dracula'));
    expect(host.querySelector('.preset-notice')!.textContent).toContain('Dracula on.');
    click(button('Undo'));
    expect(current.xTheme.active).toBe('nord');
    expect(host.querySelector('.preset-notice')).toBeNull();
  });

  it('draws each card’s preview from that theme’s colors', async () => {
    await mount();
    const preview = card('Dim').querySelector<HTMLElement>('.theme-preview')!;
    expect(preview.style.getPropertyValue('--p-bg')).toBe('#15202b');
    expect(preview.style.getPropertyValue('--p-accent')).toBe('#1d9bf0');
    expect(
      card('Lights out')
        .querySelector<HTMLElement>('.theme-preview')!
        .style.getPropertyValue('--p-bg'),
    ).toBe('#000000');
  });

  it('shows the Custom editor only for Custom, and writes one color at a time', async () => {
    await mount();
    expect(host.querySelector('.theme-editor')).toBeNull();
    click(card('Custom'));
    expect(host.querySelector('.theme-editor')).not.toBeNull();
    type(
      host.querySelector<HTMLInputElement>('input[aria-label="Background hex code"]')!,
      '#101820',
    );
    expect(patches.at(-1)).toEqual({ xTheme: { custom: { bg: '#101820' } } });
    expect(current.xTheme.custom.bg).toBe('#101820');
    expect(
      card('Custom').querySelector<HTMLElement>('.theme-preview')!.style.getPropertyValue('--p-bg'),
    ).toBe('#101820');
  });

  it('never stores a half-typed or invalid color', async () => {
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'custom' } });
    const before = patches.length;
    const hex = host.querySelector<HTMLInputElement>('input[aria-label="Text hex code"]')!;
    type(hex, '#12');
    type(hex, 'red;}');
    expect(patches.length).toBe(before);
    expect(hex.getAttribute('aria-invalid')).toBe('true');
  });

  it('warns about a low-contrast pair without blocking it', async () => {
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'custom' } });
    expect(host.querySelector('.theme-warnings')).toBeNull();
    type(host.querySelector<HTMLInputElement>('input[aria-label="Text hex code"]')!, '#111111');
    expect(host.querySelector('.theme-warnings')!.textContent).toContain('hard to read');
    expect(current.xTheme.custom.text).toBe('#111111');
  });

  it('starts Custom from a preset, filling every color', async () => {
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'custom' } });
    const select = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Start from a theme"]',
    )!;
    act(() => {
      select.value = 'nord';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(current.xTheme.custom.bg).toBe('#2e3440');
    expect(current.xTheme.custom.accent).toBe('#88c0d0');
    for (const value of Object.values(current.xTheme.custom))
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    click(button('Reset to Lights out'));
    expect(current.xTheme.custom).toEqual(DEFAULT_SETTINGS.xTheme.custom);
  });

  it('hides the advanced colors until asked', async () => {
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'custom' } });
    const toggle = button('Advanced');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector<HTMLElement>('#theme-advanced')!.hidden).toBe(true);
    click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector<HTMLElement>('#theme-advanced')!.hidden).toBe(false);
  });

  it('has no Chat switch yet (back burner)', async () => {
    await mount();
    expect(host.querySelector('.themes input[role="switch"]')).toBeNull();
  });

  it('says the theme is paused while X is in Default', async () => {
    data[XMODE_CACHE_KEY] = 'light';
    await mount({ ...DEFAULT_SETTINGS, xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'dim' } });
    await act(async () => {});
    expect(host.querySelector('.themes-paused')!.textContent).toContain('Dim is paused');
    await act(async () => chrome.storage.local.set({ [XMODE_CACHE_KEY]: 'dark' }));
    expect(host.querySelector('.themes-paused')).toBeNull();
  });
});

describe('section tabs with Themes', () => {
  function Tabs() {
    const [section, setSection] = useState<Section>('library');
    return createElement(SectionTabs, { section, onChange: setSection });
  }
  const selected = () => host.querySelector('[role="tab"][aria-selected="true"]')!.id;
  const key = (k: string) =>
    act(() => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true }),
      );
    });

  it('cycles through all three tabs with the arrow keys, wrapping at the ends', async () => {
    await act(async () => root.render(createElement(Tabs)));
    act(() => host.querySelector<HTMLElement>('#library-tab')!.focus());
    key('ArrowRight');
    expect(selected()).toBe('customize-tab');
    key('ArrowRight');
    expect(selected()).toBe('themes-tab');
    expect(document.activeElement!.id).toBe('themes-tab');
    key('ArrowRight');
    expect(selected()).toBe('library-tab');
    key('ArrowLeft');
    expect(selected()).toBe('themes-tab');
    key('Home');
    expect(selected()).toBe('library-tab');
    key('End');
    expect(selected()).toBe('themes-tab');
    expect(host.querySelector('#themes-tab')!.getAttribute('aria-controls')).toBe('themes-panel');
    expect(
      [...host.querySelectorAll('[role="tab"]')].filter((t) => t.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
  });
});
