// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, featureRegistry } from '../features';
import { PRESETS } from '../features/presets';
import { CATEGORY_TITLES } from '../features/types';
import {
  applyPatch,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
  type SettingsPatch,
} from '../lib/settings';
import { Customize } from './Customize';
import { SectionTabs, type Section } from './SectionTabs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* happy-dom always has it; real storage may not. */
  }
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const switches = () => [...host.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
const switchFor = (title: string) =>
  switches().find(
    (input) => input.closest('label')!.querySelector('strong')!.textContent === title,
  )!;
const titles = () => [...host.querySelectorAll('.setting-toggle strong')].map((n) => n.textContent);
const groupTitles = () =>
  [...host.querySelectorAll('.customize-group .group-name')].map((n) => n.textContent);
const group = (category: string) =>
  host.querySelector<HTMLElement>(`section[data-category="${category}"]`)!;
const search = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
const button = (label: string | RegExp) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    typeof label === 'string'
      ? b.textContent?.trim() === label || b.getAttribute('aria-label') === label
      : label.test(b.textContent ?? '') || label.test(b.getAttribute('aria-label') ?? ''),
  )!;

/** Types into a controlled input the way a user does, so React sees the change. */
function type(input: HTMLInputElement, value: string) {
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Customize wired to a settings object, the way the panel wires it to storage. */
function Harness({
  initial,
  onPatch,
  hidden = false,
}: {
  initial: Settings;
  onPatch?: (patch: SettingsPatch) => void;
  hidden?: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  return createElement(Customize, {
    settings,
    hidden,
    onChange: (patch: SettingsPatch) => {
      onPatch?.(patch);
      setSettings((current) => applyPatch(current, patch));
    },
  });
}
const render = (props: Partial<Parameters<typeof Harness>[0]> = {}) =>
  act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS, ...props })));

describe('Customize', () => {
  it('lists every feature under its category heading, all off by default', () => {
    render();
    expect(switches()).toHaveLength(FEATURES.length);
    expect(FEATURES.length).toBeGreaterThanOrEqual(60);
    expect(groupTitles()).toEqual(Object.values(CATEGORY_TITLES));
    expect(switches().every((input) => !input.checked)).toBe(true);
    for (const feature of FEATURES) expect(host.textContent).toContain(feature.description);
  });

  it('puts each feature under the right heading', () => {
    render();
    const inGroup = (category: string) =>
      [...group(category).querySelectorAll('.setting-toggle strong')].map((n) => n.textContent);
    for (const category of Object.keys(CATEGORY_TITLES))
      expect(inGroup(category)).toEqual(
        FEATURES.filter((feature) => feature.category === category).map((feature) => feature.title),
      );
    expect(inGroup('cleanup')).toContain('Hide Ads');
    expect(inGroup('cleanup')).toContain('Hide Grok');
    expect(inGroup('cleanup')).not.toContain('Hide For You');
    expect(inGroup('feed')).toContain('Hide For You');
  });

  it('shows stored toggles as on and the rest as off', () => {
    render({ initial: normalizeSettings({ features: { 'cleanup.hideGrok': true } }) });
    expect(switchFor('Hide Grok').checked).toBe(true);
    expect(switchFor('Hide Ads').checked).toBe(false);
    expect(switchFor('Hide For You').checked).toBe(false);
  });

  it('writes only the toggled feature, and the switch follows immediately', () => {
    const patches: SettingsPatch[] = [];
    render({ onPatch: (p) => patches.push(p) });
    act(() => switchFor('Hide For You').click());
    expect(patches).toEqual([{ features: { 'feed.hideForYou': true } }]);
    expect(switchFor('Hide For You').checked).toBe(true);
    expect(switchFor('Hide Ads').checked).toBe(false);
    act(() => switchFor('Hide For You').click());
    expect(patches[1]).toEqual({ features: { 'feed.hideForYou': false } });
    expect(switchFor('Hide For You').checked).toBe(false);
  });

  it('exposes real switches that keyboard and screen-reader users can use', () => {
    render();
    for (const input of switches()) {
      expect(input.type).toBe('checkbox');
      expect(input.getAttribute('role')).toBe('switch');
      expect(input.tabIndex).toBeGreaterThanOrEqual(0);
      // The label wraps the switch, so the title and description name it.
      expect(input.closest('label')!.textContent).toMatch(/\S/);
    }
  });

  it('stays mounted, with its state, while the Library is showing', () => {
    render();
    type(search(), 'sidebar');
    const before = host.querySelector<HTMLElement>('#customize-panel')!;
    act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS, hidden: true })));
    expect(host.querySelector('#customize-panel')).toBe(before);
    expect(before.hidden).toBe(true);
    expect(search().value).toBe('sidebar');
    act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS, hidden: false })));
    expect(before.hidden).toBe(false);
    expect(search().value).toBe('sidebar');
  });
});

