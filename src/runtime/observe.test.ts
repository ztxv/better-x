// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observe } from './observe';
import { Scope } from './scope';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('observe', () => {
  it('delivers mutations while its scope is alive', async () => {
    const scope = new Scope();
    const callback = vi.fn();
    observe(scope, document.body, { childList: true }, callback);
    document.body.append(document.createElement('div'));
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  it('disconnects when the scope is disposed', async () => {
    const scope = new Scope();
    const callback = vi.fn();
    const observer = observe(scope, document.body, { childList: true }, callback);
    const disconnect = vi.spyOn(observer, 'disconnect');
    scope.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);
    document.body.append(document.createElement('div'));
    await flush();
    expect(callback).not.toHaveBeenCalled();
  });

  it('drops mutations already queued when the scope is disposed', async () => {
    const scope = new Scope();
    const callback = vi.fn();
    observe(scope, document.body, { childList: true }, callback);
    document.body.append(document.createElement('div'));
    scope.dispose();
    await flush();
    expect(callback).not.toHaveBeenCalled();
  });

  it('stops itself and its scope when the owner has gone away', async () => {
    let valid = true;
    const scope = new Scope(() => valid);
    const callback = vi.fn();
    const cleanup = vi.fn();
    scope.add(cleanup);
    const observer = observe(scope, document.body, { childList: true }, callback);
    const disconnect = vi.spyOn(observer, 'disconnect');
    valid = false;
    document.body.append(document.createElement('div'));
    await flush();
    expect(callback).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(scope.disposed).toBe(true);
  });

  it('disconnects every observer a scope owns', async () => {
    const scope = new Scope();
    const first = vi.fn();
    const second = vi.fn();
    observe(scope, document.body, { childList: true }, first);
    observe(scope, document.documentElement, { childList: true, subtree: true }, second);
    scope.dispose();
    document.body.append(document.createElement('div'));
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
