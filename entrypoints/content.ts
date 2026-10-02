import { request } from '../src/lib/api';
import type { Bookmark, Library } from '../src/types/model';
import { actionRow, extractPost, postIdentity, X_SELECTORS } from '../src/x/selectors';
import '../src/content/styles.css';

const icon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main() {
    const saved = new Set<string>();
    const buttons = new Map<HTMLButtonElement, string>();
    let menu: HTMLElement | null = null;
    let scheduled = false;

    function renderState(button: HTMLButtonElement, id: string) {
      const isSaved = saved.has(id);
      button.dataset.saved = String(isSaved);
      button.setAttribute(
        'aria-label',
        isSaved ? 'Saved. Manage bookmark' : 'Save post to Saved for X',
      );
      button.title = isSaved ? 'Saved for X' : 'Save to Saved for X';
    }

    async function refreshSaved() {
      try {
        const library = await request<Library>({ type: 'list' });
        saved.clear();
        library.bookmarks.forEach((bookmark) => saved.add(bookmark.id));
        buttons.forEach((id, button) => renderState(button, id));
      } catch {
        /* The toolbar remains usable and retries on the next library change. */
      }
    }

    function closeMenu() {
      menu?.remove();
      menu = null;
    }

    function showMenu(button: HTMLButtonElement, id: string) {
      closeMenu();
      const rect = button.getBoundingClientRect();
      const node = document.createElement('div');
      node.className = 'sfx-menu';
      node.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 200))}px`;
      node.style.top = `${Math.min(rect.bottom + 4, innerHeight - 100)}px`;
      const manage = document.createElement('button');
      manage.type = 'button';
      manage.textContent = 'Open bookmark library';
      manage.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMenu();
        void request({ type: 'openPanel' });
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove bookmark';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMenu();
        void request<void>({ type: 'delete', id }).then(() => {
          saved.delete(id);
          buttons.forEach((buttonId, item) => {
            if (buttonId === id) renderState(item, id);
          });
        });
      });
      node.append(manage, remove);
      node.addEventListener('click', (event) => event.stopPropagation());
      document.body.append(node);
      menu = node;
      setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
    }

    function enhance(article: HTMLElement) {
      const identity = postIdentity(article);
      const row = actionRow(article);
      if (!identity || !row) return;
      const existing = row.querySelector<HTMLButtonElement>('.sfx-control');
      if (existing) {
        if (buttons.get(existing) !== identity.tweetId) {
          buttons.set(existing, identity.tweetId);
          renderState(existing, identity.tweetId);
        }
        return;
      }
      const button = document.createElement('button');
      button.className = 'sfx-control';
      button.type = 'button';
      button.innerHTML = icon;
      buttons.set(button, identity.tweetId);
      renderState(button, identity.tweetId);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const draft = extractPost(article);
        if (!draft) return;
        if (saved.has(draft.tweetId)) {
          showMenu(button, draft.tweetId);
          return;
        }
        saved.add(draft.tweetId);
        renderState(button, draft.tweetId);
        void request<Bookmark>({ type: 'save', draft }).catch(() => {
          saved.delete(draft.tweetId);
          renderState(button, draft.tweetId);
          button.title = 'Could not save. Click to retry.';
        });
      });
      row.append(button);
    }

    function scan(root: ParentNode) {
      if (root instanceof HTMLElement && root.matches(X_SELECTORS.post)) enhance(root);
      root.querySelectorAll<HTMLElement>(X_SELECTORS.post).forEach(enhance);
      for (const [button] of buttons) if (!button.isConnected) buttons.delete(button);
    }

    const pending = new Set<HTMLElement>();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target =
          mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const parent = target?.closest<HTMLElement>(X_SELECTORS.post) ?? null;
        if (parent) pending.add(parent);
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(X_SELECTORS.post)) pending.add(node);
          node
            .querySelectorAll<HTMLElement>(X_SELECTORS.post)
            .forEach((article) => pending.add(article));
        }
      }
      if (!pending.size || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const article of pending) if (article.isConnected) enhance(article);
        pending.clear();
        for (const [button] of buttons) if (!button.isConnected) buttons.delete(button);
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    scan(document);
    void refreshSaved();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.libraryRevision) void refreshSaved();
    });
  },
});
