import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FolderOpen, RotateCcw, X } from 'lucide-react';
import { request } from '../lib/api';
import { ACTIVE, DONE } from '../downloads/repository';
import { latestByMedia } from '../downloads/history';
import { errorMessage, itemLabel, OPEN_POST_ERRORS, statusText } from '../downloads/messages';
import { mediaKey } from '../media/urls';
import type {
  BookmarkDraft,
  DownloadError,
  DownloadRecord,
  MediaTarget,
  PostMedia,
  StartResult,
} from '../types/model';
import { useFileStatus } from './hooks';
import { Thumb } from './PostContext';

interface Row {
  target: MediaTarget;
  item: PostMedia;
  key: string;
  label: string;
  quoted: boolean;
  postUrl: string;
}

/** Every downloadable item of a post: its own media, then its quoted post's media. */
export function downloadRows(post: BookmarkDraft): Row[] {
  const rows: Row[] = post.media.map((item, index) => ({
    target: { tweetId: post.tweetId, scope: 'post', index, key: mediaKey(item, index) },
    item,
    key: `${post.tweetId}:${mediaKey(item, index)}`,
    label: itemLabel(item.kind, index, post.media.length, false),
    quoted: false,
    postUrl: post.url,
  }));
  const quote = post.quote;
  if (quote?.tweetId && quote.url)
    quote.media.forEach((item, index) =>
      rows.push({
        target: { tweetId: post.tweetId, scope: 'quote', index, key: mediaKey(item, index) },
        item,
        key: `${quote.tweetId}:${mediaKey(item, index)}`,
        label: itemLabel(item.kind, index, quote.media.length, true),
        quoted: true,
        postUrl: quote.url!,
      }),
    );
  return rows;
}

/**
 * Downloads for one saved post. Progress and outcomes come from the shared history, so this
 * view, the X page, and the Downloaded collection always agree.
 */
export function DownloadDialog({
  post,
  records,
  onClose,
}: {
  post: BookmarkDraft;
  records: DownloadRecord[];
  onClose: () => void;
}) {
  const rows = downloadRows(post);
  const latest = latestByMedia(records);
  const files = useFileStatus(records);
  const [starting, setStarting] = useState<Set<string>>(new Set());
  // Failures that never created a record (for example, the post can no longer be read).
  const [failures, setFailures] = useState<Map<string, DownloadError>>(new Map());
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = async (selected: Row[]) => {
    setError('');
    setStarting((previous) => new Set([...previous, ...selected.map((row) => row.key)]));
    try {
      const result = await request<StartResult>({
        type: 'startDownload',
        targets: selected.map((row) => row.target),
      });
      setFailures((previous) => {
        const next = new Map(previous);
        for (const row of selected) next.delete(row.key);
        for (const outcome of result.outcomes) {
          if (outcome.status !== 'failed' || outcome.recordId) continue;
          const row = selected.find(
            (entry) =>
              entry.target.scope === outcome.target.scope &&
              entry.target.index === outcome.target.index,
          );
          if (row) next.set(row.key, outcome.error);
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the download.');
    } finally {
      setStarting((previous) => {
        const next = new Set(previous);
        for (const row of selected) next.delete(row.key);
        return next;
      });
    }
  };

  const own = rows.filter((row) => !row.quoted);
  // Items still worth trying: not done, not running, and not known to be unavailable.
  const remaining = own.filter((row) => {
    const record = latest.get(row.key);
    const error = failures.get(row.key) ?? record?.error;
    if (error && OPEN_POST_ERRORS.has(error)) return false;
    return !record || !(DONE.has(record.status) || ACTIVE.has(record.status));
  });
  const anyDone = own.some((row) => DONE.has(latest.get(row.key)?.status ?? 'cancelled'));

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="editor download-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
      >
        <div className="editor-head">
          <div>
            <h2 id="download-title">Download media</h2>
            <p>
              Files save to your Downloads folder, in <code>Better-X</code>.
            </p>
          </div>
          <button ref={closeRef} className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <ul className="download-rows">
          {rows.map((row, index) => {
            const record = latest.get(row.key);
            const failure = failures.get(row.key);
            const busy = starting.has(row.key) || (!!record && ACTIVE.has(record.status));
            const done = !!record && DONE.has(record.status);
            const failedError =
              failure ??
              (record && (record.status === 'interrupted' || record.status === 'cancelled')
                ? record.error
                : undefined);
            const openPost = !!failedError && OPEN_POST_ERRORS.has(failedError);
            const fileExists =
              record?.status === 'complete' && record.chromeId !== null
                ? files.get(record.chromeId)
                : undefined;
            let detail = starting.has(row.key)
              ? 'Starting…'
              : failure
                ? errorMessage(failure, row.item.kind)
                : record
                  ? statusText(record)
                  : '';
            if (record?.status === 'complete')
              detail =
                fileExists === true
                  ? 'File available locally'
                  : fileExists === false
                    ? 'Downloaded previously · file moved or deleted'
                    : 'Downloaded';
            return (
              <li key={row.key}>
                {row.quoted && !rows[index - 1]?.quoted && (
                  <div className="download-group">From the quoted post</div>
                )}
                <div className="download-row">
                  <Thumb item={row.item} compact />
                  <div className="download-meta">
                    <strong>{row.label}</strong>
                    <span
                      className={`download-detail ${failedError && record?.status !== 'cancelled' ? 'is-error' : ''} ${done ? 'is-done' : ''}`}
                      aria-live="polite"
                    >
                      {detail || (record?.filename ? record.filename : '')}
                    </span>
                  </div>
                  <div className="download-actions">
                    {busy && record?.status !== undefined && ACTIVE.has(record.status) ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          void request({ type: 'cancelDownload', recordId: record.id }).catch(() =>
                            setError('Could not cancel that download.'),
                          )
                        }
                      >
                        Cancel
                      </button>
                    ) : openPost ? (
                      <a
                        className="text-button"
                        href={row.postUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={13} /> Open post
                      </a>
                    ) : (
                      <>
                        {fileExists && record?.chromeId != null && (
                          <button
                            className="icon-button"
                            title="Show in folder"
                            aria-label={`Show ${row.label.toLowerCase()} in folder`}
                            onClick={() => chrome.downloads.show(record.chromeId!)}
                          >
                            <FolderOpen size={15} />
                          </button>
                        )}
                        <button
                          className="icon-button"
                          disabled={busy}
                          title={done ? 'Download again' : failedError ? 'Retry' : 'Download'}
                          aria-label={`${done ? 'Download again' : failedError ? 'Retry' : 'Download'}: ${row.label}`}
                          onClick={() => void start([row])}
                        >
                          {failedError ? <RotateCcw size={15} /> : <Download size={15} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <span className="footer-note">Removing a bookmark never deletes downloaded files.</span>
          {own.length > 1 && remaining.length > 0 && (
            <button
              className="primary-button"
              disabled={remaining.some((row) => starting.has(row.key))}
              onClick={() => void start(remaining)}
            >
              {anyDone
                ? `Download remaining (${remaining.length})`
                : `Download all (${own.length})`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
