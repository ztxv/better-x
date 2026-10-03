import { DownloadRepository } from '../src/downloads/repository';
import { DownloadService, type Downloader } from '../src/downloads/service';
import { loadSettings } from '../src/lib/settings';
import { BookmarkRepository } from '../src/storage/repository';
import type { DownloadRecord, Request, Response } from '../src/types/model';

/** Requests the X content script may send; everything else is for extension pages only. */
const CONTENT_REQUESTS = new Set<Request['type']>([
  'savedIds',
  'save',
  'delete',
  'openPanel',
  'startDownload',
  'downloadsFor',
  'cancelDownload',
]);

/** The side panel, or the same page opened in a tab. Content scripts report the page's URL. */
function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return !!sender.url?.startsWith(chrome.runtime.getURL(''));
}

function isXPage(sender: chrome.runtime.MessageSender): boolean {
  try {
    const host = new URL(sender.tab?.url ?? sender.url ?? '').hostname;
    return /(^|\.)(x|twitter)\.com$/.test(host);
  } catch {
    return false;
  }
}

/** `chrome.downloads`, or null when the permission is unavailable. */
function downloader(): Downloader | null {
  if (!chrome.downloads?.download) return null;
  return {
    download: (options) => chrome.downloads.download(options),
    search: (query) => chrome.downloads.search(query),
    cancel: (id) => chrome.downloads.cancel(id),
  };
}

const RECORD_ID = /^[A-Za-z0-9-]{1,100}$/;
const POST_ID = /^\d{1,25}$/;

export default defineBackground(() => {
  const repository = new BookmarkRepository();
  const downloads = new DownloadRepository();
  const service = new DownloadService({
    downloads,
    bookmark: (id) => repository.get(id),
    downloader,
    settings: loadSettings,
  });

  // Registered synchronously so events that wake the worker are never missed.
  chrome.downloads?.onChanged.addListener((delta) => void service.onChanged(delta));
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Pick up downloads that changed while the worker was stopped.
  void service.reconcile();

  chrome.runtime.onMessage.addListener(
    (message: Request, sender, sendResponse: (response: Response) => void) => {
      const run = async (): Promise<unknown> => {
        if (
          sender.id !== chrome.runtime.id ||
          typeof message?.type !== 'string' ||
          !(isExtensionPage(sender) || (isXPage(sender) && CONTENT_REQUESTS.has(message.type)))
        )
          throw new Error('Request not allowed.');
        switch (message.type) {
          case 'openPanel': {
            const windowId = sender.tab?.windowId;
            if (windowId === undefined) throw new Error('Could not find this window.');
            return chrome.sidePanel.open({ windowId });
          }
          case 'savedIds':
            return repository.savedIds();
          case 'downloads':
            return downloads.list();
          case 'downloadsFor':
            if (!POST_ID.test(String(message.tweetId))) throw new Error('Invalid post.');
            return downloads.forPost(message.tweetId);
          case 'startDownload':
            return service.start(message.targets);
          case 'cancelDownload':
            if (!RECORD_ID.test(String(message.recordId))) throw new Error('Invalid download.');
            return service.cancel(message.recordId);
          case 'reconcileDownloads':
            return service.reconcile();
          case 'clearDownloads':
            return { deleted: await downloads.clear() };
          case 'restoreDownloads':
            return downloads.restore(
              (Array.isArray(message.records) ? message.records : []).filter(
                (record: DownloadRecord) =>
                  RECORD_ID.test(String(record?.id)) && POST_ID.test(String(record?.tweetId)),
              ),
            );
          case 'bulk':
            return repository.bulk(message.ids, message.action);
          case 'restore':
            return repository.restore(message.bookmarks);
          case 'clearBookmarks':
            return repository.clearBookmarks();
          case 'list':
            return repository.list();
          case 'get':
            return repository.get(message.id);
          case 'save':
            return repository.save(message.draft);
          case 'update':
            return repository.update(message.id, message.patch);
          case 'delete':
            return repository.delete(message.id);
          case 'createCollection':
            return repository.createCollection(message.name);
          case 'renameCollection':
            return repository.renameCollection(message.id, message.name);
          case 'deleteCollection':
            return repository.deleteCollection(message.id);
          case 'import':
            return repository.import(message.data);
          default:
            throw new Error('Unknown request.');
        }
      };
      void run()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error.',
          });
        });
      return true;
    },
  );
});