describe('Customize search', () => {
  it('filters by title, description and keywords, and names how many it found', () => {
    render();
    type(search(), 'ads');
    expect(titles()).toContain('Hide Ads');
    type(search(), 'counts');
    expect(titles().length).toBeGreaterThan(3);
    expect(titles().length).toBeLessThan(FEATURES.length / 4);
    expect(titles()).toContain('Hide like counts');
    expect(host.querySelector('.customize-summary')!.textContent).toBe(
      `${titles().length} settings found`,
    );
    // A keyword that is not in the title or description.
    type(search(), 'chirp');
    expect(titles()).toEqual(['Use the system font']);
    expect(host.querySelector('.customize-summary')!.textContent).toBe('1 setting found');
  });

  it('does not match a category’s name, which the chips are for', () => {
    render();
    // "Ads, Grok & Premium" must not make every one of its settings an answer for "ads".
    type(search(), 'premium');
    expect(titles()).not.toContain('Hide Ads');
    expect(titles()).toContain('Hide Premium upsells');
  });

  it('needs every word, ignores case and the apostrophe, and opens the groups it found', () => {
    render();
    type(search(), 'WHATS happening');
    expect(titles()).toEqual(['Hide “What’s happening”']);
    expect(group('sidebar').dataset.open).toBe('true');
    expect(group('sidebar').querySelector('.group-toggle')!.getAttribute('aria-expanded')).toBe(
      'true',
    );
    type(search(), 'sidebar search');
    expect(titles().length).toBeGreaterThan(0);
    type(search(), 'sidebar zzzz');
    expect(titles()).toEqual([]);
  });

  it('shows a clear empty state with a way back', () => {
    render();
    type(search(), 'qqqq');
    const empty = host.querySelector('.customize-empty')!;
    expect(empty.textContent).toContain('No settings match “qqqq”');
    expect(groupTitles()).toEqual([]);
    act(() => button('Clear search').click());
    expect(search().value).toBe('');
    expect(host.querySelector('.customize-empty')).toBeNull();
    expect(groupTitles()).toHaveLength(Object.keys(CATEGORY_TITLES).length);
  });

  it('clears with the button and with Escape, and hides Quick setups while searching', () => {
    render();
    expect(host.querySelector('.presets')).not.toBeNull();
    type(search(), 'ads');
    expect(host.querySelector('.presets')).toBeNull();
    act(() => {
      search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(search().value).toBe('');
    type(search(), 'ads');
    act(() => button('Clear search').click());
    expect(search().value).toBe('');
    expect(host.querySelector('.presets')).not.toBeNull();
  });

  it('focuses the search with the slash key, but not while typing or with a dialog open', () => {
    render();
    const press = (target: EventTarget) =>
      act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
      });
    press(document.body);
    expect(document.activeElement).toBe(search());
    search().blur();
    const other = host.appendChild(document.createElement('input'));
    other.focus();
    press(other);
    expect(document.activeElement).toBe(other);
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('aria-modal', 'true');
    press(document.body);
    expect(document.activeElement).toBe(other);
    dialog.remove();
  });
});

