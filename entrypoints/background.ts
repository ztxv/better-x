import { BookmarkRepository } from '../src/storage/repository';
import type { Request, Response } from '../src/types/model';

export default defineBackground(() => {
  const repository = new BookmarkRepository();
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onMessage.addListener(
    (message: Request, _sender, sendResponse: (response: Response) => void) => {
      const run = async (): Promise<unknown> => {
        switch (message.type) {
          case 'openPanel': {
            const windowId = _sender.tab?.windowId;
            if (windowId === undefined) throw new Error('Could not find this window.');
            return chrome.sidePanel.open({ windowId });
          }
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
