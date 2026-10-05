import icon from '../src/brand/mark.svg?raw';
import {
  anchorVisible,
  button,
  el,
  ICONS,
  place,
  xTheme,
  type Placement,
} from '../src/content/popover';
import {
  downloadLabel,
  errorMessage,
  itemLabel,
  OPEN_POST_ERRORS,
} from '../src/downloads/messages';
import { request } from '../src/lib/api';
import { PRODUCT_NAME } from '../src/lib/brand';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  loadSettings,
  watchSettings,
  type Settings,
} from '../src/lib/settings';
import { mediaKey } from '../src/media/urls';
import { DOWNLOADS_REVISION_KEY, LIBRARY_REVISION_KEY } from '../src/storage/db';
import type {
  Bookmark,
  BookmarkDraft,
  DownloadError,
  DownloadRecord,
  MediaTarget,
  PostMedia,
  StartResult,
} from '../src/types/model';
import { actionRow, extractPost, postIdentity, X_SELECTORS } from '../src/x/selectors';
import '../src/content/styles.css';

/** One downloadable item as offered on the page. */
interface Choice {
  target: MediaTarget;
  item: PostMedia;
  label: string;
  quoted: boolean;
  postUrl: string;
}

type ItemState =
  | { state: 'active'; recordId: string }
  | { state: 'done' | 'cancelled'; recordId: string }
  | { state: 'failed'; error: DownloadError; recordId: string | null };

interface Overlay {
  kind: 'chip' | 'menu';
  node: HTMLElement;
  anchor: HTMLButtonElement;
  tweetId: string;
  prefer: Placement;
  cleanup: Array<() => void>;
}

/** With a Download to reach for, the chip stays; a plain "Saved" confirmation leaves sooner. */
const IDLE_MS = 3000;
const PLAIN_IDLE_MS = 1600;
const ERROR_IDLE_MS = 8000;

/** Media the page shows for a post: its own first, then quoted media, labelled as such. */
function choicesFor(draft: BookmarkDraft): Choice[] {
  const own = draft.media.map((item, index) => ({
    target: { tweetId: draft.tweetId, scope: 'post' as const, index, key: mediaKey(item, index) },
    item,
    label: itemLabel(item.kind, index, draft.media.length, false),
    quoted: false,
    postUrl: draft.url,
  }));
  const quote = draft.quote;
  const quoted =
    quote?.tweetId && quote.url
      ? quote.media.map((item, index) => ({
          target: {
            tweetId: draft.tweetId,
            scope: 'quote' as const,
            index,
            key: mediaKey(item, index),
          },
          item,
          label: itemLabel(item.kind, index, quote.media.length, true),
          quoted: true,
          postUrl: quote.url!,
        }))
      : [];
  return [...own, ...quoted];
}