describe('Customize categories and groups', () => {
  it('shows one category from its chip and counts what is on in each', () => {
    render({ initial: normalizeSettings({ features: { 'sidebar.hideFooter': true } }) });
    expect(button(/^Sidebar/).querySelector('.category-chip-count')!.textContent).toBe('1');
    expect(button(/^All/).querySelector('.category-chip-count')!.textContent).toBe('1');
    expect(button(/^Posts/).querySelector('.category-chip-count')).toBeNull();
    act(() => button(/^Sidebar/).click());
    expect(groupTitles()).toEqual(['Sidebar']);
    expect(button(/^Sidebar/).getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.presets')).toBeNull();
    act(() => button(/^All/).click());
    expect(groupTitles()).toHaveLength(Object.keys(CATEGORY_TITLES).length);
  });

  it('opens and closes a group from its header, and a closed group is inert', () => {
    render();
    const toggle = () => group('posts').querySelector<HTMLButtonElement>('.group-toggle')!;
    const panel = () => group('posts').querySelector<HTMLElement>('.group-panel')!;
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(panel().inert).toBe(true);
    act(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(panel().inert).toBe(false);
    expect(panel().getAttribute('aria-labelledby')).toBe(toggle().id);
    expect(toggle().getAttribute('aria-controls')).toBe(panel().id);
    act(() => toggle().click());
    expect(panel().inert).toBe(true);
  });

  it('starts with Navigation open and remembers which groups were open', () => {
    render();
    expect(group('navigation').dataset.open).toBe('true');
    expect(group('feed').dataset.open).toBe('false');
    act(() => group('feed').querySelector<HTMLButtonElement>('.group-toggle')!.click());
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(group('feed').dataset.open).toBe('true');
    expect(group('navigation').dataset.open).toBe('true');
  });

  it('shows how many of a group are on, and a reset only when something differs', () => {
    render({
      initial: normalizeSettings({
        features: { 'sidebar.hideFooter': true, 'sidebar.hideSidebar': true },
      }),
    });
    const count = group('sidebar').querySelector('.group-count')!;
    expect(count.textContent).toBe(`2/${FEATURES.filter((f) => f.category === 'sidebar').length}`);
    expect(group('sidebar').querySelector('.group-reset')).not.toBeNull();
    expect(group('posts').querySelector('.group-reset')).toBeNull();
  });

  it('resets one group to its defaults without touching the others', () => {
    const patches: SettingsPatch[] = [];
    render({
      initial: normalizeSettings({
        features: { 'sidebar.hideFooter': true, 'posts.hideViews': true },
        values: { 'appearance.sidebarWidth': 300 },
      }),
      onPatch: (patch) => patches.push(patch),
    });
    act(() => group('sidebar').querySelector<HTMLButtonElement>('.group-reset')!.click());
    const patch = patches[0]!;
    const sidebarIds = FEATURES.filter((f) => f.category === 'sidebar').map((f) => f.id);
    expect(Object.keys(patch.features!).sort()).toEqual([...sidebarIds].sort());
    expect(Object.values(patch.features!).every((v) => v === null)).toBe(true);
    expect(patch.values).toEqual({});
    expect(switchFor('Hide footer links').checked).toBe(false);
    expect(switchFor('Hide view counts').checked).toBe(true);
  });

  it('resets everything only after a second, explicit step', () => {
    const patches: SettingsPatch[] = [];
    render({
      initial: normalizeSettings({ features: { 'posts.hideViews': true } }),
      onPatch: (patch) => patches.push(patch),
    });
    act(() => button(/Turn everything off/).click());
    expect(patches).toEqual([]);
    act(() => button('Keep').click());
    expect(patches).toEqual([]);
    act(() => button(/Turn everything off/).click());
    act(() => button('Turn off').click());
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0]!.features!)).toHaveLength(FEATURES.length);
    expect(Object.values(patches[0]!.features!).every((v) => v === null)).toBe(true);
    expect(switchFor('Hide view counts').checked).toBe(false);
    expect(host.querySelector('.customize-footer')).toBeNull();
  });
});

