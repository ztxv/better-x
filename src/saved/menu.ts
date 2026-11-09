import { button, el, ICONS, place } from '../content/popover';
import { downloadLabel } from '../downloads/messages';
import { request } from '../lib/api';
import { PRODUCT_NAME } from '../lib/brand';
import type { BookmarkDraft } from '../types/model';
import type { SavedContext } from './context';
import { chooser, choicesFor, downloadInto, isSingle } from './downloads';
import { renderAll } from './state';
import { closeOverlay, openOverlay, showStatus } from './overlay';

/* ---------------------------------------------------------------- saved-post menu */

export function showMenu(
  ctx: SavedContext,
  control: HTMLButtonElement,
  draft: BookmarkDraft,
  openChooser = false,
) {
  const id = draft.tweetId;
  const choices = choicesFor(draft);
  const own = choices.filter((choice) => !choice.quoted);
  const node = el('div', 'bx-menu', '', { role: 'dialog', 'aria-label': PRODUCT_NAME });
  const body = el('div', 'bx-menu-body');
  const status = el('div', 'bx-status', '', { role: 'status', 'aria-live': 'polite' });
  status.hidden = true;
  node.append(body, status);
  const current = openOverlay(ctx, 'menu', node, control, id, 'below');
  control.setAttribute('aria-expanded', 'true');
  control.setAttribute('aria-controls', node.id);

  const showDownload =
    ctx.settings.downloadsEnabled && ctx.settings.menuActions.download && choices.length > 0;
  if (showDownload) {
    const label = own.length
      ? downloadLabel(own.map((choice) => choice.item))
      : downloadLabel([], true);
    const download = button('bx-item', label, ICONS.download);
    download.dataset.download = '';
    download.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!isSingle(choices)) return chooser(ctx, current, choices, body, status);
      download.disabled = true;
      downloadInto(ctx, current, status, own, () => (download.disabled = false));
    });
    body.append(download);
  }
  if (ctx.settings.menuActions.openLibrary) {
    const library = button('bx-item', 'Open bookmark library');
    library.addEventListener('click', (event) => {
      event.stopPropagation();
      if (ctx.openLibrary?.()) {
        closeOverlay(ctx);
        return;
      }
      library.disabled = true;
      void request({ type: 'openPanel' })
        .then(() => closeOverlay(ctx))
        .catch(() => {
          library.disabled = false;
          showStatus(status, `Could not open the library. Use the ${PRODUCT_NAME} toolbar icon.`);
        });
    });
    body.append(library);
  }
  if (body.childElementCount) body.append(el('div', 'bx-separator', '', { role: 'separator' }));
  // Always present, so a saved post can always be managed from the page.
  const remove = button('bx-item bx-danger', 'Remove bookmark');
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    remove.disabled = true;
    void request<void>({ type: 'delete', id })
      .then(() => {
        ctx.saved.delete(id);
        renderAll(ctx, id);
        closeOverlay(ctx, true);
      })
      .catch(() => {
        remove.disabled = false;
        showStatus(status, 'Could not remove this bookmark. Try again.');
      });
  });
  body.append(remove);

  // Arrow keys move between actions; Tab order stays native.
  node.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
    event.preventDefault();
  });
  if (openChooser && showDownload && !isSingle(choices))
    chooser(ctx, current, choices, body, status);
  else body.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  place(node, control, 'below');
}
