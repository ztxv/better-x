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
  Trash2,
  X,
} from 'lucide-react';
import { request } from '../lib/api';
import { createBackup } from '../lib/backup';
import { resetSettings } from '../lib/settings';
import { LIBRARY_REVISION_KEY } from '../storage/db';
import { validateExport } from '../lib/validation';
import { groupByPost, type PostDownloads } from '../downloads/history';
import { downloadLabel, errorMessage } from '../downloads/messages';
import { BookmarkItem, type DownloadBadge } from './BookmarkItem';
import { SelectionBar } from './SelectionBar';
import { ClearAllDialog } from './ClearAllDialog';
import { ClearDownloadsDialog } from './ClearDownloadsDialog';
import { BookmarkEditor } from './BookmarkEditor';
import { DownloadDialog, downloadRows } from './DownloadDialog';
import { Customize } from './Customize';
import { SectionTabs, type Section } from './SectionTabs';
import { SettingsDialog } from './SettingsDialog';
import { useDownloads, useSettings } from './hooks';
import {
  SCHEMA_VERSION,
  type Bookmark,
  type BookmarkDraft,
  type BulkAction,
  type BulkResult,
  type ClearDownloadsResult,
  type ClearResult,
  type Collection,
  type DownloadRecord,
  type Library,
  type StartResult,
} from '../types/model';

const emptyLibrary: Library = { bookmarks: [], collections: [] };
type View =
  | { kind: 'all' }
  | { kind: 'downloaded' }
  | { kind: 'collection'; id: string }
  | { kind: 'tag'; name: string };

/** One card in the list: a bookmark, or (in Downloaded) a removed post kept by its history. */
interface Entry {
  bookmark: Bookmark;
  removed: boolean;
  downloads?: PostDownloads;
  /** Sort key: when it was saved, or in Downloaded, when it was last downloaded. */
  sortAt: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A card for a post that is only in download history (its bookmark was removed). */
function fromSnapshot(snapshot: BookmarkDraft, at: string): Bookmark {
  return {
    ...snapshot,
    id: snapshot.tweetId,
    savedAt: at,
    collectionId: null,
    tags: [],
    note: '',
    schemaVersion: SCHEMA_VERSION,
  };
}

/** "Downloaded", "2 of 4 downloaded", or "Downloading…" for a card. */
function badgeFor(
  post: BookmarkDraft,
  group: PostDownloads | undefined,
): DownloadBadge | undefined {
  if (!group) return undefined;
  const done = group.done.size;
  if (!done) return group.active.length ? { text: 'Downloading…', tone: 'active' } : undefined;
  // Quoted media counts toward the total only once some of it has been downloaded.
  const quoteTried = group.records.some((record) => record.scope === 'quote');
  const total = post.media.length + (quoteTried ? (post.quote?.media.length ?? 0) : 0);
  if (group.active.length) return { text: 'Downloading…', tone: 'active' };
  if (total > done) return { text: `${done} of ${total} downloaded`, tone: 'partial' };
  return group.historicalOnly
    ? { text: 'Downloaded previously', tone: 'historical' }
    : { text: 'Downloaded', tone: 'done' };
}

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
      if (area === 'local' && changes[LIBRARY_REVISION_KEY]) void refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);
  return { library, loading, error, refresh };
}

