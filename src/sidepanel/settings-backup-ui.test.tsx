// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../lib/settings';
import { freshEnvironment } from '../test/fakes';
import { SettingsBackup } from './SettingsBackup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
};

beforeEach(async () => {
  await freshEnvironment();
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const button = (label: RegExp | string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    typeof label === 'string' ? b.textContent?.trim() === label : label.test(b.textContent ?? ''),
  )!;
const status = () => host.querySelector('.backup-status')?.textContent ?? '';
const preview = () => host.querySelector('.backup-preview');

async function mount(settings: Settings = DEFAULT_SETTINGS) {
  const apply = vi.fn(saveSettings);
  await act(async () => root.render(createElement(SettingsBackup, { settings, apply })));
  return apply;
}
async function choose(contents: string, name = 'in.json') {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
}
const backup = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 'better-x-settings',
    version: 1,
    features: { 'cleanup.hideAds': true, 'posts.hideViews': true, 'future.thing': true },
    values: { 'appearance.sidebarWidth': 300, 'appearance.timelineWidth': 705 },
    appearance: { theme: 'dark' },
    ...extra,
  });

describe('settings backup interface', () => {
  it('names its buttons apart from the Library’s and explains what travels', async () => {
    await mount();
    expect(button('Export customization settings')).toBeTruthy();
    expect(button('Import customization settings')).toBeTruthy();
    expect(host.textContent).toContain(
      'Transfer your Better X customization settings between browsers without an account.',
    );
  });

  it('exports a dated JSON file with the configured settings and says so', async () => {
    const urls: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (
      urls.push(blob),
      'blob:x'
    )) as typeof URL.createObjectURL;
    URL.revokeObjectURL = () => {};
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    await saveSettings({
      features: { 'cleanup.hideAds': true },
      values: { 'appearance.navSpacing': 4 },
    });
    await mount(await loadSettings());
    await act(async () => button('Export customization settings').click());
    expect(clicks[0]).toMatch(/^better-x-settings-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await urls[0]!.text());
    expect(data).toMatchObject({
      format: 'better-x-settings',
      version: 3,
      features: { 'cleanup.hideAds': true },
      values: { 'appearance.navSpacing': 4 },
    });
    expect(status()).toContain('Exported 2 settings');
  });

  it('previews counts only, defaults to merge, and changes nothing until it is confirmed', async () => {
    const apply = await mount();
    await choose(backup());
    expect(preview()).not.toBeNull();
    const text = preview()!.textContent!;
    expect(text).toContain('6 settings found');
    expect(text).toContain('4 recognized');
    expect(text).toContain('1 unsupported');
    expect(text).toContain('1 with an invalid value');
    // Nothing from the file is shown: not its ids, values or file name.
    expect(text).not.toContain('future.thing');
    expect(text).not.toContain('hideAds');
    expect(host.querySelector<HTMLInputElement>('input[type="radio"]')!.checked).toBe(true);
    expect(apply).not.toHaveBeenCalled();
    expect((await loadSettings()).features).toEqual({});
    await act(async () => button('Cancel').click());
    expect(preview()).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('merges on confirm, keeps what the file does not name, and reports the result', async () => {
    await saveSettings({ features: { 'sidebar.hideFooter': true }, accent: 'pink' });
    const apply = await mount(await loadSettings());
    await choose(backup());
    await act(async () => button('Merge').click());
    await flush();
    expect(apply).toHaveBeenCalledTimes(1);
    const stored = await loadSettings();
    expect(stored.features).toEqual({
      'sidebar.hideFooter': true,
      'cleanup.hideAds': true,
      'posts.hideViews': true,
    });
    expect(stored.values).toEqual({ 'appearance.sidebarWidth': 300 });
    expect([stored.theme, stored.accent]).toEqual(['dark', 'pink']);
    expect(status()).toMatch(/Imported 4 settings: 4 changes applied, 2 ignored\./);
    expect(preview()).toBeNull();
  });

  it('replaces on request: the file becomes the whole customization', async () => {
    await saveSettings({
      features: { 'sidebar.hideFooter': true },
      values: { 'appearance.navSpacing': 2 },
    });
    await mount(await loadSettings());
    await choose(backup());
    await act(async () => {
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click();
    });
    expect(host.querySelector('.backup-actions')!.textContent).toContain('Replace');
    await act(async () => button('Replace').click());
    await flush();
    const stored = await loadSettings();
    expect(stored.features).toEqual({ 'cleanup.hideAds': true, 'posts.hideViews': true });
    expect(stored.values).toEqual({ 'appearance.sidebarWidth': 300 });
  });

  it('says plainly when nothing would change', async () => {
    await saveSettings({ features: { 'cleanup.hideAds': true } });
    await mount(await loadSettings());
    await choose(backup({ features: { 'cleanup.hideAds': true }, values: {}, appearance: {} }));
    expect(host.querySelector('.backup-effect')!.textContent).toContain('Nothing would change');
    await act(async () => button('Merge').click());
    await flush();
    expect(status()).toContain('No changes needed');
  });

  it.each([
    ['not JSON', '{oops', /not valid JSON/],
    ['a Library backup', JSON.stringify({ format: 'better-x', version: 1 }), /Library backup/],
    ['a newer version', backup({ version: 7 }), /newer Better X/],
    ['the wrong shape', backup({ features: [1] }), /damaged/],
  ])('shows a clear error for %s and changes nothing', async (_, contents, message) => {
    await saveSettings({ features: { 'cleanup.hideAds': true } });
    const before = await loadSettings();
    const apply = await mount(before);
    await choose(contents);
    expect(status()).toMatch(message);
    expect(host.querySelector('.backup-status')!.className).toContain('is-error');
    expect(preview()).toBeNull();
    expect(apply).not.toHaveBeenCalled();
    expect(await loadSettings()).toEqual(before);
  });

  it('reports a failed write without claiming success', async () => {
    const apply = vi.fn(async () => {
      throw new Error('quota');
    });
    await act(async () =>
      root.render(createElement(SettingsBackup, { settings: DEFAULT_SETTINGS, apply })),
    );
    await choose(backup());
    await act(async () => button('Merge').click());
    await flush();
    expect(status()).toContain('Nothing was changed');
  });

  it('refuses an oversized file before reading it', async () => {
    await mount();
    await choose('x'.repeat(300 * 1024));
    expect(status()).toContain('too large');
    expect(preview()).toBeNull();
  });
});
