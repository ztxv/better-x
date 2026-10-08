// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Scope } from './scope';
import { markSidebar } from './sidebar';

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
    markSidebar(scope);
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
    markSidebar(scope);
    expect(has()).toBe(false);
  });

  it('waits for X’s columns to render, then reports them', async () => {
    document.body.innerHTML = '';
    markSidebar(scope);
    expect(has()).toBe(false);
    document.body.innerHTML = SHELL;
    await settle();
    expect(has()).toBe(true);
  });

  it('follows X replacing the primary column (and the sidebar with it)', async () => {
    markSidebar(scope);
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
    markSidebar(scope);
    expect(has()).toBe(true);
    scope.dispose();
    expect(has()).toBe(false);
    document.getElementById('sidebar')?.remove();
    document.body.innerHTML = SHELL;
    await settle();
    expect(has()).toBe(false);
  });
});