export function App() {
  const { library, loading, error, refresh } = useLibrary();
  const { settings, update: updateSettings } = useSettings();
  const { records, refresh: refreshDownloads } = useDownloads();
  const [section, setSection] = useState<Section>('library');
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [author, setAuthor] = useState('');
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [downloading, setDownloading] = useState<BookmarkDraft | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [undo, setUndo] = useState<Bookmark[]>([]);
  const [undoDownloads, setUndoDownloads] = useState<DownloadRecord[]>([]);
  useEffect(() => {
    setSelected(new Set());
  }, [query, view, author]);
  useEffect(() => {
    if (!undo.length && !undoDownloads.length) return;
    const timer = setTimeout(() => {
      setUndo([]);
      setUndoDownloads([]);
    }, 10000);
    return () => clearTimeout(timer);
  }, [undo, undoDownloads]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearDownloadsOpen, setClearDownloadsOpen] = useState(false);
  const [newCollection, setNewCollection] = useState(false);
  const [collectionMenu, setCollectionMenu] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => groupByPost(records), [records]);
  const bookmarkById = useMemo(
    () => new Map(library.bookmarks.map((bookmark) => [bookmark.id, bookmark])),
    [library],
  );
  /** Posts with at least one completed download, newest completion first. */
  const downloaded = useMemo(
    () =>
      [...groups.values()]
        .filter((group) => group.done.size > 0)
        .map((group): Entry => {
          const bookmark = bookmarkById.get(group.tweetId);
          return {
            bookmark: bookmark ?? fromSnapshot(group.snapshot, group.lastCompletedAt!),
            removed: !bookmark,
            downloads: group,
            sortAt: group.lastCompletedAt!,
          };
        }),
    [groups, bookmarkById],
  );
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
    const source: Entry[] =
      view.kind === 'downloaded'
        ? downloaded
        : library.bookmarks.map((bookmark) => ({
            bookmark,
            removed: false,
            downloads: groups.get(bookmark.id),
            sortAt: bookmark.savedAt,
          }));
    return source
      .filter(({ bookmark }) => {
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
        sort === 'newest' ? b.sortAt.localeCompare(a.sortAt) : a.sortAt.localeCompare(b.sortAt),
      );
  }, [library, downloaded, groups, query, view, author, sort, collectionById]);
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
        setUndoDownloads([]);
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
      if (undo.length) await request({ type: 'restore', bookmarks: undo });
      if (undoDownloads.length) await request({ type: 'restoreDownloads', records: undoDownloads });
      const restored = undo.length ? 'Bookmarks restored.' : 'Download history restored.';
      setUndo([]);
      setUndoDownloads([]);
      await Promise.all([refresh(), refreshDownloads()]);
      showNotice(restored);
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not restore.');
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
    setUndoDownloads([]);
    setUndo(result.deleted);
    if (!result.deleted.length) showNotice('There were no bookmarks to delete.');
    await refresh();
  };
  const clearDownloads = async () => {
    const result = await request<ClearDownloadsResult>({ type: 'clearDownloads' });
    setClearDownloadsOpen(false);
    setNotice('');
    setUndo([]);
    setUndoDownloads(result.deleted);
    if (view.kind === 'downloaded') setView({ kind: 'all' });
    await refreshDownloads();
  };
  /** One item starts immediately; several open the chooser. */
  const startDownload = async (bookmark: Bookmark) => {
    const rows = downloadRows(bookmark);
    if (rows.length !== 1 || rows[0]!.quoted) {
      setDownloading(bookmark);
      return;
    }
    const row = rows[0]!;
    try {
      const result = await request<StartResult>({ type: 'startDownload', targets: [row.target] });
      const outcome = result.outcomes[0];
      if (outcome?.status === 'failed') {
        showNotice(errorMessage(outcome.error, row.item.kind));
        // The dialog offers the next step (open the post, or retry).
        setDownloading(bookmark);
      } else showNotice(outcome?.status === 'pending' ? 'Already downloading.' : 'Downloading…');
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not start the download.');
    }
  };
  const saveFromHistory = async (bookmark: Bookmark) => {
    try {
      await request({ type: 'save', draft: bookmark });
      await refresh();
      showNotice('Saved to your bookmarks.');
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Could not save this post.');
    }
  };
  const selectedIds = filtered
    .filter((entry) => !entry.removed && selected.has(entry.bookmark.id))
    .map((entry) => entry.bookmark.id);
  const selectable = filtered.filter((entry) => !entry.removed);
  const toggleSelected = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exportJson = async () => {
    const history = await request<DownloadRecord[]>({ type: 'downloads' }).catch(() => []);
    const data = createBackup(library, history);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `better-x-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 50_000_000) throw new Error('Import file is too large.');
      const data = validateExport(JSON.parse(await file.text()) as unknown);
      const result = await request<{ imported: number; downloads: number }>({
        type: 'import',
        data,
      });
      await Promise.all([refresh(), refreshDownloads()]);
      showNotice(
        `Imported ${plural(result.imported, 'bookmark')}` +
          (result.downloads ? ` and ${plural(result.downloads, 'download record')}.` : '.'),
      );
      setSettingsOpen(false);
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : 'Import failed.');
    }
    if (importRef.current) importRef.current.value = '';
  };
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    settingsButtonRef.current?.focus();
  }, []);
  const downloadsOn = settings.downloadsEnabled;
  const activeDownloads = records.filter((record) =>
    ['resolving', 'starting', 'inProgress'].includes(record.status),
  ).length;
  const title =
    view.kind === 'all'
      ? 'All Bookmarks'
      : view.kind === 'downloaded'
        ? 'Downloaded'
        : view.kind === 'tag'
          ? `#${view.name}`
          : collectionById.get(view.id)?.name || 'Collection';
  const countLabel =
    view.kind === 'downloaded'
      ? plural(filtered.length, 'post')
      : `${filtered.length} ${filtered.length === 1 ? 'bookmark' : 'bookmarks'}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <BookmarkIcon className="brand-glyph" size={22} strokeWidth={1.8} />
          </span>
          <div>
            <strong>Better</strong>
            <span>X</span>
          </div>
        </div>
        <button
          ref={settingsButtonRef}
          className="icon-button settings-button"
          aria-label="Settings and data"
          title="Settings and data"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={18} />
        </button>
      </header>
      <SectionTabs section={section} onChange={setSection} />
      <Customize
        settings={settings}
        onChange={(patch) => void updateSettings(patch)}
        hidden={section !== 'customize'}
      />
      <div
        className="library-view"
        id="library-panel"
        role="tabpanel"
        aria-labelledby="library-tab"
        hidden={section !== 'library'}
      >
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void importJson(event.target.files?.[0])}
        />
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
            aria-current={view.kind === 'all' ? 'page' : undefined}
            onClick={() => setView({ kind: 'all' })}
          >
            <BookmarkIcon size={16} />
            <span>All Bookmarks</span>
            <small>{library.bookmarks.length}</small>
          </button>
          {/* Built in: membership comes from completed downloads, never from collectionId. */}
          <button
            className={`nav-all nav-downloaded ${view.kind === 'downloaded' ? 'selected' : ''}`}
            aria-current={view.kind === 'downloaded' ? 'page' : undefined}
            onClick={() => setView({ kind: 'downloaded' })}
          >
            <Download size={16} />
            <span>Downloaded</span>
            <small>{downloaded.length}</small>
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
              <span>{countLabel}</span>
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
          {view.kind === 'downloaded' ? (
            <div className="view-note">
              <span>
                Posts with media downloaded from this extension. Files stay where you saved them.
              </span>
              <button
                className="text-button"
                disabled={!records.length}
                onClick={() => setClearDownloadsOpen(true)}
              >
                Clear history…
              </button>
            </div>
          ) : selecting ? (
            <SelectionBar
              count={selectedIds.length}
              total={selectable.length}
              collections={library.collections}
              tags={tags}
              busy={bulkBusy}
              onToggleAll={() =>
                setSelected(
                  selectedIds.length === selectable.length
                    ? new Set()
                    : new Set(selectable.map((entry) => entry.bookmark.id)),
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
                disabled={!selectable.length}
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
                {query ? (
                  <Search size={23} />
                ) : view.kind === 'downloaded' ? (
                  <Download size={23} />
                ) : (
                  <BookmarkIcon size={23} />
                )}
              </span>
              <strong>
                {query
                  ? `No results for “${query}”`
                  : view.kind === 'downloaded'
                    ? 'No downloads yet'
                    : library.bookmarks.length
                      ? 'Nothing here yet'
                      : 'No bookmarks yet'}
              </strong>
              <p>
                {query
                  ? 'Try another search term or filter.'
                  : view.kind === 'downloaded'
                    ? 'Download media from a saved post and it appears here once the download completes.'
                    : library.bookmarks.length
                      ? 'Save a bookmark to this collection or tag.'
                      : 'Save a post on X and it will appear here.'}
              </p>
            </div>
          ) : (
            <div className="bookmark-list">
              {filtered.map(({ bookmark, removed, downloads }) => {
                const own = bookmark.media;
                const quoted = bookmark.quote?.tweetId ? (bookmark.quote.media ?? []) : [];
                const canDownload = downloadsOn && (own.length > 0 || quoted.length > 0);
                return (
                  <BookmarkItem
                    key={bookmark.id}
                    bookmark={bookmark}
                    removed={removed}
                    selecting={selecting && view.kind !== 'downloaded' && !removed}
                    selected={selected.has(bookmark.id)}
                    busy={bulkBusy}
                    onToggle={() => toggleSelected(bookmark.id)}
                    collection={collectionById.get(bookmark.collectionId || '')}
                    badge={badgeFor(bookmark, downloads)}
                    downloadLabel={
                      canDownload
                        ? downloadLabel(own.length ? own : quoted, !own.length)
                        : undefined
                    }
                    onDownload={() => void startDownload(bookmark)}
                    onEdit={() => setEditing(bookmark)}
                    onDelete={() => void removeBookmark(bookmark)}
                    onSave={() => void saveFromHistory(bookmark)}
                  />
                );
              })}
            </div>
          )}
        </main>
        {(undo.length > 0 || undoDownloads.length > 0) && !notice && (
          <div className="toast undo-toast" role="status">
            <span>
              {undo.length
                ? `${undo.length} ${undo.length === 1 ? 'bookmark' : 'bookmarks'} deleted`
                : 'Download history cleared'}
            </span>
            <button disabled={bulkBusy} onClick={() => void undoDelete()}>
              Undo
            </button>
            <button
              aria-label="Dismiss undo"
              onClick={() => {
                setUndo([]);
                setUndoDownloads([]);
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onChange={(patch) => void updateSettings(patch)}
          onReset={() =>
            void resetSettings().then(() =>
              showNotice('Customization reset. Your data was not changed.'),
            )
          }
          onClose={closeSettings}
          onExport={() => void exportJson()}
          onImport={() => importRef.current?.click()}
          onClearBookmarks={() => {
            setSettingsOpen(false);
            setClearOpen(true);
          }}
          onClearDownloads={() => {
            setSettingsOpen(false);
            setClearDownloadsOpen(true);
          }}
          bookmarkCount={library.bookmarks.length}
          downloadCount={records.length - activeDownloads}
        />
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
      {clearDownloadsOpen && (
        <ClearDownloadsDialog
          postCount={downloaded.length}
          activeCount={activeDownloads}
          onCancel={() => setClearDownloadsOpen(false)}
          onConfirm={clearDownloads}
        />
      )}
      {downloading && (
        <DownloadDialog
          post={downloading}
          records={groups.get(downloading.tweetId)?.records ?? []}
          onClose={() => setDownloading(null)}
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
