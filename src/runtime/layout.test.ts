// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLayoutService, type Layout } from './layout';
import { Scope } from './scope';

/** X's shell: `#layers`, then the app wrapper that is a row (wide) or a column (narrow). */
const SHELL = `<style>.row{display:flex;flex-direction:row}.col{display:flex;flex-direction:column}</style>
  <div id="root"><div id="layers"></div><div id="app" class="row"><main></main></div></div>`;

const app = () => document.getElementById('app')!;
/** Lets the observers deliver and any wait settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const scope = new Scope();
  const service = createLayoutService(scope);
  const seen: Array<[Layout, Layout | null]> = [];
  service.onLayout((layout, previous) => seen.push([layout, previous]));
  return { scope, service, seen };
}

beforeEach(() => {
  document.body.innerHTML = SHELL;
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('LayoutService', () => {
  it('detects the layout that is already showing', () => {
    expect(setup().service.layout).toBe('wide');
    document.body.innerHTML = SHELL.replace('class="row"', 'class="col"');
    expect(setup().service.layout).toBe('narrow');
  });

  it('follows the wrapper between wide and narrow, announcing only real changes', async () => {
    const { service, seen } = setup();
    app().className = 'col';
    await settle();
    expect(service.layout).toBe('narrow');
    app().className = 'col extra';
    await settle();
    app().className = 'row';
    await settle();
    expect(service.layout).toBe('wide');
    expect(seen).toEqual([
      ['narrow', 'wide'],
      ['wide', 'narrow'],
    ]);
  });

  it('ignores class changes that leave the layout as it was', async () => {
    const { seen } = setup();
    app().className = 'row padded';
    await settle();
    app().className = 'row';
    await settle();
    expect(seen).toEqual([]);
  });

  it('is not misled by the window width', async () => {
    const { service } = setup();
    vi.stubGlobal('innerWidth', 320);
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(service.layout).toBe('wide');
    vi.unstubAllGlobals();
  });

  it('finds the wrapper when X renders it after the script starts', async () => {
    document.body.innerHTML = '<style>.col{flex-direction:column}</style>';
    const { service, seen } = setup();
    expect(service.layout).toBeNull();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="layers"></div><div id="app" class="col"></div>',
    );
    await settle();
    expect(service.layout).toBe('narrow');
    expect(seen).toEqual([['narrow', null]]);
  });

  it('keeps following after X replaces the wrapper', async () => {
    const { service, seen } = setup();
    const old = app();
    old.replaceWith(Object.assign(document.createElement('div'), { id: 'app', className: 'col' }));
    await settle();
    expect(service.layout).toBe('narrow');
    // The replaced element no longer drives anything.
    old.className = 'row';
    await settle();
    expect(service.layout).toBe('narrow');
    // The new one does.
    app().className = 'row';
    await settle();
    expect(service.layout).toBe('wide');
    expect(seen).toEqual([
      ['narrow', 'wide'],
      ['wide', 'narrow'],
    ]);
  });

  it('keeps following after X replaces #layers along with its sibling', async () => {
    const { service } = setup();
    document.getElementById('root')!.innerHTML =
      '<div id="layers"></div><div id="app" class="col"></div>';
    await settle();
    expect(service.layout).toBe('narrow');
  });

  it('stops notifying and observing when its scope is disposed', async () => {
    const { scope, service, seen } = setup();
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    scope.dispose();
    expect(disconnect).toHaveBeenCalled();
    app().className = 'col';
    await settle();
    expect(seen).toEqual([]);
    expect(service.layout).toBe('wide');
    disconnect.mockRestore();
  });

  it('stops waiting for a wrapper when its scope is disposed', async () => {
    document.body.innerHTML = '';
    const { scope, service } = setup();
    scope.dispose();
    document.body.innerHTML = SHELL;
    await settle();
    expect(service.layout).toBeNull();
  });

  it('lets a subscriber unsubscribe, and survives one that throws', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service } = setup();
    const later = vi.fn();
    const stop = service.onLayout(() => {
      throw new Error('boom');
    });
    service.onLayout(later);
    app().className = 'col';
    await settle();
    expect(later).toHaveBeenCalledTimes(1);
    stop();
    report.mockRestore();
  });
});
