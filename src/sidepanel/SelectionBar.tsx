import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { BulkAction, Collection } from '../types/model';

interface Props {
  count: number;
  total: number;
  collections: Collection[];
  tags: string[];
  busy: boolean;
  onToggleAll: () => void;
  onExit: () => void;
  onAction: (action: BulkAction) => void;
}

export function SelectionBar({
  count,
  total,
  collections,
  tags,
  busy,
  onToggleAll,
  onExit,
  onAction,
}: Props) {
  const [collection, setCollection] = useState('');
  const [tag, setTag] = useState('');
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = count > 0 && count < total;
  }, [count, total]);
  return (
    <section className="selection-bar" aria-label="Bulk bookmark actions" aria-busy={busy}>
      <div className="selection-summary">
        <label>
          <input
            ref={allRef}
            type="checkbox"
            checked={total > 0 && count === total}
            onChange={onToggleAll}
            disabled={busy || total === 0}
          />
          Select all
        </label>
        <span aria-live="polite">{count} selected</span>
        <button className="text-button" disabled={busy} onClick={onExit}>
          Done
        </button>
      </div>
      <div className="bulk-field">
        <select
          aria-label="Move selected to collection"
          value={collection}
          onChange={(event) => setCollection(event.target.value)}
          disabled={busy}
        >
          <option value="">Choose collection</option>
          <option value="__none">No collection</option>
          {collections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !count || !collection}
          onClick={() =>
            onAction({ type: 'move', collectionId: collection === '__none' ? null : collection })
          }
        >
          Move
        </button>
      </div>
      <form
        className="bulk-field"
        onSubmit={(event) => {
          event.preventDefault();
          if (tag.trim() && count && !busy) onAction({ type: 'addTag', tag });
        }}
      >
        <input
          aria-label="Tag for selected bookmarks"
          placeholder="Add a tag"
          list="bulk-tags"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          maxLength={40}
          disabled={busy}
        />
        <datalist id="bulk-tags">
          {tags.map((item) => (
            <option value={item} key={item} />
          ))}
        </datalist>
        <button type="submit" disabled={busy || !count || !tag.trim()}>
          Add tag
        </button>
      </form>
      <button
        className="bulk-delete"
        disabled={busy || !count}
        onClick={() => onAction({ type: 'delete' })}
      >
        <Trash2 size={14} />
        {busy ? 'Updating…' : `Delete selected${count ? ` (${count})` : ''}`}
      </button>
    </section>
  );
}
