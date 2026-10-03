import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Layers2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Bookmark, Collection } from '../types/model';
import {
  contextSummary,
  hasContext,
  LinkPreview,
  MediaStrip,
  QuoteBox,
  ReplyLine,
} from './PostContext';

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

/** A card's download state, shown beside its collection and tags. */
export interface DownloadBadge {
  text: string;
  tone: 'done' | 'partial' | 'active' | 'historical';
}

export function BookmarkItem({
  bookmark,
  collection,
  onEdit,
  onDelete,
  selecting = false,
  selected = false,
  onToggle,
  busy = false,
  badge,
  downloadLabel,
  onDownload,
  removed = false,
  onSave,
}: {
  bookmark: Bookmark;
  collection?: Collection;
  onEdit: () => void;
  onDelete: () => void;
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  busy?: boolean;
  badge?: DownloadBadge;
  /** Menu label for the download action; the action is hidden without it. */
  downloadLabel?: string;
  onDownload?: () => void;
  /** A post shown only from download history: its bookmark was removed. */
  removed?: boolean;
  onSave?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = () => void chrome.tabs.create({ url: bookmark.url });
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(bookmark.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    closeMenu(true);
  };
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMenu(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeMenu();
    };
    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onPointer, true);
    return () => {
      removeEventListener('keydown', onKey, true);
      removeEventListener('pointerdown', onPointer, true);
    };
  }, [menuOpen]);
  const menuId = `item-menu-${bookmark.id}`;
  return (
    <article
      className={`bookmark-item ${selecting ? 'is-selecting' : ''} ${selected ? 'is-selected' : ''} ${removed ? 'is-removed' : ''}`}
    >
      {selecting && (
        <input
          className="selection-checkbox"
          type="checkbox"
          checked={selected}
          disabled={busy}
          onChange={onToggle}
          aria-label={`Select bookmark by ${bookmark.authorHandle || 'unknown author'}`}
        />
      )}
      <button
        className="bookmark-main"
        onClick={selecting ? onToggle : open}
        disabled={busy}
        aria-pressed={selecting ? selected : undefined}
        aria-label={[
          `${selecting ? 'Select' : 'Open'} post by ${bookmark.authorDisplayName || bookmark.authorHandle || 'unknown author'}`,
          contextSummary(bookmark),
          badge?.text,
          removed ? 'not in bookmarks' : '',
        ]
          .filter(Boolean)
          .join(', ')}
      >
        <span className="item-head">
          {bookmark.authorAvatarUrl && failedAvatar !== bookmark.authorAvatarUrl ? (
            <img
              className="avatar"
              src={bookmark.authorAvatarUrl}
              onError={() => setFailedAvatar(bookmark.authorAvatarUrl)}
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
        <span className="item-body">
          {bookmark.replyTo && <ReplyLine reply={bookmark.replyTo} />}
          {bookmark.text ? (
            <span className="item-text">{bookmark.text}</span>
          ) : (
            !hasContext(bookmark) && (
              <span className="item-text is-muted">
                No text was captured for this post. Open it on X to see it.
              </span>
            )
          )}
          <MediaStrip media={bookmark.media} />
          {bookmark.quote && <QuoteBox quote={bookmark.quote} />}
          {bookmark.card && <LinkPreview card={bookmark.card} />}
        </span>
      </button>
      <div className="item-bottom">
        <div className="chips">
          {removed && <span className="chip removed-chip">Not in bookmarks</span>}
          {collection && (
            <span className="chip">
              <Folder size={12} />
              {collection.name}
            </span>
          )}
          {badge && (
            <span className={`chip download-chip is-${badge.tone}`}>
              <Download size={12} />
              {badge.text}
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
        {!selecting && (
          <div className="item-actions">
            {removed ? (
              <button
                className="icon-button"
                title="Save bookmark"
                aria-label="Save bookmark"
                onClick={onSave}
              >
                <Layers2 size={15} />
              </button>
            ) : (
              <button
                className="icon-button"
                title="Edit bookmark"
                aria-label="Edit bookmark"
                onClick={onEdit}
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              ref={triggerRef}
              className="icon-button"
              title="More actions"
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal size={17} />
            </button>
            {menuOpen && (
              <div className="item-menu" id={menuId} ref={menuRef}>
                {downloadLabel && onDownload && (
                  <button
                    onClick={() => {
                      closeMenu();
                      onDownload();
                    }}
                  >
                    <Download size={15} />
                    {downloadLabel}
                  </button>
                )}
                <button
                  onClick={() => {
                    closeMenu(true);
                    open();
                  }}
                >
                  <ExternalLink size={15} />
                  Open post
                </button>
                <button onClick={() => void copy()}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}Copy link
                </button>
                {removed ? (
                  <button
                    onClick={() => {
                      closeMenu(true);
                      onSave?.();
                    }}
                  >
                    <Layers2 size={15} />
                    Save bookmark
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      closeMenu();
                      onDelete();
                    }}
                    className="danger"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
