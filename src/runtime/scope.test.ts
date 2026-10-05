// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scope } from './scope';

afterEach(() => vi.restoreAllMocks());

describe('Scope', () => {
  it('runs registered cleanup on dispose, most recent first', () => {
    const scope = new Scope();
    const order: string[] = [];
    scope.add(() => order.push('first'));
    scope.add(() => order.push('second'));
    scope.dispose();
    expect(order).toEqual(['second', 'first']);
  });

  it('disposes exactly once', () => {
    const scope = new Scope();
    const cleanup = vi.fn();
    scope.add(cleanup);
    scope.dispose();
    scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('aborts its signal on dispose', () => {
    const scope = new Scope();
    expect(scope.signal.aborted).toBe(false);
    expect(scope.disposed).toBe(false);
    scope.dispose();
    expect(scope.signal.aborted).toBe(true);
    expect(scope.disposed).toBe(true);
  });

  it('keeps cleaning up after one cleanup throws, and reports it', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scope = new Scope();
    const before = vi.fn();
    const after = vi.fn();
    scope.add(before);
    scope.add(() => {
      throw new Error('boom');
    });
    scope.add(after);
    expect(() => scope.dispose()).not.toThrow();
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup added after disposal immediately', () => {
    const scope = new Scope();
    scope.dispose();
    const cleanup = vi.fn();
    scope.add(cleanup);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('lets a cleanup be unregistered without running it', () => {
    const scope = new Scope();
    const cleanup = vi.fn();
    const remove = scope.add(cleanup);
    remove();
    scope.dispose();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('disposes children with the parent, and a child on its own', () => {
    const parent = new Scope();
    const child = parent.child();
    const sibling = parent.child();
    const childCleanup = vi.fn();
    const siblingCleanup = vi.fn();
    child.add(childCleanup);
    sibling.add(siblingCleanup);
    child.dispose();
    expect(childCleanup).toHaveBeenCalledTimes(1);
    expect(siblingCleanup).not.toHaveBeenCalled();
    parent.dispose();
    expect(siblingCleanup).toHaveBeenCalledTimes(1);
    expect(childCleanup).toHaveBeenCalledTimes(1);
    expect(sibling.disposed).toBe(true);
  });

  it('disposes itself when asked to check and its owner is gone', () => {
    let valid = true;
    const scope = new Scope(() => valid);
    const cleanup = vi.fn();
    scope.add(cleanup);
    expect(scope.alive()).toBe(true);
    expect(cleanup).not.toHaveBeenCalled();
    valid = false;
    expect(scope.alive()).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(scope.signal.aborted).toBe(true);
  });

  it('passes the owner check on to children', () => {
    let valid = true;
    const parent = new Scope(() => valid);
    const child = parent.child();
    const cleanup = vi.fn();
    child.add(cleanup);
    valid = false;
    expect(child.alive()).toBe(false);
    expect(parent.disposed).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on dispose', () => {
    const scope = new Scope();
    const target = new EventTarget();
    const listener = vi.fn();
    scope.listen(target, 'ping', listener);
    target.dispatchEvent(new Event('ping'));
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('requestFrame', () => {
    it('runs a frame that is still pending when nothing is disposed', async () => {
      const scope = new Scope();
      const frame = vi.fn();
      scope.requestFrame(frame);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      expect(frame).toHaveBeenCalledTimes(1);
    });

    it('cancels a pending frame on dispose', async () => {
      const scope = new Scope();
      const frame = vi.fn();
      scope.requestFrame(frame);
      scope.dispose();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      expect(frame).not.toHaveBeenCalled();
    });

    it('cancels a single frame early', async () => {
      const scope = new Scope();
      const frame = vi.fn();
      scope.requestFrame(frame)();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      expect(frame).not.toHaveBeenCalled();
    });
  });
});
