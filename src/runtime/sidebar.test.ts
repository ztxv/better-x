// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from './scope';
import { createSidebarService, type RetryTrigger } from './sidebar';

const SHELL = `<div id="app"><div data-testid="primaryColumn" id="primary"></div>
  <aside data-testid="sidebarColumn" id="sidebar"></aside></div>`;
const root = document.documentElement;
const has = () => root.hasAttribute('data-bx-sidebar');
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let scope: Scope;

beforeEach(() => {
  scope = new Scope();
  document.body.innerHTML = SHELL;
});
afterEach(() => {
  scope.dispose();
  document.body.innerHTML = '';
  root.removeAttribute('data-bx-sidebar');
});

describe('sidebar marker', () => {
  it('is set while X shows the sidebar column and absent while it does not', async () => {
    createSidebarService(scope, []);
    expect(has()).toBe(true);
    document.getElementById('sidebar')!.remove();
    await settle();
    expect(has()).toBe(false);
    document
      .getElementById('app')!
      .append(Object.assign(document.createElement('aside'), { id: 'again' }));
    document.getElementById('again')!.setAttribute('data-testid', 'sidebarColumn');
    await settle();
    expect(has()).toBe(true);
  });

  it('is absent from the start when X is too narrow for a sidebar', () => {
    document.getElementById('sidebar')!.remove();
    createSidebarService(scope, []);
    expect(has()).toBe(false);
  });

  it('looks again when a trigger says X’s columns may have appeared, and not before', async () => {
    document.body.innerHTML = '';
    let retry: () => void = () => {};
    const trigger: RetryTrigger = (fn) => {
      retry = fn;
      return () => {};
    };
    createSidebarService(scope, [trigger]);
    expect(has()).toBe(false);
    document.body.innerHTML = SHELL;
    await settle();
    // Nothing observes the document while there is no primary column, so nothing noticed yet.
    expect(has()).toBe(false);
    retry();
    expect(has()).toBe(true);
  });

  it('does not observe the document while waiting, however much the page changes', async () => {
    document.body.innerHTML = '';
    const query = vi.spyOn(document, 'querySelector');
    createSidebarService(scope, []);
    const asked = query.mock.calls.length;
    for (let i = 0; i < 50; i++) document.body.append(document.createElement('div'));
    await settle();
    expect(query.mock.calls.length).toBe(asked);
    query.mockRestore();
  });

  it('notices the primary column coming back to the same parent', async () => {
    createSidebarService(scope, []);
    const app = document.getElementById('app')!;
    document.getElementById('primary')!.remove();
    await settle();
    expect(has()).toBe(false);
    const again = document.createElement('div');
    again.setAttribute('data-testid', 'primaryColumn');
    app.prepend(again);
    await settle();
    expect(has()).toBe(true);
  });

  it('follows X replacing the primary column (and the sidebar with it)', async () => {
    createSidebarService(scope, []);
    document.body.innerHTML = SHELL.replace('<aside', '<aside hidden').replace(
      'data-testid="sidebarColumn"',
      'data-testid="other"',
    );
    await settle();
    expect(has()).toBe(false);
    document.body.innerHTML = SHELL;
    await settle();
    expect(has()).toBe(true);
    // A change below the container is not a change of the sidebar and does no harm.
    document.getElementById('sidebar')!.append(document.createElement('div'));
    await settle();
    expect(has()).toBe(true);
  });

  it('removes the marker and stops observing when the scope ends', async () => {
    createSidebarService(scope, []);
    expect(has()).toBe(true);
    scope.dispose();
    expect(has()).toBe(false);
    document.getElementById('sidebar')?.remove();
    document.body.innerHTML = SHELL;
    await settle();
    expect(has()).toBe(false);
  });
});

describe('sidebar service', () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  const later = async () => {
    await settle();
    await frame();
    await settle();
  };

  it('gives the column, and null while there is none', async () => {
    const service = createSidebarService(scope, []);
    expect(service.column).toBe(document.getElementById('sidebar'));
    document.getElementById('sidebar')!.remove();
    await settle();
    expect(service.column).toBeNull();
  });

  it('calls a listener once when it subscribes and once per frame for changes inside the column', async () => {
    const service = createSidebarService(scope, []);
    const listener = vi.fn();
    scope.add(service.onChange(listener));
    await later();
    expect(listener).toHaveBeenCalledTimes(1);
    const column = document.getElementById('sidebar')!;
    for (let i = 0; i < 5; i++) column.append(document.createElement('div'));
    await later();
    expect(listener).toHaveBeenCalledTimes(2);
    column.firstElementChild!.append(document.createElement('span'));
    await later();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('observes nothing inside the column while nobody listens, and stops when the last listener leaves', async () => {
    const observed: Node[] = [];
    const Original = MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends Original {
        override observe(target: Node, options?: MutationObserverInit) {
          if (options?.subtree) observed.push(target);
          super.observe(target, options);
        }
      },
    );
    const service = createSidebarService(scope, []);
    expect(observed).toEqual([]);
    const stop = service.onChange(() => {});
    expect(observed).toEqual([document.getElementById('sidebar')]);
    stop();
    const listener = vi.fn();
    document.getElementById('sidebar')!.append(document.createElement('div'));
    await later();
    expect(listener).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('follows the column when X replaces it, and tells listeners', async () => {
    const service = createSidebarService(scope, []);
    const listener = vi.fn();
    scope.add(service.onChange(listener));
    await later();
    const before = listener.mock.calls.length;
    const replacement = document.createElement('aside');
    replacement.setAttribute('data-testid', 'sidebarColumn');
    document.getElementById('sidebar')!.replaceWith(replacement);
    await later();
    expect(service.column).toBe(replacement);
    expect(listener.mock.calls.length).toBeGreaterThan(before);
    const after = listener.mock.calls.length;
    replacement.append(document.createElement('div'));
    await later();
    expect(listener.mock.calls.length).toBeGreaterThan(after);
  });

  it('stops everything with the scope', async () => {
    const service = createSidebarService(scope, []);
    const listener = vi.fn();
    service.onChange(listener);
    await later();
    scope.dispose();
    const calls = listener.mock.calls.length;
    document.getElementById('sidebar')?.append(document.createElement('div'));
    await later();
    expect(listener.mock.calls.length).toBe(calls);
  });
});
