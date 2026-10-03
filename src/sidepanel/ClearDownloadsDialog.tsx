import { useEffect, useRef, useState } from 'react';
import { History } from 'lucide-react';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Clears the Downloaded collection's history. Files and bookmarks are never touched. */
export function ClearDownloadsDialog({
  postCount,
  activeCount,
  onCancel,
  onConfirm,
}: {
  postCount: number;
  activeCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear download history.');
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        className="editor confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-downloads-title"
        aria-describedby="clear-downloads-description"
      >
        <span className="confirm-icon" aria-hidden="true">
          <History size={18} />
        </span>
        <h2 id="clear-downloads-title">Clear download history?</h2>
        <div id="clear-downloads-description" className="confirm-copy">
          <p>
            {postCount
              ? `${plural(postCount, 'post')} will leave the Downloaded collection.`
              : 'Failed and cancelled download attempts will be cleared.'}
          </p>
          <p>
            Downloaded files stay on your computer, and your bookmarks, tags, and collections are
            not changed.
            {activeCount > 0 && ` ${plural(activeCount, 'download')} in progress will be kept.`}
          </p>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <button ref={cancelRef} className="text-button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Clearing…' : 'Clear history'}
          </button>
        </div>
      </section>
    </div>
  );
}
