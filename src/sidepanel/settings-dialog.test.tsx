// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingsPatch } from '../lib/settings';
import { freshEnvironment } from '../test/fakes';
import { SettingsDialog } from './SettingsDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
beforeEach(async () => {
  await freshEnvironment();
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(openAs: 'sidepanel' | 'popup' = 'sidepanel') {
  const patches: SettingsPatch[] = [];
  act(() =>
    root.render(
      createElement(SettingsDialog, {
        settings: { ...DEFAULT_SETTINGS, openAs },
        onChange: (patch: SettingsPatch) => patches.push(patch),
        onReset: vi.fn(),
        onClose: vi.fn(),
        onExport: vi.fn(),
        onImport: vi.fn(),
        onClearBookmarks: vi.fn(),
        onClearDownloads: vi.fn(),
        bookmarkCount: 3,
        downloadCount: 1,
      }),
    ),
  );
  return patches;
}
const radio = (label: string) =>
  [...host.querySelectorAll<HTMLLabelElement>('label.radio-option')]
    .find((l) => l.querySelector('strong')!.textContent === label)!
    .querySelector('input')!;

describe('Settings dialog: how Better X opens', () => {
  it('offers the side panel and the popup, with the side panel selected by default', () => {
    render();
    expect(radio('Side panel').checked).toBe(true);
    expect(radio('Popup').checked).toBe(false);
    expect(host.querySelector('[role="radiogroup"][aria-labelledby="open-title"]')).not.toBeNull();
  });

  it('shows the stored choice and writes only that setting when it changes', () => {
    const patches = render('popup');
    expect(radio('Popup').checked).toBe(true);
    act(() => radio('Side panel').click());
    expect(patches).toEqual([{ openAs: 'sidepanel' }]);
  });
});

describe('Settings dialog: data and backup', () => {
  it('keeps the Library and the customization backups apart, each with its own labels', () => {
    render();
    const data = host.querySelector('.data-section')!;
    expect(data.querySelector('h3')!.textContent).toBe('Data & backup');
    expect([...data.querySelectorAll('.data-group')].map((n) => n.textContent)).toEqual([
      'Library',
      'Customization settings',
    ]);
    const labels = [...data.querySelectorAll('button')].map((b) => b.textContent?.trim());
    for (const label of [
      'Export Library',
      'Import Library',
      'Export customization settings',
      'Import customization settings',
    ])
      expect(labels).toContain(label);
    // The Library's destructive actions are not next to the customization buttons.
    const order = labels.filter(Boolean);
    expect(order.indexOf('Clear all bookmarks…')).toBeLessThan(
      order.indexOf('Export customization settings'),
    );
  });

  it('calls the Library handlers from the Library buttons only', () => {
    const exportLibrary = vi.fn();
    const importLibrary = vi.fn();
    act(() =>
      root.render(
        createElement(SettingsDialog, {
          settings: DEFAULT_SETTINGS,
          onChange: vi.fn(),
          onReset: vi.fn(),
          onClose: vi.fn(),
          onExport: exportLibrary,
          onImport: importLibrary,
          onClearBookmarks: vi.fn(),
          onClearDownloads: vi.fn(),
          bookmarkCount: 0,
          downloadCount: 0,
        }),
      ),
    );
    const button = (label: string) =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    act(() => button('Export Library').click());
    act(() => button('Import Library').click());
    expect(exportLibrary).toHaveBeenCalledTimes(1);
    expect(importLibrary).toHaveBeenCalledTimes(1);
  });
});
