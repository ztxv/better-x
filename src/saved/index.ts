import { el } from '../content/popover';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  loadSettings,
  watchSettings,
  type Settings,
} from '../lib/settings';
import type { PostStream } from '../runtime/posts';
import type { Scope } from '../runtime/scope';
import { LIBRARY_REVISION_KEY } from '../storage/db';
import type { SavedContext } from './context';
import { enhance, queueAlign } from './control';
import { closeOverlay } from './overlay';
import { refreshSaved } from './state';

/**
 * Starts the Saved feature, on the shared stream of posts: a save control on every post, the post-save chip, the saved-post
 * menu and downloads. Everything it keeps running is owned by `scope`.
 */
export function startSaved(scope: Scope, posts: PostStream): SavedContext {
  const ctx: SavedContext = {
    scope,
    saved: new Set(),
    saving: new Set(),
    buttons: new Map(),
    overlay: null,
    unaligned: new Set(),
    cancelAlign: () => {},
    settings: DEFAULT_SETTINGS,
    settingsReady: Promise.resolve(),
  };

  /* ------------------------------------------------------------------ settings */

  const accentStyle = el('style', '', '', { id: 'bx-accent' });
  function applySettings(next: Settings) {
    ctx.settings = next;
    // A scoped custom property only; X's own styles and markup are untouched.
    accentStyle.textContent = `:root{--bx-accent:${ACCENTS[next.accent].brand}}`;
    if (!accentStyle.isConnected) (document.head ?? document.documentElement).append(accentStyle);
    // Hidden actions disappear from an open overlay right away.
    if (
      ctx.overlay &&
      (!next.downloadsEnabled || (ctx.overlay.kind === 'menu' && !next.menuActions.download))
    )
      ctx.overlay.node.querySelectorAll('[data-download]').forEach((node) => node.remove());
  }
  applySettings(DEFAULT_SETTINGS);
  ctx.settingsReady = loadSettings().then(applySettings);
  scope.add(watchSettings(applySettings));

  /* ------------------------------------------------------------------- posts */

  scope.add(posts.onPost((post) => enhance(ctx, post), { replay: true }));
  scope.add(
    posts.onBatch(() => {
      for (const [control] of ctx.buttons) if (!control.isConnected) ctx.buttons.delete(control);
      if (ctx.overlay && !ctx.overlay.anchor.isConnected) closeOverlay(ctx);
    }),
  );
  void refreshSaved(ctx);

  let resizeTimer = 0;
  scope.listen(window, 'resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => queueAlign(ctx), 150);
  });
  scope.add(() => clearTimeout(resizeTimer));
  const onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[LIBRARY_REVISION_KEY]) void refreshSaved(ctx);
  };
  chrome.storage.onChanged.addListener(onStorageChanged);
  scope.add(() => chrome.storage.onChanged.removeListener(onStorageChanged));

  // An invalidated script has no background to talk to, so its controls could only fail.
  // Take down what it put on the page: the open overlay, the controls, the accent style.
  scope.add(() => {
    closeOverlay(ctx);
    ctx.buttons.forEach((_, control) => control.remove());
    ctx.buttons.clear();
    accentStyle.remove();
  });

  return ctx;
}
