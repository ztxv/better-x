import icon from '../brand/mark.svg?raw';
import { request } from '../lib/api';
import { PRODUCT_NAME } from '../lib/brand';
import type { Bookmark, BookmarkDraft } from '../types/model';
import type { StreamPost } from '../runtime/posts';
import { actionRow, extractPost, X_SELECTORS } from '../x/selectors';
import { showChip, showSaveError } from './chip';
import type { SavedContext } from './context';
import { showMenu } from './menu';
import { closeOverlay } from './overlay';
import { refreshSaved, renderAll, renderState } from './state';

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
  renderAll(ctx, draft.tweetId);
  // X may have reused the article for another post while saving.
  if (ctx.buttons.get(control) !== draft.tweetId) return;
  control.dataset.feedback = ok ? 'saved' : 'error';
  setTimeout(() => delete control.dataset.feedback, 260);
  await ctx.settingsReady;
  if (ctx.buttons.get(control) !== draft.tweetId) return;
  if (ok) {
    control.title = 'Saved to your library';
    showChip(ctx, control, draft, viaKeyboard);
  } else {
    control.title = 'Could not save. Click to retry.';
    control.setAttribute('aria-label', 'Save failed. Click to retry');
    showSaveError(ctx, control, draft, () => void savePost(ctx, control, article, draft));
  }
}

/**
 * Matches the control to X's own icons in the same row: icon size and button box come
 * from the last native control (Share), then any remaining vertical offset is measured
 * and corrected. This holds across timeline/detail layouts, X font sizes, and zoom.
 */
export function align(targets: Iterable<HTMLButtonElement>) {
  const jobs = [...targets].flatMap((control) => {
    const row = control.parentElement;
    const native = row
      ? [...row.querySelectorAll<HTMLElement>('button, a[href]')].filter(
          (item) => !item.closest('.bx-control') && item.querySelector('svg'),
        )
      : [];
    // The last visible native icon; narrow layouts can hide part of the row.
    const reference = native
      .reverse()
      .find((item) => item.querySelector('svg')!.getBoundingClientRect().height > 0);
    const glyph = reference?.querySelector('svg')?.getBoundingClientRect();
    if (!reference || !glyph?.height || !control.isConnected) return [];
    const box = reference.getBoundingClientRect().height;
    return [{ control, glyph, box }];
  });
  for (const { control, glyph, box } of jobs) {
    const size = Math.min(Math.max(glyph.height, 14), 32);
    control.style.setProperty('--bx-icon', `${size}px`);
    control.style.setProperty('--bx-box', `${Math.min(Math.max(box, size), 48)}px`);
  }
  const offsets = jobs.map(({ control, glyph }) => {
    const own = control.querySelector('svg')?.getBoundingClientRect();
    const current = Number(control.dataset.offset) || 0;
    if (!own?.height) return current;
    const delta = glyph.top + glyph.height / 2 - (own.top + own.height / 2);
    return Math.max(-20, Math.min(20, Math.round((current + delta) * 2) / 2));
  });
  jobs.forEach(({ control }, index) => {
    const offset = offsets[index] ?? 0;
    control.dataset.offset = String(offset);
    control.style.setProperty('--bx-dy', `${offset}px`);
  });
}

export function queueAlign(ctx: SavedContext, control?: HTMLButtonElement) {
  if (control) ctx.unaligned.add(control);
  else ctx.buttons.forEach((_, item) => ctx.unaligned.add(item));
  ctx.cancelAlign();
  ctx.cancelAlign = ctx.scope.requestFrame(() => {
    align(ctx.unaligned);
    ctx.unaligned.clear();
  });
}

/** Gives the post a save control, or points an existing one at the post it now shows. */
export function enhance(ctx: SavedContext, { article, identity }: StreamPost) {
  const existing = article.querySelector<HTMLButtonElement>('.bx-control');
  if (existing?.closest(X_SELECTORS.post) === article) {
    if (ctx.buttons.get(existing) !== identity.tweetId) {
      // X reused this article for another post: drop any overlay for the old one.
      if (ctx.overlay?.anchor === existing) closeOverlay(ctx);
      delete existing.dataset.feedback;
      ctx.buttons.set(existing, identity.tweetId);
      renderState(ctx, existing, identity.tweetId);
      queueAlign(ctx, existing);
    }
    return;
  }
  const row = actionRow(article);
  if (!row) return;
  const control = document.createElement('button');
  control.className = 'bx-control';
  control.type = 'button';
  control.innerHTML = icon;
  ctx.buttons.set(control, identity.tweetId);
  renderState(ctx, control, identity.tweetId);
  control.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (ctx.saving.has(ctx.buttons.get(control) ?? '')) return;
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
  row.append(control);
  queueAlign(ctx, control);
}