describe('Customize sliders', () => {
  const width = FEATURES.find((f) => f.id === 'appearance.timelineWidth')!;
  const rangeFor = (title: string) =>
    [...host.querySelectorAll<HTMLInputElement>('input[type="range"]')].find(
      (r) => r.getAttribute('aria-label') === `${title} value`,
    )!;
  const setRange = (input: HTMLInputElement, value: number) =>
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

  it('gives each slider feature a range with its real limits, disabled until it is on', () => {
    render();
    const sliders = FEATURES.filter((f) => f.kind === 'slider');
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(sliders.length);
    for (const feature of sliders) {
      if (feature.kind !== 'slider') continue;
      const range = rangeFor(feature.title);
      expect([range.min, range.max, range.step]).toEqual([
        String(feature.min),
        String(feature.max),
        String(feature.step),
      ]);
      expect(range.disabled).toBe(true);
      expect(range.value).toBe(String(feature.defaultValue));
    }
    expect(host.textContent).toContain('Turn on to adjust.');
  });

  it('enables with its switch, and names its value and unit for assistive technology', () => {
    render();
    act(() => switchFor('Timeline width').click());
    const range = rangeFor('Timeline width');
    expect(range.disabled).toBe(false);
    expect(range.getAttribute('aria-valuetext')).toBe('700 px');
    expect(host.querySelector('.slider-value')!.textContent).toBeTruthy();
  });

  it('shows a stored number, and a stored number outside the range as the nearest limit', () => {
    render({
      initial: normalizeSettings({
        features: { 'appearance.timelineWidth': true, 'appearance.sidebarWidth': true },
        values: { 'appearance.timelineWidth': 820, 'appearance.sidebarWidth': 99999 },
      }),
    });
    expect(rangeFor('Timeline width').value).toBe('820');
    expect(rangeFor('Sidebar width').value).toBe('450');
  });

  it('writes while it moves, at most every 80 ms, then once more where it stops', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const patches: SettingsPatch[] = [];
    render({
      initial: normalizeSettings({ features: { 'appearance.timelineWidth': true } }),
      onPatch: (patch) => patches.push(patch),
    });
    const range = rangeFor('Timeline width');
    setRange(range, 720);
    expect(patches).toEqual([{ values: { 'appearance.timelineWidth': 720 } }]);
    setRange(range, 730);
    setRange(range, 740);
    setRange(range, 750);
    expect(patches).toHaveLength(1);
    expect(range.value).toBe('750');
    act(() => vi.advanceTimersByTime(80));
    expect(patches).toHaveLength(2);
    expect(patches[1]).toEqual({ values: { 'appearance.timelineWidth': 750 } });
    setRange(range, 760);
    act(() => {
      range.dispatchEvent(new Event('pointerup', { bubbles: true }));
    });
    expect(patches[2]).toEqual({ values: { 'appearance.timelineWidth': 760 } });
    act(() => vi.advanceTimersByTime(500));
    expect(patches).toHaveLength(3);
  });

  it('resets to its default with the reset button, which is idle at the default', () => {
    const patches: SettingsPatch[] = [];
    render({
      initial: normalizeSettings({
        features: { 'appearance.timelineWidth': true },
        values: { 'appearance.timelineWidth': 880 },
      }),
      onPatch: (patch) => patches.push(patch),
    });
    const reset = () =>
      host.querySelector<HTMLButtonElement>('button[aria-label^="Reset Timeline width"]')!;
    expect(reset().disabled).toBe(false);
    expect(reset().getAttribute('aria-label')).toBe('Reset Timeline width to 700 px');
    act(() => reset().click());
    expect(patches).toEqual([{ values: { 'appearance.timelineWidth': 700 } }]);
    expect(rangeFor('Timeline width').value).toBe('700');
    expect(reset().disabled).toBe(true);
  });

  it('keeps its switch and its number as separate settings', () => {
    const patches: SettingsPatch[] = [];
    render({ onPatch: (patch) => patches.push(patch) });
    act(() => switchFor(width.title).click());
    expect(patches).toEqual([{ features: { 'appearance.timelineWidth': true } }]);
  });
});

