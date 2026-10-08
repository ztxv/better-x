import { button, el, ICONS, place } from '../content/popover';
import { downloadLabel, errorMessage, itemLabel, OPEN_POST_ERRORS } from '../downloads/messages';
import { request } from '../lib/api';
import { mediaKey } from '../media/urls';
import { DOWNLOADS_REVISION_KEY } from '../storage/db';
import type {
  BookmarkDraft,
  DownloadError,
  DownloadRecord,
  MediaTarget,
  PostMedia,
  StartResult,
} from '../types/model';
import type { SavedContext } from './context';
import type { Overlay } from './overlay';

/** One downloadable item as offered on the page. */
export interface Choice {
  target: MediaTarget;
  item: PostMedia;
  label: string;
  quoted: boolean;
  postUrl: string;
}

export type ItemState =
  | { state: 'active'; recordId: string }
  | { state: 'done' | 'cancelled'; recordId: string }
  | { state: 'failed'; error: DownloadError; recordId: string | null };

/** Media the page shows for a post: its own first, then quoted media, labelled as such. */
export function choicesFor(draft: BookmarkDraft): Choice[] {
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

export const choiceId = (choice: Choice) => `${choice.target.scope}:${choice.target.index}`;
/** One Download click on a post with exactly one item of its own starts it immediately. */
export const isSingle = (choices: Choice[]) => choices.length === 1 && !choices[0]!.quoted;

/* ----------------------------------------------------------------- downloads */

/** The download currently reporting into each status line; older ones stop updating it. */
const statusOwner = new WeakMap<HTMLElement, object>();

/**
 * Starts downloading `selected` and shows progress and the outcome in `status`. Updates
 * come from the background's history, so only completed downloads ever read "Downloaded".
 */
export function downloadInto(
  ctx: SavedContext,
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
    if (ctx.overlay !== current || statusOwner.get(status) !== token) return;
    status.replaceChildren();
    const all = selected.map((choice) => ({ choice, state: states.get(choiceId(choice)) }));
    const active = all.filter((entry) => !entry.state || entry.state.state === 'active');
    const done = all.filter((entry) => entry.state?.state === 'done');
    const failed = all.flatMap((entry) =>
      entry.state?.state === 'failed' ? [{ choice: entry.choice, error: entry.state.error }] : [],
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
    if (tone) line.insertAdjacentHTML('afterbegin', tone === 'done' ? ICONS.check : ICONS.alert);
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
          ctx,
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
export function chooser(
  ctx: SavedContext,
  current: Overlay,
  choices: Choice[],
  body: HTMLElement,
  status: HTMLElement,
) {
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
      downloadInto(ctx, current, status, [choice]);
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
      downloadInto(ctx, current, status, group);
    });
    body.append(all);
  }
  place(current.node, current.anchor, current.prefer);
  body.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}
