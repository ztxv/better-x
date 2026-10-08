import { el } from '../content/popover';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  loadSettings,
  watchSettings,
  type Settings,
} from '../lib/settings';
import type { ActionRowService } from '../runtime/action-row';
import type { PostStream } from '../runtime/posts';
import type { RouteService } from '../runtime/route';
import type { Scope } from '../runtime/scope';
import { LIBRARY_REVISION_KEY } from '../storage/db';
import type { SavedContext } from './context';
import { saveSlot } from './control';
import { closeOverlay } from './overlay';
import { refreshSaved } from './state';

/**
 * Starts the Saved feature on the shared runtime: a save control on every post, the post-save chip, the saved-post
 * menu and downloads. Everything it keeps running is owned by `scope`.
 */
/** The shared runtime services the feature builds on. */
export interface SavedDeps {
  posts: PostStream;
  actionRow: ActionRowService;
  routes: RouteService;
}

export function startSaved(scope: Scope, { posts, actionRow, routes }: SavedDeps): SavedContext {
  const ctx: SavedContext = {
    scope,
    saved: new Set(),
    saving: new Set(),
    actionRow,
    overlay: null,
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

  // The save control is the first action in the shared action row.
  scope.add(actionRow.register(saveSlot(ctx)));
  // An overlay belongs to the post it was opened on: gone with its element, or with its page.
  scope.add(
    posts.onBatch(() => {
      if (ctx.overlay && !ctx.overlay.anchor.isConnected) closeOverlay(ctx);
    }),
  );
  scope.add(
    routes.onRoute(({ pageChanged }) => {
      if (pageChanged) closeOverlay(ctx);
    }),
  );
  void refreshSaved(ctx);

  const onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[LIBRARY_REVISION_KEY]) void refreshSaved(ctx);
  };
  chrome.storage.onChanged.addListener(onStorageChanged);
  scope.add(() => chrome.storage.onChanged.removeListener(onStorageChanged));

  // An invalidated script has no background to talk to, so its controls could only fail. The
  // action row removes them with the scope; this takes down the rest: the open overlay and the
  // accent style.
  scope.add(() => {
    closeOverlay(ctx);
    accentStyle.remove();
  });

  return ctx;
}
