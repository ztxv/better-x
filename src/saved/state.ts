import { request } from '../lib/api';
import { PRODUCT_NAME } from '../lib/brand';
import type { SavedContext } from './context';

export function renderState(ctx: SavedContext, control: HTMLButtonElement, id: string) {
  const isSaved = ctx.saved.has(id) || ctx.saving.has(id);
  // Not `disabled`: Chrome blurs a focused control that stays disabled across a frame, which
  // would drop a keyboard user's focus while the save is in flight. Clicks are ignored instead.
  control.setAttribute('aria-disabled', String(ctx.saving.has(id)));
  control.setAttribute('aria-busy', String(ctx.saving.has(id)));
  control.setAttribute('aria-pressed', String(isSaved));
  control.dataset.saved = String(isSaved);
  control.setAttribute(
    'aria-label',
    isSaved ? `Saved to ${PRODUCT_NAME}. Manage bookmark` : `Save post to ${PRODUCT_NAME}`,
  );
  control.title = isSaved ? `Saved in ${PRODUCT_NAME}` : `Save to ${PRODUCT_NAME}`;
}

export const renderAll = (ctx: SavedContext, id?: string) =>
  ctx.actionRow.elements<HTMLButtonElement>('save').forEach((control) => {
    const postId = ctx.actionRow.postOf(control);
    if (postId && (!id || postId === id)) renderState(ctx, control, postId);
  });

export async function refreshSaved(ctx: SavedContext) {
  try {
    const ids = await request<string[]>({ type: 'savedIds' });
    ctx.saved.clear();
    ids.forEach((id) => ctx.saved.add(id));
    renderAll(ctx);
  } catch {
    /* The toolbar remains usable and retries on the next library change. */
  }
}

/* ------------------------------------------------------------------- saving */
