// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, saveSettings } from '../lib/settings';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { watchXMode, xMode } from './detect';
import { THEME_STYLE_ID, XMODE_CACHE_KEY, startTheme } from './host';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 5; i++) await flush();
};
const root = () => document.documentElement;
const style = () => document.getElementById(THEME_STYLE_ID);
const painted = () => root().getAttribute('data-bx-theme');

let data: Record<string, unknown>;
beforeEach(async () => {
  ({ data } = await freshEnvironment());
});
afterEach(() => {
  for (const attr of ['data-theme', 'data-bx-theme', 'style']) root().removeAttribute(attr);
  document.body.removeAttribute('style');
  style()?.remove();
});

describe('xMode', () => {
  it('reads data-theme first, then color-scheme, then the body’s inline background', () => {
    expect(xMode()).toBeNull();
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    expect(xMode()).toBe('light');
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    expect(xMode()).toBe('dark');
    document.body.style.backgroundColor = 'rgb(5, 5, 5)';
    expect(xMode()).toBe('dark');
    root().style.colorScheme = 'light';
    expect(xMode()).toBe('light');
    root().setAttribute('data-theme', 'dark');
    expect(xMode()).toBe('dark');
    root().setAttribute('data-theme', 'light');
    expect(xMode()).toBe('light');
    root().setAttribute('data-theme', 'dim');
    expect(xMode()).toBe('light');
  });

  it('is watched, reporting changes only', async () => {
    const scope = new Scope();
    const seen: string[] = [];
    watchXMode(scope, (mode) => seen.push(mode));
    root().setAttribute('data-theme', 'dark');
    await flush();
    root().setAttribute('data-theme', 'dark');
    document.body.style.color = 'red';
    await flush();
    root().setAttribute('data-theme', 'light');
    await flush();
    scope.dispose();
    root().setAttribute('data-theme', 'dark');
    await flush();
    expect(seen).toEqual(['dark', 'light']);
  });
});

describe('startTheme', () => {
  it('does nothing visible with no theme chosen', async () => {
    root().setAttribute('data-theme', 'dark');
    const scope = new Scope();
    startTheme(scope);
    await settle();
    expect(painted()).toBeNull();
    expect(style()?.textContent).toBe('');
    scope.dispose();
  });

  it('paints a chosen theme while X is dark, and steps aside while X is light', async () => {
    root().setAttribute('data-theme', 'dark');
    data[SETTINGS_KEY] = {
      ...DEFAULT_SETTINGS,
      xTheme: { ...DEFAULT_SETTINGS.xTheme, active: 'dim' },
    };
    const scope = new Scope();
    startTheme(scope);
    await settle();
    expect(painted()).toBe('dim');
    expect(style()!.textContent).toContain('--bx-t-bg: #15202b;');
    root().setAttribute('data-theme', 'light');
    await settle();
    expect(painted()).toBeNull();
    root().setAttribute('data-theme', 'dark');
    await settle();
    expect(painted()).toBe('dim');
    scope.dispose();
  });

  it('follows settings live: another preset, custom colors, off', async () => {
    root().setAttribute('data-theme', 'dark');
    const scope = new Scope();
    startTheme(scope);
    await settle();
    await saveSettings({ xTheme: { active: 'nord' } });
    await settle();
    expect(painted()).toBe('nord');
    expect(style()!.textContent).toContain('--bx-t-bg: #2e3440;');
    const rulesBefore = style()!.childNodes[1]!.textContent;
    await saveSettings({ xTheme: { active: 'custom', custom: { bg: '#101820' } } });
    await settle();
    expect(painted()).toBe('custom');
    expect(style()!.textContent).toContain('--bx-t-bg: #101820;');
    expect(style()!.childNodes[1]!.textContent).toBe(rulesBefore);
    await saveSettings({ xTheme: { chat: true } });
    await settle();
    expect(style()!.textContent).toContain('chat-drawer');
    await saveSettings({ xTheme: { active: null } });
    await settle();
    expect(painted()).toBeNull();
    expect(style()!.textContent).toBe('');
    scope.dispose();
  });

  it('paints the first frame from the cached mode before X says anything, and remembers X’s mode', async () => {
    data[SETTINGS_KEY] = { xTheme: { active: 'dracula' } };
    data[XMODE_CACHE_KEY] = 'dark';
    const scope = new Scope();
    startTheme(scope);
    await settle();
    expect(painted()).toBe('dracula');
    root().setAttribute('data-theme', 'light');
    await settle();
    expect(painted()).toBeNull();
    expect(data[XMODE_CACHE_KEY]).toBe('light');
    scope.dispose();
  });

  it('does not paint when X’s mode is unknown and nothing is cached', async () => {
    data[SETTINGS_KEY] = { xTheme: { active: 'dracula' } };
    const scope = new Scope();
    startTheme(scope);
    await settle();
    expect(painted()).toBeNull();
    scope.dispose();
  });

  it('removes its style and attribute when disposed, and stops following', async () => {
    root().setAttribute('data-theme', 'dark');
    data[SETTINGS_KEY] = { xTheme: { active: 'ember' } };
    const scope = new Scope();
    startTheme(scope);
    await settle();
    expect(painted()).toBe('ember');
    scope.dispose();
    expect(style()).toBeNull();
    expect(painted()).toBeNull();
    await saveSettings({ xTheme: { active: 'nord' } });
    await settle();
    expect(painted()).toBeNull();
  });
});
