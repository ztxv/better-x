// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES } from '../features';
import {
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
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const switches = () => [...host.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
const switchFor = (title: string) =>
  switches().find(
    (input) => input.closest('label')!.querySelector('strong')!.textContent === title,
  )!;

/** Customize wired to a settings object, the way the panel wires it to storage. */
function Harness({
  initial,
  onPatch,
}: {
  initial: Settings;
  onPatch?: (patch: SettingsPatch) => void;
}) {
  const [settings, setSettings] = useState(initial);
  return createElement(Customize, {
    settings,
    onChange: (patch: SettingsPatch) => {
      onPatch?.(patch);
      setSettings((current) =>
        normalizeSettings({ ...current, features: { ...current.features, ...patch.features } }),
      );
    },
  });
}

describe('Customize', () => {
  it('lists every feature under its category heading, all off by default', () => {
    act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS })));
    expect(switches()).toHaveLength(FEATURES.length);
    expect(FEATURES.length).toBeGreaterThanOrEqual(3);
    expect([...host.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Clean up',
      'Home & feed',
    ]);
    expect(switches().every((input) => !input.checked)).toBe(true);
    for (const feature of FEATURES) expect(host.textContent).toContain(feature.description);
  });

  it('puts each feature under the right heading', () => {
    act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS })));
    const group = (title: string) =>
      [...host.querySelectorAll('section')].find(
        (section) => section.querySelector('h2')!.textContent === title,
      )!.textContent;
    expect(group('Clean up')).toContain('Hide Ads');
    expect(group('Clean up')).toContain('Hide Grok');
    expect(group('Clean up')).not.toContain('Hide For You');
    expect(group('Home & feed')).toContain('Hide For You');
  });

  it('shows stored toggles as on and the rest as off', () => {
    const initial = normalizeSettings({ features: { 'cleanup.hideGrok': true } });
    act(() => root.render(createElement(Harness, { initial })));
    expect(switchFor('Hide Grok').checked).toBe(true);
    expect(switchFor('Hide Ads').checked).toBe(false);
    expect(switchFor('Hide For You').checked).toBe(false);
  });

  it('writes only the toggled feature, and the switch follows immediately', () => {
    const patches: SettingsPatch[] = [];
    act(() =>
      root.render(
        createElement(Harness, { initial: DEFAULT_SETTINGS, onPatch: (p) => patches.push(p) }),
      ),
    );
    act(() => switchFor('Hide For You').click());
    expect(patches).toEqual([{ features: { 'feed.hideForYou': true } }]);
    expect(switchFor('Hide For You').checked).toBe(true);
    expect(switchFor('Hide Ads').checked).toBe(false);
    act(() => switchFor('Hide For You').click());
    expect(patches[1]).toEqual({ features: { 'feed.hideForYou': false } });
    expect(switchFor('Hide For You').checked).toBe(false);
  });

  it('exposes real switches that keyboard and screen-reader users can use', () => {
    act(() => root.render(createElement(Harness, { initial: DEFAULT_SETTINGS })));
    for (const input of switches()) {
      expect(input.type).toBe('checkbox');
      expect(input.getAttribute('role')).toBe('switch');
      expect(input.tabIndex).toBeGreaterThanOrEqual(0);
      // The label wraps the switch, so the title and description name it.
      expect(input.closest('label')!.textContent).toMatch(/\S/);
    }
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
