import { Scope } from '../src/runtime/scope';
import { startTheme } from '../src/themes/host';

/**
 * X themes, at `document_start`: the main content script runs at `document_idle`, so painting
 * from there would show X's black first on every page load. Deliberately tiny and independent of
 * the shared runtime: one `<style>`, one attribute, two focused observers (`src/themes/detect.ts`).
 */
export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_start',
  main(ctx) {
    const scope = new Scope(() => ctx.isValid);
    ctx.onInvalidated(() => scope.dispose());
    try {
      startTheme(scope);
    } catch (error) {
      console.error('[Better X] themes could not start', error);
    }
  },
});