const choiceId = (choice: Choice) => `${choice.target.scope}:${choice.target.index}`;
/** One Download click on a post with exactly one item of its own starts it immediately. */
const isSingle = (choices: Choice[]) => choices.length === 1 && !choices[0]!.quoted;

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main() {
    const saved = new Set<string>();
    const saving = new Set<string>();
    const buttons = new Map<HTMLButtonElement, string>();
    let overlay: Overlay | null = null;
    let scheduled = false;
    let settings: Settings = DEFAULT_SETTINGS;

    /* ------------------------------------------------------------------ settings */

    const accentStyle = el('style', '', '', { id: 'bx-accent' });
    function applySettings(next: Settings) {
      settings = next;
      // A scoped custom property only; X's own styles and markup are untouched.
      accentStyle.textContent = `:root{--bx-accent:${ACCENTS[next.accent].brand}}`;
      if (!accentStyle.isConnected) (document.head ?? document.documentElement).append(accentStyle);
      // Hidden actions disappear from an open overlay right away.
      if (
        overlay &&
        (!next.downloadsEnabled || (overlay.kind === 'menu' && !next.menuActions.download))
      )
        overlay.node.querySelectorAll('[data-download]').forEach((node) => node.remove());
    }
    applySettings(DEFAULT_SETTINGS);
    const settingsReady = loadSettings().then(applySettings);
    watchSettings(applySettings);

    /* ------------------------------------------------------------- save control */

    function renderState(control: HTMLButtonElement, id: string) {
      const isSaved = saved.has(id) || saving.has(id);
      control.disabled = saving.has(id);
      control.setAttribute('aria-busy', String(saving.has(id)));
      control.setAttribute('aria-pressed', String(isSaved));
      control.dataset.saved = String(isSaved);
      control.setAttribute(
        'aria-label',
        isSaved ? `Saved to ${PRODUCT_NAME}. Manage bookmark` : `Save post to ${PRODUCT_NAME}`,
      );
      control.title = isSaved ? `Saved in ${PRODUCT_NAME}` : `Save to ${PRODUCT_NAME}`;
    }

    const renderAll = (id?: string) =>
      buttons.forEach((buttonId, control) => {
        if (!id || buttonId === id) renderState(control, buttonId);
      });

    async function refreshSaved() {
      try {
        const ids = await request<string[]>({ type: 'savedIds' });
        saved.clear();
        ids.forEach((id) => saved.add(id));
        renderAll();
      } catch {
        /* The toolbar remains usable and retries on the next library change. */
      }
    }

    /* ------------------------------------------------------------------ overlays */

    function closeOverlay(restoreFocus = false) {
      const current = overlay;
      if (!current) return;
      overlay = null;
      current.cleanup.forEach((stop) => stop());
      current.node.remove();
      current.anchor.removeAttribute('aria-expanded');
      current.anchor.removeAttribute('aria-controls');
      if (restoreFocus && current.anchor.isConnected) current.anchor.focus({ preventScroll: true });
    }

    /** True while `current` is still the open overlay for a control showing its post. */
    const stillOpen = (current: Overlay) =>
      overlay === current && buttons.get(current.anchor) === current.tweetId;

    /** Shows `node` as the only overlay on the page, anchored to a save control. */
    function openOverlay(
      kind: Overlay['kind'],
      node: HTMLElement,
      anchor: HTMLButtonElement,
      tweetId: string,
      prefer: Placement,
    ): Overlay {
      closeOverlay();
      node.dataset.theme = xTheme();
      node.id = `bx-${kind}`;
      document.body.append(node);
      const current: Overlay = { kind, node, anchor, tweetId, prefer, cleanup: [] };
      overlay = current;
      place(node, anchor, prefer);

      let frame = 0;
      const openedAt = anchor.getBoundingClientRect().top;
      const reposition = (event?: Event) => {
        // Scrolling inside the overlay itself (a long chooser) is not page movement.
        if (event?.target instanceof Node && node.contains(event.target)) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (!stillOpen(current) || !anchorVisible(anchor)) return closeOverlay();
          // The chip is a passing confirmation: scrolling the post away dismisses it unless it
          // has focus. A few pixels (trackpad momentum after the click) only move it along.
          const moved = Math.abs(anchor.getBoundingClientRect().top - openedAt) > 24;
          if (kind === 'chip' && moved && !node.contains(document.activeElement))
            return closeOverlay();
          place(node, anchor, prefer);
        });
      };
      const outside = (event: PointerEvent) => {
        const target = event.target as Node;
        if (!node.contains(target) && !anchor.contains(target)) closeOverlay();
      };
      const focusables = () =>
        [...node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(
          (item) => !item.closest('[hidden]'),
        );
      const keys = (event: KeyboardEvent) => {
        const active = document.activeElement;
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          closeOverlay(node.contains(active) || active === anchor);
          return;
        }
        if (event.key !== 'Tab') return;
        // The overlay sits at the end of the page, so keep it next to its control in Tab order:
        // Tab from the control enters it; leaving it from either end returns to the control.
        const items = focusables();
        const leaving = event.shiftKey ? active === items[0] : active === items.at(-1);
        if (active === anchor && !event.shiftKey && items.length) {
          event.preventDefault();
          items[0]!.focus({ preventScroll: true });
        } else if (node.contains(active) && (leaving || !items.length)) {
          event.preventDefault();
          if (event.shiftKey) anchor.focus({ preventScroll: true });
          else closeOverlay(true);
        }
      };
      // Tabbing out of the overlay closes it; focus moving inside (or re-rendering) does not.
      const leave = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && !node.contains(next) && next !== anchor) closeOverlay();
      };
      addEventListener('scroll', reposition, { capture: true, passive: true });
      addEventListener('resize', reposition, { passive: true });
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', keys, true);
      node.addEventListener('focusout', leave);
      current.cleanup.push(() => {
        cancelAnimationFrame(frame);
        removeEventListener('scroll', reposition, { capture: true });
        removeEventListener('resize', reposition);
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', keys, true);
      });
      return current;
    }

    /** Dismisses `current` after `ms` idle; paused while hovered, focused, or still working. */
    function idleTimer(current: Overlay, ms: number) {
      let timer = 0;
      let hovered = false;
      let busy = false;
      const focused = () => current.node.contains(document.activeElement);
      const arm = () => {
        clearTimeout(timer);
        if (hovered || busy || focused()) return;
        timer = window.setTimeout(() => {
          if (overlay === current && !focused()) closeOverlay();
        }, ms);
      };
      const pause = () => clearTimeout(timer);
      current.node.addEventListener('pointerenter', () => {
        hovered = true;
        pause();
      });
      current.node.addEventListener('pointerleave', () => {
        hovered = false;
        arm();
      });
      current.node.addEventListener('focusin', pause);
      current.node.addEventListener('focusout', () => setTimeout(arm, 0));
      current.cleanup.push(pause);
      arm();
      return {
        setBusy(value: boolean, nextMs = ms) {
          busy = value;
          ms = nextMs;
          arm();
        },
      };
    }

    function showStatus(status: HTMLElement, text: string) {
      status.hidden = false;
      status.dataset.tone = 'error';
      const line = el('span', 'bx-status-text', text);
      line.insertAdjacentHTML('afterbegin', ICONS.alert);
      status.replaceChildren(line);
    }

    /* ----------------------------------------------------------------- downloads */

    /** The download currently reporting into each status line; older ones stop updating it. */
    const statusOwner = new WeakMap<HTMLElement, object>();

    /**
     * Starts downloading `selected` and shows progress and the outcome in `status`. Updates
     * come from the background's history, so only completed downloads ever read "Downloaded".
     */
    function downloadInto(
      current: Overlay,
      status: HTMLElement,
      selected: Choice[],
      onSettled?: (failed: boolean) => void,
    ) {
      const token = {};
      statusOwner.set(status, token);
      const tweetId = selected[0]!.target.tweetId;
      const states = new Map<string, ItemState>();
      let stopWatching: (() => void) | null = null;

      const render = () => {
        if (overlay !== current || statusOwner.get(status) !== token) return;
        status.replaceChildren();
        const all = selected.map((choice) => ({ choice, state: states.get(choiceId(choice)) }));
        const active = all.filter((entry) => !entry.state || entry.state.state === 'active');
        const done = all.filter((entry) => entry.state?.state === 'done');
        const failed = all.flatMap((entry) =>
          entry.state?.state === 'failed'
            ? [{ choice: entry.choice, error: entry.state.error }]
            : [],
        );
        const count = selected.length;
        let text: string;
        let tone = '';
        if (active.length)
          text = count > 1 ? `Downloading ${done.length + 1} of ${count}…` : 'Downloading…';
        else if (done.length === count) {
          text = count > 1 ? `Downloaded ${count} files` : 'Downloaded';
          tone = 'done';
        } else if (failed.length) {
          const reason = errorMessage(failed[0]!.error, failed[0]!.choice.item.kind);
          text = done.length ? `${done.length} of ${count} downloaded. ${reason}` : reason;
          tone = 'error';
        } else text = done.length ? `${done.length} of ${count} downloaded` : 'Download cancelled';
        const line = el('span', 'bx-status-text', text);
        if (tone)
          line.insertAdjacentHTML('afterbegin', tone === 'done' ? ICONS.check : ICONS.alert);
        status.dataset.tone = tone;
        status.hidden = false;
        status.append(line);
        if (active.length) return;
        const openPost = failed.find((entry) => OPEN_POST_ERRORS.has(entry.error));
        const retryable = failed.filter((entry) => !OPEN_POST_ERRORS.has(entry.error));
        if (openPost)
          status.append(
            el('a', 'bx-link', 'Open post on X', {
              href: openPost.choice.postUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
            }),
          );
        if (retryable.length) {
          const retry = button('bx-link', 'Retry');
          retry.addEventListener('click', (event) => {
            event.stopPropagation();
            downloadInto(
              current,
              status,
              retryable.map((entry) => entry.choice),
              onSettled,
            );
          });
          status.append(retry);
        }
        stopWatching?.();
        stopWatching = null;
        place(current.node, current.anchor, current.prefer);
        onSettled?.(failed.length > 0);
      };

      const apply = (records: DownloadRecord[]) => {
        const byId = new Map(records.map((record) => [record.id, record]));
        for (const [key, state] of states) {
          if (state.state !== 'active') continue;
          const record = byId.get(state.recordId);
          if (record?.status === 'complete' || record?.status === 'historical')
            states.set(key, { state: 'done', recordId: record.id });
          else if (record?.status === 'cancelled')
            states.set(key, { state: 'cancelled', recordId: record.id });
          else if (record?.status === 'interrupted')
            states.set(key, {
              state: 'failed',
              error: record.error ?? 'interrupted',
              recordId: record.id,
            });
        }
        render();
      };
      const refresh = () =>
        request<DownloadRecord[]>({ type: 'downloadsFor', tweetId })
          .then(apply)
          .catch(() => {});

      const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'local' && changes[DOWNLOADS_REVISION_KEY]) void refresh();
      };
      chrome.storage.onChanged.addListener(listener);
      stopWatching = () => chrome.storage.onChanged.removeListener(listener);
      current.cleanup.push(() => stopWatching?.());
      render();

      void request<StartResult>({
        type: 'startDownload',
        targets: selected.map((choice) => choice.target),
      })
        .then(async (result) => {
          for (const outcome of result.outcomes) {
            const choice = selected.find(
              (entry) =>
                entry.target.scope === outcome.target.scope &&
                entry.target.index === outcome.target.index,
            );
            if (!choice) continue;
            states.set(
              choiceId(choice),
              outcome.status === 'failed'
                ? { state: 'failed', error: outcome.error, recordId: outcome.recordId }
                : { state: 'active', recordId: outcome.recordId },
            );
          }
          for (const choice of selected)
            if (!states.has(choiceId(choice)))
              states.set(choiceId(choice), { state: 'failed', error: 'unknown', recordId: null });
          // Downloads can finish before this response arrives; read the latest state now.
          await refresh();
        })
        .catch(() => {
          for (const choice of selected)
            states.set(choiceId(choice), { state: 'failed', error: 'unknown', recordId: null });
          render();
        });
    }

    /** A small list of the post's media with previews; one click downloads that item. */
    function chooser(current: Overlay, choices: Choice[], body: HTMLElement, status: HTMLElement) {
      body.replaceChildren(el('div', 'bx-menu-heading', 'Download media'));
      const list = el('div', 'bx-choices');
      let inQuote = false;
      for (const choice of choices) {
        if (choice.quoted && !inQuote) list.append(el('div', 'bx-group', 'From the quoted post'));
        inQuote = choice.quoted;
        const item = button('bx-choice', choice.label);
        item.setAttribute('aria-label', `Download ${choice.label.toLowerCase()}`);
        const thumb = el('span', 'bx-thumb');
        if (choice.item.thumbnailUrl) {
          const image = el('img', '', '', { alt: '', referrerpolicy: 'no-referrer' });
          image.src = choice.item.thumbnailUrl;
          image.addEventListener('error', () => image.remove());
          thumb.append(image);
        }
        if (choice.item.kind === 'gif') thumb.append(el('span', 'bx-badge', 'GIF'));
        if (choice.item.kind === 'video') thumb.insertAdjacentHTML('beforeend', ICONS.play);
        item.prepend(thumb);
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          downloadInto(current, status, [choice]);
        });
        list.append(item);
      }
      body.append(list);
      // "Download all" covers the post's own media; quoted media is only ever chosen explicitly.
      const own = choices.filter((choice) => !choice.quoted);
      const group = own.length ? own : choices;
      if (group.length > 1) {
        const all = button(
          'bx-primary',
          own.length ? `Download all (${group.length})` : `Download all quoted (${group.length})`,
          ICONS.download,
        );
        all.addEventListener('click', (event) => {
          event.stopPropagation();
          downloadInto(current, status, group);
        });
        body.append(all);
      }
      place(current.node, current.anchor, current.prefer);
      body.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }

    /* ---------------------------------------------------------------- post-save chip */

    function showChip(control: HTMLButtonElement, draft: BookmarkDraft, viaKeyboard = false) {
      if (settings.afterSave === 'quiet') return;
      const choices = choicesFor(draft);
      const offer =
        settings.downloadsEnabled && settings.afterSave === 'downloadOffer' && choices.length > 0;
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
          if (!isSingle(choices)) return showMenu(control, draft, true);
          // Keep the chip in place, now reporting the download, until it settles.
          dot.remove();
          action.remove();
          label.hidden = true;
          timer.setBusy(true);
          downloadInto(current, status, own, (failed) =>
            timer.setBusy(false, failed ? ERROR_IDLE_MS : IDLE_MS),
          );
          status.tabIndex = -1;
          status.focus({ preventScroll: true });
        });
      }
      node.append(status);
      const current = openOverlay('chip', node, control, draft.tweetId, 'above');
      // Keyboard users get longer to reach the offer with Tab; focus inside pauses it entirely.
      const timer = idleTimer(
        current,
        !offer ? PLAIN_IDLE_MS : viaKeyboard ? ERROR_IDLE_MS : IDLE_MS,
      );
    }

    function showSaveError(control: HTMLButtonElement, draft: BookmarkDraft, article: HTMLElement) {
      const node = el('div', 'bx-chip', '', { role: 'alert' });
      node.dataset.tone = 'error';
      const label = el('span', 'bx-chip-label', 'Could not save');
      label.insertAdjacentHTML('afterbegin', ICONS.alert);
      const retry = button('bx-chip-action', 'Retry');
      retry.addEventListener('click', (event) => {
        event.stopPropagation();
        closeOverlay();
        void savePost(control, article, draft);
      });
      node.append(label, el('span', 'bx-dot', '', { 'aria-hidden': 'true' }), retry);
      idleTimer(openOverlay('chip', node, control, draft.tweetId, 'above'), ERROR_IDLE_MS);
    }

    /* ---------------------------------------------------------------- saved-post menu */

    function showMenu(control: HTMLButtonElement, draft: BookmarkDraft, openChooser = false) {
      const id = draft.tweetId;
      const choices = choicesFor(draft);
      const own = choices.filter((choice) => !choice.quoted);
      const node = el('div', 'bx-menu', '', { role: 'dialog', 'aria-label': PRODUCT_NAME });
      const body = el('div', 'bx-menu-body');
      const status = el('div', 'bx-status', '', { role: 'status', 'aria-live': 'polite' });
      status.hidden = true;
      node.append(body, status);
      const current = openOverlay('menu', node, control, id, 'below');
      control.setAttribute('aria-expanded', 'true');
      control.setAttribute('aria-controls', node.id);

      const showDownload =
        settings.downloadsEnabled && settings.menuActions.download && choices.length > 0;
      if (showDownload) {
        const label = own.length
          ? downloadLabel(own.map((choice) => choice.item))
          : downloadLabel([], true);
        const download = button('bx-item', label, ICONS.download);
        download.dataset.download = '';
        download.addEventListener('click', (event) => {
          event.stopPropagation();
          if (!isSingle(choices)) return chooser(current, choices, body, status);
          download.disabled = true;
          downloadInto(current, status, own, () => (download.disabled = false));
        });
        body.append(download);
      }
      if (settings.menuActions.openLibrary) {
        const library = button('bx-item', 'Open bookmark library');
        library.addEventListener('click', (event) => {
          event.stopPropagation();
          library.disabled = true;
          void request({ type: 'openPanel' })
            .then(() => closeOverlay())
            .catch(() => {
              library.disabled = false;
              showStatus(
                status,
                `Could not open the library. Use the ${PRODUCT_NAME} toolbar icon.`,
              );
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
            saved.delete(id);
            renderAll(id);
            closeOverlay(true);
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
        chooser(current, choices, body, status);
      else body.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      place(node, control, 'below');
    }

    /* ------------------------------------------------------------------- saving */

    async function savePost(
      control: HTMLButtonElement,
      article: HTMLElement,
      draft: BookmarkDraft,
      viaKeyboard = false,
    ) {
      saving.add(draft.tweetId);
      renderAll(draft.tweetId);
      let ok = false;
      try {
        await request<Bookmark>({ type: 'save', draft });
        saved.add(draft.tweetId);
        ok = true;
      } catch {
        saved.delete(draft.tweetId);
      }
      saving.delete(draft.tweetId);
      renderAll(draft.tweetId);
      // X may have reused the article for another post while saving.
      if (buttons.get(control) !== draft.tweetId) return;
      control.dataset.feedback = ok ? 'saved' : 'error';
      setTimeout(() => delete control.dataset.feedback, 260);
      await settingsReady;
      if (buttons.get(control) !== draft.tweetId) return;
      if (ok) {
        control.title = 'Saved to your library';
        showChip(control, draft, viaKeyboard);
      } else {
        control.title = 'Could not save. Click to retry.';
        control.setAttribute('aria-label', 'Save failed. Click to retry');
        showSaveError(control, draft, article);
      }
    }

    /**
     * Matches the control to X's own icons in the same row: icon size and button box come
     * from the last native control (Share), then any remaining vertical offset is measured
     * and corrected. This holds across timeline/detail layouts, X font sizes, and zoom.
     */
    function align(targets: Iterable<HTMLButtonElement>) {
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

    const unaligned = new Set<HTMLButtonElement>();
    let alignFrame = 0;
    function queueAlign(control?: HTMLButtonElement) {
      if (control) unaligned.add(control);
      else buttons.forEach((_, item) => unaligned.add(item));
      cancelAnimationFrame(alignFrame);
      alignFrame = requestAnimationFrame(() => {
        align(unaligned);
        unaligned.clear();
      });
    }

    function enhance(article: HTMLElement) {
      // Quoted posts are nested articles in X's newer layout; only the outer post gets a control.
      if (article.parentElement?.closest(X_SELECTORS.post)) return;
      const identity = postIdentity(article);
      if (!identity) return;
      const existing = article.querySelector<HTMLButtonElement>('.bx-control');
      if (existing?.closest(X_SELECTORS.post) === article) {
        if (buttons.get(existing) !== identity.tweetId) {
          // X reused this article for another post: drop any overlay for the old one.
          if (overlay?.anchor === existing) closeOverlay();
          delete existing.dataset.feedback;
          buttons.set(existing, identity.tweetId);
          renderState(existing, identity.tweetId);
          queueAlign(existing);
        }
        return;
      }
      const row = actionRow(article);
      if (!row) return;
      const control = document.createElement('button');
      control.className = 'bx-control';
      control.type = 'button';
      control.innerHTML = icon;
      buttons.set(control, identity.tweetId);
      renderState(control, identity.tweetId);
      control.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const draft = extractPost(article);
        if (!draft) return;
        if (saved.has(draft.tweetId)) {
          if (overlay?.kind === 'menu' && overlay.anchor === control) return closeOverlay(true);
          // Re-capture missing author metadata without changing bookmark organization.
          void request<Bookmark>({ type: 'save', draft }).catch(() => {});
          void settingsReady.then(() => showMenu(control, draft));
          return;
        }
        // One click saves immediately; nothing is asked first and nothing downloads by itself.
        // A click with `detail === 0` came from the keyboard (Enter or Space).
        void savePost(control, article, draft, event.detail === 0);
      });
      row.append(control);
      queueAlign(control);
    }

    function scan(root: ParentNode) {
      if (root instanceof HTMLElement && root.matches(X_SELECTORS.post)) enhance(root);
      root.querySelectorAll<HTMLElement>(X_SELECTORS.post).forEach(enhance);
      for (const [control] of buttons) if (!control.isConnected) buttons.delete(control);
    }

    const pending = new Set<HTMLElement>();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target =
          mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const parent = target?.closest<HTMLElement>(X_SELECTORS.post) ?? null;
        if (parent) pending.add(parent);
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(X_SELECTORS.post)) pending.add(node);
          node
            .querySelectorAll<HTMLElement>(X_SELECTORS.post)
            .forEach((article) => pending.add(article));
        }
      }
      if (!pending.size || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const article of pending) if (article.isConnected) enhance(article);
        pending.clear();
        for (const [control] of buttons) if (!control.isConnected) buttons.delete(control);
        if (overlay && !overlay.anchor.isConnected) closeOverlay();
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    scan(document);
    void refreshSaved();
    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => queueAlign(), 150);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[LIBRARY_REVISION_KEY]) void refreshSaved();
    });
  },
});
