import { startPanelOverlay } from '../src/content/overlay';
import { featureRegistry } from '../src/features';
import { startFeatures } from '../src/features/host';
import { startRuntime } from '../src/runtime';
import { Scope } from '../src/runtime/scope';
import { startSaved } from '../src/saved';
import '../src/content/styles.css';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    // Everything this script keeps running is owned by this scope, released when WXT invalidates
    // the context. WXT announces that only when a newer copy of the script starts; after an
    // extension reload nothing does, so the scope also checks `ctx.isValid` (which disposes it
    // through `onInvalidated`) each time the observer delivers a change.
    const scope = new Scope(() => ctx.isValid);
    ctx.onInvalidated(() => scope.dispose());

    const runtime = startRuntime(scope);
    const saved = startSaved(scope, runtime);
    // The in-page panel (overlay mode only; nothing is created until it first opens).
    try {
      const overlay = startPanelOverlay(scope);
      saved.openLibrary = () => overlay.open();
    } catch (error) {
      console.error('[Better X] panel overlay could not start', error);
    }
    // Customization is optional: if it cannot start, Saved and Downloads are already running.
    try {
      startFeatures(scope, runtime, featureRegistry);
    } catch (error) {
      console.error('[Better X] customization could not start', error);
    }
  },
});
