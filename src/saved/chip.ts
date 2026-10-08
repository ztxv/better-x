import { button, el, ICONS } from '../content/popover';
import { downloadLabel } from '../downloads/messages';
import { PRODUCT_NAME } from '../lib/brand';
import type { BookmarkDraft } from '../types/model';
import type { SavedContext } from './context';
import { choicesFor, downloadInto, isSingle } from './downloads';
import { showMenu } from './menu';
import {
  ERROR_IDLE_MS,
  IDLE_MS,
  idleTimer,
  openOverlay,
  PLAIN_IDLE_MS,
  closeOverlay,
} from './overlay';

/* ---------------------------------------------------------------- post-save chip */

export function showChip(
  ctx: SavedContext,
  control: HTMLButtonElement,
  draft: BookmarkDraft,
  viaKeyboard = false,
) {
  if (ctx.settings.afterSave === 'quiet') return;
  const choices = choicesFor(draft);
  const offer =
    ctx.settings.downloadsEnabled &&
    ctx.settings.afterSave === 'downloadOffer' &&
    choices.length > 0;
  const node = el('div', 'bx-chip', '', { role: 'group', 'aria-label': PRODUCT_NAME });
  const label = el('span', 'bx-chip-label', 'Saved', { role: 'status' });
  label.insertAdjacentHTML('afterbegin', ICONS.check);
  node.append(label);
  if (!offer) node.dataset.plain = '';
  const status = el('div', 'bx-status', '', { role: 'status', 'aria-live': 'polite' });
  status.hidden = true;
  if (offer) {
    const own = choices.filter((choice) => !choice.quoted);
    const dot = el('span', 'bx-dot', '', { 'aria-hidden': 'true' });
    const action = button('bx-chip-action', 'Download', ICONS.download);
    action.dataset.download = '';
    action.setAttribute(
      'aria-label',
      own.length ? downloadLabel(own.map((choice) => choice.item)) : downloadLabel([], true),
    );
    node.append(dot, action);
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!isSingle(choices)) return showMenu(ctx, control, draft, true);
      // Keep the chip in place, now reporting the download, until it settles.
      dot.remove();
      action.remove();
      label.hidden = true;
      timer.setBusy(true);
      downloadInto(ctx, current, status, own, (failed) =>
        timer.setBusy(false, failed ? ERROR_IDLE_MS : IDLE_MS),
      );
      status.tabIndex = -1;
      status.focus({ preventScroll: true });
    });
  }
  node.append(status);
  const current = openOverlay(ctx, 'chip', node, control, draft.tweetId, 'above');
  // Keyboard users get longer to reach the offer with Tab; focus inside pauses it entirely.
  const timer = idleTimer(
    ctx,
    current,
    !offer ? PLAIN_IDLE_MS : viaKeyboard ? ERROR_IDLE_MS : IDLE_MS,
  );
}

/** `onRetry` saves the post again; the control module owns that, so it is handed in. */
export function showSaveError(
  ctx: SavedContext,
  control: HTMLButtonElement,
  draft: BookmarkDraft,
  onRetry: () => void,
) {
  const node = el('div', 'bx-chip', '', { role: 'alert' });
  node.dataset.tone = 'error';
  const label = el('span', 'bx-chip-label', 'Could not save');
  label.insertAdjacentHTML('afterbegin', ICONS.alert);
  const retry = button('bx-chip-action', 'Retry');
  retry.addEventListener('click', (event) => {
    event.stopPropagation();
    closeOverlay(ctx);
    onRetry();
  });
  node.append(label, el('span', 'bx-dot', '', { 'aria-hidden': 'true' }), retry);
  idleTimer(ctx, openOverlay(ctx, 'chip', node, control, draft.tweetId, 'above'), ERROR_IDLE_MS);
}
