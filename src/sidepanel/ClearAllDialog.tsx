import { useEffect, useRef, useState } from 'react';
import { Download, TriangleAlert } from 'lucide-react';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The one deliberate confirmation in the app: wiping every bookmark. */
export function ClearAllDialog({
  bookmarkCount,
  collectionCount,
  onExport,
  onCancel,
  onConfirm,
}: {
  bookmarkCount: number;
  collectionCount: number;
  onExport: () => void;
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
      setError(cause instanceof Error ? cause.message : 'Could not delete bookmarks.');
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
        aria-labelledby="clear-title"
        aria-describedby="clear-description"
      >
        <span className="confirm-icon" aria-hidden="true">
          <TriangleAlert size={18} />
        </span>
        <h2 id="clear-title">Delete all {plural(bookmarkCount, 'bookmark')}?</h2>
        <div id="clear-description" className="confirm-copy">
          <p>
            This permanently removes every saved post in this browser, with its tags, notes, and
            collection placement.
          </p>
          <p>
            {collectionCount
              ? `Your ${plural(collectionCount, 'collection')} and appearance settings are kept.`
              : 'Collections and appearance settings are kept.'}
          </p>
        </div>
        <button className="backup-button" disabled={busy} onClick={onExport}>
          <Download size={14} />
          Export a JSON backup first
        </button>
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
            {busy ? 'Deleting…' : `Delete ${plural(bookmarkCount, 'bookmark')}`}
          </button>
        </div>
      </section>
    </div>
  );
}
