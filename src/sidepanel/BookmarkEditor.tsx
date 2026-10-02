import { useState } from 'react';
import { X } from 'lucide-react';
import { request } from '../lib/api';
import { normalizeTag } from '../lib/validation';
import type { Bookmark, Collection } from '../types/model';

export function BookmarkEditor({
  bookmark,
  collections,
  existingTags,
  onClose,
  onSaved,
}: {
  bookmark: Bookmark;
  collections: Collection[];
  existingTags: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [collectionId, setCollectionId] = useState(bookmark.collectionId || '');
  const [tags, setTags] = useState(bookmark.tags);
  const [tagInput, setTagInput] = useState('');
  const [note, setNote] = useState(bookmark.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const suggestions = existingTags
    .filter((tag) => tag.includes(tagInput.toLowerCase()) && !tags.includes(tag))
    .slice(0, 5);
  const addTag = (value: string) => {
    const tag = normalizeTag(value);
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };
  const save = async () => {
    setSaving(true);
    try {
      await request({
        type: 'update',
        id: bookmark.id,
        patch: { collectionId: collectionId || null, tags, note },
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes.');
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="editor" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="editor-head">
          <div>
            <h2 id="edit-title">Edit bookmark</h2>
            <p>@{bookmark.authorHandle || 'unknown'}</p>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="field-label" htmlFor="collection">
          Collection
        </label>
        <select
          id="collection"
          value={collectionId}
          onChange={(event) => setCollectionId(event.target.value)}
        >
          <option value="">No collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="tags">
          Tags
        </label>
        <div className="tag-input-wrap">
          <div className="editor-tags">
            {tags.map((tag) => (
              <span className="edit-tag" key={tag}>
                #{tag}
                <button
                  aria-label={`Remove ${tag}`}
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <input
            id="tags"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addTag(tagInput);
              }
            }}
            onBlur={() => {
              if (tagInput) addTag(tagInput);
            }}
            placeholder="Type a tag, then Enter"
            maxLength={40}
          />
        </div>
        {tagInput && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((tag) => (
              <button
                key={tag}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        <label className="field-label" htmlFor="note">
          Private note
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why did you save this?"
          rows={4}
          maxLength={10000}
        />
        {error && <p className="error-text">{error}</p>}
        <div className="editor-footer">
          <button className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>
    </div>
  );
}
