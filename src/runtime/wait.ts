export interface WaitOptions {
  /** Rejects with the signal's reason when it aborts (typically `scope.signal`). */
  signal?: AbortSignal;
  /** Rejects with a TimeoutError after this many milliseconds. No timeout by default. */
  timeout?: number;
  /** Where to look and observe. Defaults to the document. */
  root?: ParentNode & Node;
  /**
   * Whether attribute changes are watched too (default true). A wait that only needs something
   * to be added can turn this off so the observer ignores attribute churn.
   */
  attributes?: boolean;
}

/**
 * Resolves with the first match of `target` (a selector, or a function returning a truthy value)
 * under `root`. It checks once now, then again after DOM changes; it never polls. The observer
 * and timer it creates are released as soon as it settles, whichever way.
 */
export function waitFor<T extends Element = Element>(
  target: string,
  options?: WaitOptions,
): Promise<T>;
export function waitFor<T>(
  target: () => T | null | undefined | false,
  options?: WaitOptions,
): Promise<T>;
export function waitFor(
  target: string | (() => unknown),
  { signal, timeout, root = document, attributes = true }: WaitOptions = {},
): Promise<unknown> {
  const find = typeof target === 'string' ? () => root.querySelector(target) : target;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const found = find();
    if (found) return resolve(found);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const match = find();
      if (match) settle(() => resolve(match));
    });
    const onAbort = () => settle(() => reject(signal!.reason));
    function settle(finish: () => void) {
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      finish();
    }

    observer.observe(root instanceof Document ? root.documentElement : root, {
      childList: true,
      subtree: true,
      attributes,
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (timeout !== undefined)
      timer = setTimeout(
        () =>
          settle(() =>
            reject(
              new DOMException(
                `Timed out after ${timeout}ms waiting for ${target}`,
                'TimeoutError',
              ),
            ),
          ),
        timeout,
      );
  });
}