describe('Customize quick setups', () => {
  it('offers Clean, Minimal and Focus', () => {
    render();
    expect([...host.querySelectorAll('.preset strong')].map((n) => n.textContent).sort()).toEqual([
      'Clean',
      'Focus',
      'Minimal',
    ]);
  });

  it('applies exactly the preset: its switches on, every other customization off, nothing else touched', () => {
    const patches: SettingsPatch[] = [];
    render({
      initial: normalizeSettings({
        accent: 'pink',
        afterSave: 'quiet',
        features: { 'posts.plainText': true },
      }),
      onPatch: (patch) => patches.push(patch),
    });
    act(() => button(/^Clean/).click());
    expect(Object.keys(patches[0]!).sort()).toEqual(['features', 'values']);
    const clean = PRESETS.find((p) => p.id === 'clean')!;
    const on = Object.entries(patches[0]!.features!)
      .filter(([, v]) => v === true)
      .map(([id]) => id)
      .sort();
    expect(on).toEqual([...clean.features].sort());
    expect(switchFor('Hide Ads').checked).toBe(true);
    expect(switchFor('Plain post text').checked).toBe(false);
    expect(button(/^Clean/).getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.preset-notice')!.textContent).toContain('Clean applied');
  });

  it('puts everything back with Undo, including numbers that were set', () => {
    const initial = normalizeSettings({
      features: { 'posts.plainText': true, 'appearance.sidebarWidth': true },
      values: { 'appearance.sidebarWidth': 300 },
    });
    const after: Settings[] = [];
    function Spy() {
      const [settings, setSettings] = useState(initial);
      after.push(settings);
      return createElement(Customize, {
        settings,
        onChange: (patch: SettingsPatch) => setSettings((c) => applyPatch(c, patch)),
      });
    }
    act(() => root.render(createElement(Spy)));
    act(() => button(/^Focus/).click());
    expect(after.at(-1)!.features['posts.plainText']).toBeUndefined();
    act(() => button(/Undo/).click());
    expect(after.at(-1)!.features).toEqual(initial.features);
    expect(after.at(-1)!.values).toEqual(initial.values);
    expect(host.querySelector('.preset-notice')).toBeNull();
  });

  it('drops the Undo notice once something is changed by hand', () => {
    render();
    act(() => button(/^Minimal/).click());
    expect(host.querySelector('.preset-notice')).not.toBeNull();
    act(() => switchFor('Hide Jobs').click());
    expect(host.querySelector('.preset-notice')).toBeNull();
  });
});

describe('Customize styles stay out of the Library', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'styles.css'), 'utf8');

  it('does not restyle the Library’s generic chips (the Downloaded badge broke when it did)', () => {
    const rules = [...css.matchAll(/(^|\n)\.chip(?:[:\[\s.,{])[^{]*\{/g)];
    // `.chip` is the Library's own label; the category buttons here have their own class.
    expect(rules.filter((m) => /^\n?\.chip\s*\{/.test(m[0]))).toHaveLength(1);
    expect(css).toContain('.category-chip {');
    expect(css).toMatch(/\.download-chip \{[^}]*min-width: 0/);
  });
});

describe('Customize motion', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'styles.css'), 'utf8');
  const customizeCss = css.slice(css.indexOf('.customize {'), css.indexOf('.customize-footer'));

  it('keeps every transition and animation in the Customize view between 0 and 220 ms', () => {
    const durations = [...customizeCss.matchAll(/(?:transition|animation)[^;]*?(\d+)ms/g)].map(
      (m) => Number(m[1]),
    );
    expect(durations.length).toBeGreaterThan(10);
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(120);
      expect(ms).toBeLessThanOrEqual(220);
    }
  });

  it('turns all motion off under prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });

  it('animates only transform, opacity, colors and one grid track: nothing that reflows the page', () => {
    for (const match of customizeCss.matchAll(/transition:\s*([^;]+);/g)) {
      const properties = match[1]!.split(',').map((part) => part.trim().split(/\s+/)[0]!);
      for (const property of properties)
        expect([
          'transform',
          'opacity',
          'color',
          'background-color',
          'border-color',
          'grid-template-rows',
          'visibility',
        ]).toContain(property);
    }
  });

  it('does not animate the cards on every render, only when they appear', () => {
    expect(customizeCss).toMatch(/\.customize-group \{[^}]*animation: customize-in/);
    expect(customizeCss).not.toMatch(/infinite/);
  });
});

describe('Library | Customize tabs', () => {
  function Tabs({ onChange }: { onChange?: (s: Section) => void }) {
    const [section, setSection] = useState<Section>('library');
    return createElement(SectionTabs, {
      section,
      onChange: (next: Section) => {
        onChange?.(next);
        setSection(next);
      },
    });
  }
  const tab = (id: string) => host.querySelector<HTMLElement>(`#${id}-tab`)!;

  it('starts on the Library with only the selected tab in the Tab order', () => {
    act(() => root.render(createElement(Tabs)));
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tab('library').getAttribute('aria-selected')).toBe('true');
    expect(tab('customize').getAttribute('aria-selected')).toBe('false');
    expect(tab('library').tabIndex).toBe(0);
    expect(tab('customize').tabIndex).toBe(-1);
  });

  it('switches on click and with the arrow keys, moving focus with the selection', () => {
    const seen: Section[] = [];
    act(() => root.render(createElement(Tabs, { onChange: (s) => seen.push(s) })));
    act(() => tab('customize').click());
    expect(tab('customize').getAttribute('aria-selected')).toBe('true');
    expect(tab('customize').tabIndex).toBe(0);
    act(() => {
      tab('customize').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );
    });
    expect(tab('library').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('library'));
    expect(seen).toEqual(['customize', 'library']);
  });

  it('ignores other keys', () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(Tabs, { onChange })));
    act(() => {
      tab('library').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
