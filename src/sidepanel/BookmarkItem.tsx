import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Bookmark, Collection } from '../types/model';

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function BookmarkItem({
  bookmark,
  collection,
  onEdit,
  onDelete,
}: {
  bookmark: Bookmark;
  collection?: Collection;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const open = () => void chrome.tabs.create({ url: bookmark.url });
  const copy = async () => {
    await navigator.clipboard.writeText(bookmark.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    setMenuOpen(false);
  };
  return (
    <article className="bookmark-item">
      <button
        className="bookmark-main"
        onClick={open}
        aria-label={`Open post by ${bookmark.authorDisplayName || bookmark.authorHandle || 'unknown author'}`}
      >
        <span className="item-head">
          {bookmark.authorAvatarUrl ? (
            <img
              className="avatar"
              src={bookmark.authorAvatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="avatar avatar-fallback">
              {(bookmark.authorDisplayName || bookmark.authorHandle || '?')[0]?.toUpperCase()}
            </span>
          )}
          <span className="identity">
            <strong>
              {bookmark.authorDisplayName || bookmark.authorHandle || 'Unknown author'}
            </strong>
            <span>@{bookmark.authorHandle || 'unknown'}</span>
          </span>
          <span className="item-date">{formatDate(bookmark.savedAt)}</span>
        </span>
        <span className="item-text">{bookmark.text || 'Open this post on X'}</span>
      </button>
      <div className="item-bottom">
        <div className="chips">
          {collection && (
            <span className="chip">
              <Folder size={12} />
              {collection.name}
            </span>
          )}
          {bookmark.tags.slice(0, 3).map((tag) => (
            <span className="chip tag-chip" key={tag}>
              #{tag}
            </span>
          ))}
          {bookmark.tags.length > 3 && <span className="chip">+{bookmark.tags.length - 3}</span>}
          {bookmark.note && (
            <span className="note-indicator" title={bookmark.note}>
              <FileText size={14} />
            </span>
          )}
        </div>
        <div className="item-actions">
          <button
            className="icon-button"
            title="Edit bookmark"
            aria-label="Edit bookmark"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button"
            title="More actions"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal size={17} />
          </button>
          {menuOpen && (
            <div className="item-menu">
              <button onClick={open}>
                <ExternalLink size={15} />
                Open post
              </button>
              <button onClick={() => void copy()}>
                {copied ? <Check size={15} /> : <Copy size={15} />}Copy link
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="danger"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
