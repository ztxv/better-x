import type { Scope } from './scope';

/**
 * A MutationObserver owned by `scope`: it starts observing now and disconnects (discarding any
 * undelivered records) when the scope is disposed. Feature code creates observers only through
 * this, so none can outlive its lifetime. Each delivery first checks the scope is still alive, so
 * an observer left running by an invalidated extension context stops itself.
 */
export function observe(
  scope: Scope,
  target: Node,
  options: MutationObserverInit,
  callback: MutationCallback,
): MutationObserver {
  const observer = new MutationObserver((records, self) => {
    if (scope.alive()) callback(records, self);
  });
  observer.observe(target, options);
  scope.add(() => observer.disconnect());
  return observer;
}
