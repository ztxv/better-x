import icon from '../brand/mark.svg?raw';
import { request } from '../lib/api';
import type { ActionSlot } from '../runtime/action-row';
import type { Bookmark, BookmarkDraft } from '../types/model';
import { extractPost } from '../x/selectors';
import { showChip, showSaveError } from './chip';
import type { SavedContext } from './context';
import { showMenu } from './menu';
import { closeOverlay } from './overlay';
import { renderAll, renderState } from './state';

/* ------------------------------------------------------------- save control */

export async function savePost(
  ctx: SavedContext,
  control: HTMLButtonElement,
  article: HTMLElement,
  draft: BookmarkDraft,
  viaKeyboard = false,
) {
  ctx.saving.add(draft.tweetId);
  renderAll(ctx, draft.tweetId);
  let ok = false;
  try {
    await request<Bookmark>({ type: 'save', draft });
    ctx.saved.add(draft.tweetId);
    ok = true;
  } catch {
    ctx.saved.delete(draft.tweetId);
  }
  ctx.saving.delete(draft.tweetId);
  if (ctx.scope.disposed) return;
  renderAll(ctx, draft.tweetId);
  // X may have reused the article for another post while saving.
  if (ctx.actionRow.postOf(control) !== draft.tweetId) return;
  control.dataset.feedback = ok ? 'saved' : 'error';
  ctx.scope.setTimeout(() => delete control.dataset.feedback, 260);
  await ctx.settingsReady;
  // The script may have been taken down while the save was in flight.
  if (ctx.scope.disposed) return;
  if (ctx.actionRow.postOf(control) !== draft.tweetId) return;
  if (ok) {
    control.title = 'Saved to your library';
    showChip(ctx, control, draft, viaKeyboard);
  } else {
    control.title = 'Could not save. Click to retry.';
    control.setAttribute('aria-label', 'Save failed. Click to retry');
    showSaveError(ctx, control, draft, () => void savePost(ctx, control, article, draft));
  }
}

/** The save control, as the first action in the shared action row. */
export function saveSlot(ctx: SavedContext): ActionSlot {
  return {
    id: 'save',
    create({ article, identity }) {
      const control = document.createElement('button');
      control.className = 'bx-control';
      control.type = 'button';
      control.innerHTML = icon;
      renderState(ctx, control, identity.tweetId);
      control.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (ctx.saving.has(ctx.actionRow.postOf(control) ?? '')) return;
        const draft = extractPost(article);
        if (!draft) return;
        if (ctx.saved.has(draft.tweetId)) {
          if (ctx.overlay?.kind === 'menu' && ctx.overlay.anchor === control)
            return closeOverlay(ctx, true);
          // Re-capture missing author metadata without changing bookmark organization.
          void request<Bookmark>({ type: 'save', draft }).catch(() => {});
          void ctx.settingsReady.then(() => showMenu(ctx, control, draft));
          return;
        }
        // One click saves immediately; nothing is asked first and nothing downloads by itself.
        // A click with `detail === 0` came from the keyboard (Enter or Space).
        void savePost(ctx, control, article, draft, event.detail === 0);
      });
      return control;
    },
    update(control, { identity }) {
      // X reused this post element for another post: drop any overlay for the old one.
      if (ctx.overlay?.anchor === control) closeOverlay(ctx);
      delete control.dataset.feedback;
      renderState(ctx, control as HTMLButtonElement, identity.tweetId);
    },
  };
}
