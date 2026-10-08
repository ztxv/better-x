/**
 * A lifetime that owns cleanup. Anything that outlives a single call (an observer, a listener, a
 * pending frame, a timer) is registered on a Scope and released when the Scope is disposed, so
 * ownership is explicit and nothing is left running after its lifetime ends.
 *
 * Scopes nest: disposing a parent disposes its children first. Later stages map the global,
 * page and modal lifetimes onto this one primitive.
 */

export type Disposer = () => void;

export class Scope {
  private readonly controller = new AbortController();
  private entries = new Set<{ run: Disposer }>();

  /**
   * `isValid` reports whether whatever owns this scope still exists (for a content script: its
   * extension context). Nothing announces that ending, so `alive()` asks.
   */
  constructor(private readonly isValid?: () => boolean) {}

  /** Aborts when the scope is disposed; pass it to anything that can be cancelled by signal. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get disposed(): boolean {
    return this.controller.signal.aborted;
  }

  /**
   * True while the scope is live. Also asks the owner whether it still exists and, if not,
   * disposes the scope first, so work that runs on its own schedule can stop an orphaned scope.
   */
  alive(): boolean {
    if (!this.disposed && this.isValid && !this.isValid()) this.dispose();
    return !this.disposed;
  }

  /**
   * Registers cleanup to run on disposal (most recently added first). On a scope that is already
   * disposed the cleanup runs immediately, so late registration cannot leak. Returns a function
   * that unregisters it without running it.
   */
  add(disposer: Disposer): Disposer {
    if (this.disposed) {
      runDisposer(disposer);
      return () => {};
    }
    const entry = { run: disposer };
    this.entries.add(entry);
    return () => {
      this.entries.delete(entry);
    };
  }

  /** A nested scope that is disposed with this one, or earlier on its own. */
  child(): Scope {
    const scope = new Scope(() => this.alive());
    const detach = this.add(() => scope.dispose());
    scope.add(detach);
    return scope;
  }

  /** Adds an event listener that is removed on disposal. */
  listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }

  /**
   * requestAnimationFrame that is cancelled on disposal. Returns a function that cancels this
   * frame early; a frame that has already run needs no cancelling.
   */
  requestFrame(callback: FrameRequestCallback): Disposer {
    const id = requestAnimationFrame((time) => {
      forget();
      callback(time);
    });
    const forget = this.add(() => cancelAnimationFrame(id));
    return () => {
      forget();
      cancelAnimationFrame(id);
    };
  }

  /**
   * setTimeout that is cleared on disposal. Returns a function that cancels this timer early; a
   * timer that has already fired needs no cancelling.
   */
  setTimeout(callback: () => void, ms: number): Disposer {
    const id = setTimeout(() => {
      forget();
      callback();
    }, ms);
    const forget = this.add(() => clearTimeout(id));
    return () => {
      forget();
      clearTimeout(id);
    };
  }

  /**
   * Runs every registered cleanup, exactly once. A cleanup that throws is reported and does not
   * stop the rest.
   */
  dispose(): void {
    if (this.disposed) return;
    this.controller.abort();
    const pending = [...this.entries];
    this.entries.clear();
    for (let index = pending.length - 1; index >= 0; index--) runDisposer(pending[index]!.run);
  }
}

function runDisposer(disposer: Disposer) {
  try {
    disposer();
  } catch (error) {
    console.error('[Better X] cleanup failed', error);
  }
}
