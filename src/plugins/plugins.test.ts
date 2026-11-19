// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { freshEnvironment } from '../test/fakes';
import { PLUGINS } from './catalog';
import { CONTENT_PLUGINS } from './content';
import { startPlugins, type ContentPlugin } from './host';
import { createPlayerView, formatTime } from './spotify/view';
import {
  loadPluginState,
  normalizePluginState,
  parseClientId,
  PLUGINS_KEY,
  setPluginEnabled,
} from './state';
import type { PlayerState, SpotifyCommand } from '../spotify/types';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let data: Record<string, unknown>;
beforeEach(async () => {
  ({ data } = await freshEnvironment());
});

describe('plugin state', () => {
  it('every plugin in the catalog has its X-page half, and no stranger', () => {
    expect(CONTENT_PLUGINS.map((plugin) => plugin.id).sort()).toEqual(
      PLUGINS.map((plugin) => plugin.id).sort(),
    );
  });

  it('is off by default, persists a switch, and drops junk', async () => {
    expect((await loadPluginState()).enabled).toEqual({});
    await setPluginEnabled('spotify', true);
    expect(data[PLUGINS_KEY]).toEqual({ enabled: { spotify: true }, spotify: { clientId: '' } });
    expect(
      normalizePluginState({ enabled: { spotify: 'yes', other: true }, spotify: { clientId: 7 } }),
    ).toEqual({ enabled: {}, spotify: { clientId: '' } });
    expect(parseClientId(` ${'AB12'.repeat(8)} `)).toBe('ab12'.repeat(8));
    expect(parseClientId('secret')).toBe('');
  });
});

describe('plugin host', () => {
  it('starts a plugin when it is switched on and releases everything when it is switched off', async () => {
    const log: string[] = [];
    const plugin: ContentPlugin = {
      id: 'spotify',
      start({ scope }) {
        log.push('start');
        const node = document.body.appendChild(document.createElement('i'));
        scope.listen(document, 'click', () => log.push('click'));
        scope.add(() => {
          node.remove();
          log.push('stop');
        });
      },
    };
    const scope = new Scope();
    startPlugins(scope, {} as Runtime, [plugin], () => {});
    await settle();
    expect(log).toEqual([]);

    await setPluginEnabled('spotify', true);
    await setPluginEnabled('spotify', true);
    expect(log).toEqual(['start']);
    expect(document.querySelectorAll('i')).toHaveLength(1);
    document.dispatchEvent(new Event('click'));

    await setPluginEnabled('spotify', false);
    document.dispatchEvent(new Event('click'));
    expect(log).toEqual(['start', 'click', 'stop']);
    expect(document.querySelectorAll('i')).toHaveLength(0);

    await setPluginEnabled('spotify', true);
    scope.dispose();
    expect(log).toEqual(['start', 'click', 'stop', 'start', 'stop']);
  });

  it('a plugin that throws while starting is cleaned up and does not stop the others', async () => {
    const log: string[] = [];
    data[PLUGINS_KEY] = { enabled: { spotify: true } };
    const broken: ContentPlugin = {
      id: 'spotify',
      start({ scope }) {
        scope.add(() => log.push('released'));
        throw new Error('boom');
      },
    };
    const error = console.error;
    console.error = () => {};
    startPlugins(new Scope(), {} as Runtime, [broken], () => {});
    await settle();
    console.error = error;
    expect(log).toEqual(['released']);
  });
});

describe('Spotify player view', () => {
  const playing = (
    over: Partial<Extract<PlayerState, { status: 'playing' }>> = {},
  ): PlayerState => ({
    status: 'playing',
    track: {
      title: '<img src=x onerror=alert(1)>',
      artists: 'Artist',
      album: 'Album',
      art: null,
      url: 'https://open.spotify.com/track/abc',
      durationMs: 200_000,
    },
    isPlaying: true,
    progressMs: 50_000,
    at: Date.now(),
    shuffle: true,
    repeat: 'off',
    controls: { toggle: true, next: true, previous: true, seek: true, shuffle: true, repeat: true },
    ...over,
  });
  function mount() {
    const commands: SpotifyCommand[] = [];
    const calls: string[] = [];
    const view = createPlayerView({
      onCommand: (command) => commands.push(command),
      onRetry: () => calls.push('retry'),
      onOpenPanel: () => calls.push('panel'),
    });
    document.body.append(view.host);
    const root = view.host.shadowRoot!;
    const $ = (selector: string) => root.querySelector<HTMLElement>(selector)!;
    return { view, commands, calls, root, $ };
  }

  it('writes Spotify’s text as text, never as markup', () => {
    const { view, $, root } = mount();
    view.render(playing());
    expect($('.title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(root.querySelector('.title img')).toBeNull();
    expect(($('.title') as HTMLAnchorElement).href).toBe('https://open.spotify.com/track/abc');
    expect($('.times').textContent).toBe('00:5003:20');
    expect(formatTime(204_000)).toBe('03:24');
  });

  it('sends the command each control stands for', () => {
    const { view, commands, $ } = mount();
    view.render(playing());
    $('.toggle').click();
    $('.next').click();
    $('.previous').click();
    $('.shuffle').click();
    $('.repeat').click();
    expect(commands).toEqual([
      { action: 'pause' },
      { action: 'next' },
      { action: 'previous' },
      { action: 'shuffle', on: false },
      { action: 'repeat', mode: 'context' },
    ]);
    expect($('.shuffle').getAttribute('aria-pressed')).toBe('true');
    expect($('.toggle').getAttribute('aria-label')).toBe('Pause');
  });

  it('draws no button that cannot work, and says why', () => {
    const { view, $ } = mount();
    const none = {
      toggle: false,
      next: false,
      previous: false,
      seek: false,
      shuffle: false,
      repeat: false,
    };
    view.render(playing({ controls: none, note: 'Playback controls need Spotify Premium.' }));
    expect($('.controls').hidden).toBe(true);
    expect($('.progress').getAttribute('role')).toBe('progressbar');
    expect($('.note').textContent).toContain('Premium');
    view.render(playing({ controls: { ...none, toggle: true } }));
    expect($('.controls').hidden).toBe(false);
    expect($('.next').hidden).toBe(true);
    expect($('.toggle').hidden).toBe(false);
  });

  it('shows each other state plainly, with an action where one helps', () => {
    const { view, calls, $, root } = mount();
    view.render({ status: 'loading' });
    expect(root.querySelector('.skeleton')).not.toBeNull();
    view.render({ status: 'idle' });
    expect($('.message').textContent).toContain('Nothing is playing');
    expect(root.querySelector('.action')).toBeNull();
    view.render({ status: 'disconnected' });
    $('.action').click();
    view.render({ status: 'setup' });
    $('.action').click();
    view.render({ status: 'error', message: 'Spotify is having trouble right now.' });
    expect($('.message').textContent).toContain('having trouble');
    $('.action').click();
    expect(calls).toEqual(['panel', 'panel', 'retry']);
  });
});
