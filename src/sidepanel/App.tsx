import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers2 as BookmarkIcon,
  Check,
  ChevronDown,
  Download,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Settings2,
  Trash,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { request } from '../lib/api';
import { validateExport } from '../lib/validation';
import { exportDownloads } from '../downloads/history';
import { BookmarkItem } from './BookmarkItem';
import { SelectionBar } from './SelectionBar';
import { ClearAllDialog } from './ClearAllDialog';
import { BookmarkEditor } from './BookmarkEditor';
import {
  EXPORT_VERSION,
  type Bookmark,
  type BulkAction,
  type BulkResult,
  type ClearResult,
  type Collection,
  type DownloadRecord,
  type ExportData,
  type Library,
} from '../types/model';

const emptyLibrary: Library = { bookmarks: [], collections: [] };
type View = { kind: 'all' } | { kind: 'collection'; id: string } | { kind: 'tag'; name: string };
type Theme = 'auto' | 'light' | 'dark';

function useLibrary() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setLibrary(await request<Library>({ type: 'list' }));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load bookmarks.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.libraryRevision) void refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);
  return { library, loading, error, refresh };
}

export function App() {
  const { library, loading, error, refresh } = useLibrary();
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [author, setAuthor] = useState('');
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [undo, setUndo] = useState<Bookmark[]>([]);
  useEffect(() => {
    setSelected(new Set());
  }, [query, view, author]);
  useEffect(() => {
    if (!undo.length) return;
    const timer = setTimeout(() => setUndo([]), 10000);
    return () => clearTimeout(timer);
  }, [undo]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [newCollection, setNewCollection] = useState(false);
  const [collectionMenu, setCollectionMenu] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'auto',
  );
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  const tags = useMemo(
    () => [...new Set(library.bookmarks.flatMap((bookmark) => bookmark.tags))].sort(),
    [library],
  );
  const authors = useMemo(
    () =>
      [
        ...new Set(
          library.bookmarks
            .map((bookmark) => bookmark.authorHandle)
            .filter((value): value is string => !!value),
        ),
      ].sort(),
    [library],
  );
  const collectionById = useMemo(
    () => new Map(library.collections.map((collection) => [collection.id, collection])),
    [library],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return library.bookmarks
      .filter((bookmark) => {
        if (view.kind === 'collection' && bookmark.collectionId !== view.id) return false;
        if (view.kind === 'tag' && !bookmark.tags.includes(view.name)) return false;
        if (author && bookmark.authorHandle !== author) return false;
        if (!needle) return true;
        return [
          bookmark.text,
          bookmark.authorHandle,
          bookmark.authorDisplayName,
          bookmark.note,
          bookmark.quote?.text,
          bookmark.quote?.authorHandle,
          bookmark.quote?.authorDisplayName,
          bookmark.replyTo?.authorHandle,
          bookmark.card?.title,
          bookmark.card?.domain,
          ...bookmark.media.map((item) => item.alt),
          collectionById.get(bookmark.collectionId || '')?.name,
          ...bookmark.tags,
        ].some((value) => value?.toLowerCase().includes(needle));
      })
      .sort((a, b) =>
        sort === 'newest' ? b.savedAt.localeCompare(a.savedAt) : a.savedAt.localeCompare(b.savedAt),
      );
  }, [library, query, view, author, sort, collectionById]);
  const showNotice = (value: string) => {
    setNotice(value);
    setTimeout(() => setNotice(''), 3500);
  };
  const createCollection = async () => {
    try {
      await request({ type: 'createCollection', name: collectionName });
      setCollectionName('');
      setNewCollection(false);
      await refresh();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not create collection.');
    }
  };
  const renameCollection = async (collection: Collection) => {
    const name = prompt('Rename collection', collection.name);
    if (name === null || name.trim() === collection.name) return;
    try {
      await request({ type: 'renameCollection', id: collection.id, name });
      await refresh();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not rename collection.');
    }
  };
  const removeCollection = async (collection: Collection) => {
    if (!confirm(`Delete “${collection.name}”? Its bookmarks will stay in All Bookmarks.`)) return;
    try {
      await request({ type: 'deleteCollection', id: collection.id });
      setView({ kind: 'all' });
      await refresh();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not delete collection.');
    }
  };
  const performBulk = async (ids: string[], action: BulkAction) => {
    if (!ids.length || bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await request<BulkResult>({ type: 'bulk', ids, action });
      setSelected(new Set());
      if (action.type === 'delete') {
        setUndo(result.deleted);
        setNotice('');
      } else
        showNotice(
          `Updated ${result.affected} ${result.affected === 1 ? 'bookmark' : 'bookmarks'}.`,
        );
      await refresh();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not update bookmarks.');
    } finally {
      setBulkBusy(false);
    }
  };
  const removeBookmark = (bookmark: Bookmark) => performBulk([bookmark.id], { type: 'delete' });
  const undoDelete = async () => {
    setBulkBusy(true);
    try {
      await request({ type: 'restore', bookmarks: undo });
      setUndo([]);
      await refresh();
      showNotice('Bookmarks restored.');
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not restore bookmarks.');
    } finally {
      setBulkBusy(false);
    }
  };
  const clearAll = async () => {
    const result = await request<ClearResult>({ type: 'clearBookmarks' });
    setClearOpen(false);
    setSelecting(false);
    setSelected(new Set());
    setView({ kind: 'all' });
    setNotice('');
    setUndo(result.deleted);
    if (!result.deleted.length) showNotice('There were no bookmarks to delete.');
    await refresh();
  };
  const selectedIds = filtered
    .filter((bookmark) => selected.has(bookmark.id))
    .map((bookmark) => bookmark.id);
  const toggleSelected = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exportJson = async () => {
    const records = await request<DownloadRecord[]>({ type: 'downloads' }).catch(() => []);
    const data: ExportData = {
      format: 'saved-for-x',
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      ...library,
      downloads: exportDownloads(records),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `saved-for-x-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSettingsOpen(false);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 50_000_000) throw new Error('Import file is too large.');
      const data = validateExport(JSON.parse(await file.text()) as unknown);
      const result = await request<{ imported: number }>({ type: 'import', data });
      await refresh();
      showNotice(
        `Imported ${result.imported} ${result.imported === 1 ? 'bookmark' : 'bookmarks'}.`,
      );
      setSettingsOpen(false);
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Import failed.');
    }
    if (importRef.current) importRef.current.value = '';
  };
  const title =
    view.kind === 'all'
      ? 'All Bookmarks'
      : view.kind === 'tag'
        ? `#${view.name}`
        : collectionById.get(view.id)?.name || 'Collection';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <BookmarkIcon className="brand-glyph" size={22} strokeWidth={1.8} />
          </span>
          <div>
            <strong>Saved</strong>
            <span>for X</span>
          </div>
        </div>
        <button
          className="icon-button settings-button"
          aria-label="Settings and data"
          title="Settings and data"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Settings2 size={18} />
        </button>
      </header>
      {settingsOpen && (
        <div className="settings-menu">
          <div className="menu-title">Appearance</div>
          <div className="theme-switch">
            {(['auto', 'light', 'dark'] as Theme[]).map((value) => (
              <button
                className={theme === value ? 'active' : ''}
                key={value}
                onClick={() => setTheme(value)}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <div className="menu-divider" />
          <button onClick={() => void exportJson()}>
            <Download size={15} />
            Export JSON
          </button>
          <button onClick={() => importRef.current?.click()}>
            <Upload size={15} />
            Import JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void importJson(event.target.files?.[0])}
          />
          <div className="menu-divider" />
          <button
            className="danger"
            disabled={!library.bookmarks.length}
            onClick={() => {
              setSettingsOpen(false);
              setClearOpen(true);
            }}
          >
            <Trash size={15} />
            Clear all bookmarks…
          </button>
        </div>
      )}
      <div className="search-wrap">
        <Search size={17} />
        <input
          type="search"
          aria-label="Search bookmarks"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your bookmarks"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </div>
      <nav className="library-nav" aria-label="Library">
        <button
          className={`nav-all ${view.kind === 'all' ? 'selected' : ''}`}
          onClick={() => setView({ kind: 'all' })}
        >
          <BookmarkIcon size={16} />
          <span>All Bookmarks</span>
          <small>{library.bookmarks.length}</small>
        </button>
        <div className="nav-heading">
          <span>COLLECTIONS</span>
          <button
            className="icon-button"
            aria-label="New collection"
            title="New collection"
            onClick={() => setNewCollection(!newCollection)}
          >
            <FolderPlus size={16} />
          </button>
        </div>
        {newCollection && (
          <form
            className="new-collection"
            onSubmit={(event) => {
              event.preventDefault();
              void createCollection();
            }}
          >
            <input
              autoFocus
              maxLength={80}
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="Collection name"
              aria-label="Collection name"
            />
            <button type="submit" aria-label="Create collection">
              <Check size={16} />
            </button>
          </form>
        )}
        {library.collections.map((collection) => (
          <div
            className={`collection-row ${view.kind === 'collection' && view.id === collection.id ? 'selected' : ''}`}
            key={collection.id}
          >
            <button
              className="collection-select"
              onClick={() => setView({ kind: 'collection', id: collection.id })}
            >
              <Folder size={15} />
              <span>{collection.name}</span>
              <small>
                {
                  library.bookmarks.filter((bookmark) => bookmark.collectionId === collection.id)
                    .length
                }
              </small>
            </button>
            <button
              className="collection-more"
              aria-label={`Manage ${collection.name}`}
              aria-expanded={collectionMenu === collection.id}
              onClick={() =>
                setCollectionMenu(collectionMenu === collection.id ? null : collection.id)
              }
            >
              <MoreHorizontal size={15} />
            </button>
            {collectionMenu === collection.id && (
              <div className="collection-menu">
                <button
                  onClick={() => {
                    setCollectionMenu(null);
                    void renameCollection(collection);
                  }}
                >
                  <Pencil size={14} />
                  Rename
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setCollectionMenu(null);
                    void removeCollection(collection);
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {tags.length > 0 && (
          <>
            <div className="nav-heading tags-heading">
              <span>TAGS</span>
            </div>
            <div className="tag-list">
              {tags.map((tag) => (
                <button
                  className={view.kind === 'tag' && view.name === tag ? 'selected' : ''}
                  key={tag}
                  onClick={() => setView({ kind: 'tag', name: tag })}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}
      </nav>
      <main className="main-content">
        <div className="list-head">
          <div>
            <h1>{title}</h1>
            <span>
              {filtered.length} {filtered.length === 1 ? 'bookmark' : 'bookmarks'}
            </span>
          </div>
          <div className="filters">
            <label>
              <span className="sr-only">Filter by author</span>
              <select value={author} onChange={(event) => setAuthor(event.target.value)}>
                <option value="">All authors</option>
                {authors.map((value) => (
                  <option key={value} value={value}>
                    @{value}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label>
              <span className="sr-only">Sort bookmarks</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </div>
        {selecting ? (
          <SelectionBar
            count={selectedIds.length}
            total={filtered.length}
            collections={library.collections}
            tags={tags}
            busy={bulkBusy}
            onToggleAll={() =>
              setSelected(
                selectedIds.length === filtered.length
                  ? new Set()
                  : new Set(filtered.map((bookmark) => bookmark.id)),
              )
            }
            onExit={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
            onAction={(action) => void performBulk(selectedIds, action)}
          />
        ) : (
          <div className="selection-entry">
            <button
              className="text-button"
              disabled={!filtered.length}
              onClick={() => setSelecting(true)}
            >
              Select bookmarks
            </button>
          </div>
        )}
        {error ? (
          <div className="empty-state">
            <strong>Could not load your library</strong>
            <p>{error}</p>
            <button className="primary-button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="loading-state">Loading bookmarks…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              {query ? <Search size={23} /> : <BookmarkIcon size={23} />}
            </span>
            <strong>
              {query
                ? `No results for “${query}”`
                : library.bookmarks.length
                  ? 'Nothing here yet'
                  : 'No bookmarks yet'}
            </strong>
            <p>
              {query
                ? 'Try another search term or filter.'
                : library.bookmarks.length
                  ? 'Save a bookmark to this collection or tag.'
                  : 'Save a post on X and it will appear here.'}
            </p>
          </div>
        ) : (
          <div className="bookmark-list">
            {filtered.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                selecting={selecting}
                selected={selected.has(bookmark.id)}
                busy={bulkBusy}
                onToggle={() => toggleSelected(bookmark.id)}
                collection={collectionById.get(bookmark.collectionId || '')}
                onEdit={() => setEditing(bookmark)}
                onDelete={() => void removeBookmark(bookmark)}
              />
            ))}
          </div>
        )}
      </main>
      {undo.length > 0 && !notice && (
        <div className="toast undo-toast" role="status">
          <span>
            {undo.length} {undo.length === 1 ? 'bookmark' : 'bookmarks'} deleted
          </span>
          <button disabled={bulkBusy} onClick={() => void undoDelete()}>
            Undo
          </button>
          <button aria-label="Dismiss undo" onClick={() => setUndo([])}>
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {clearOpen && (
        <ClearAllDialog
          bookmarkCount={library.bookmarks.length}
          collectionCount={library.collections.length}
          onExport={() => void exportJson()}
          onCancel={() => setClearOpen(false)}
          onConfirm={clearAll}
        />
      )}
      {editing && (
        <BookmarkEditor
          key={editing.id}
          bookmark={editing}
          collections={library.collections}
          existingTags={tags}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
            showNotice('Bookmark updated.');
          }}
        />
      )}
    </div>
  );
}
