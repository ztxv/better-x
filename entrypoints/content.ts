import icon from '../src/brand/mark.svg?raw';
import { request } from '../src/lib/api';
import type { Bookmark, Library } from '../src/types/model';
import { actionRow, extractPost, postIdentity, X_SELECTORS } from '../src/x/selectors';
import '../src/content/styles.css';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main() {
    const saved = new Set<string>();
    const saving = new Set<string>();
    const buttons = new Map<HTMLButtonElement, string>();
    let menu: HTMLElement | null = null;
    let scheduled = false;

    function renderState(button: HTMLButtonElement, id: string) {
      const isSaved = saved.has(id) || saving.has(id);
      button.disabled = saving.has(id);
      button.setAttribute('aria-busy', String(saving.has(id)));
      button.setAttribute('aria-pressed', String(isSaved));
      button.dataset.saved = String(isSaved);
      button.setAttribute(
        'aria-label',
        isSaved ? 'Saved to Saved for X. Manage bookmark' : 'Save post to Saved for X',
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
      // Follow X's own theme (Default, Dim, Lights out), which is independent of the OS.
      const [r = 255, g = 255, b = 255, alpha = 1] =
        getComputedStyle(document.body)
          .backgroundColor.match(/[\d.]+/g)
          ?.map(Number) ?? [];
      node.dataset.theme = alpha > 0 && 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 'dark' : 'light';
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

    /**
     * Matches the control to X's own icons in the same row: icon size and button box come
     * from the last native control (Share), then any remaining vertical offset is measured
     * and corrected. This holds across timeline/detail layouts, X font sizes, and zoom.
     */
    function align(targets: Iterable<HTMLButtonElement>) {
      const jobs = [...targets].flatMap((button) => {
        const row = button.parentElement;
        const native = row
          ? [...row.querySelectorAll<HTMLElement>('button, a[href]')].filter(
              (control) => !control.closest('.sfx-control') && control.querySelector('svg'),
            )
          : [];
        // The last visible native icon; narrow layouts can hide part of the row.
        const reference = native
          .reverse()
          .find((control) => control.querySelector('svg')!.getBoundingClientRect().height > 0);
        const glyph = reference?.querySelector('svg')?.getBoundingClientRect();
        if (!reference || !glyph?.height || !button.isConnected) return [];
        const box = reference.getBoundingClientRect().height;
        return [{ button, glyph, box }];
      });
      for (const { button, glyph, box } of jobs) {
        const size = Math.min(Math.max(glyph.height, 14), 32);
        button.style.setProperty('--sfx-icon', `${size}px`);
        button.style.setProperty('--sfx-box', `${Math.min(Math.max(box, size), 48)}px`);
      }
      const offsets = jobs.map(({ button, glyph }) => {
        const own = button.querySelector('svg')?.getBoundingClientRect();
        const current = Number(button.dataset.offset) || 0;
        if (!own?.height) return current;
        const delta = glyph.top + glyph.height / 2 - (own.top + own.height / 2);
        return Math.max(-20, Math.min(20, Math.round((current + delta) * 2) / 2));
      });
      jobs.forEach(({ button }, index) => {
        const offset = offsets[index] ?? 0;
        button.dataset.offset = String(offset);
        button.style.setProperty('--sfx-dy', `${offset}px`);
      });
    }

    const unaligned = new Set<HTMLButtonElement>();
    let alignFrame = 0;
    function queueAlign(button?: HTMLButtonElement) {
      if (button) unaligned.add(button);
      else buttons.forEach((_, item) => unaligned.add(item));
      cancelAnimationFrame(alignFrame);
      alignFrame = requestAnimationFrame(() => {
        align(unaligned);
        unaligned.clear();
      });
    }

    function enhance(article: HTMLElement) {
      // Quoted posts are nested articles in X's newer layout; only the outer post gets a control.
      if (article.parentElement?.closest(X_SELECTORS.post)) return;
      const identity = postIdentity(article);
      if (!identity) return;
      const existing = article.querySelector<HTMLButtonElement>('.sfx-control');
      if (existing?.closest(X_SELECTORS.post) === article) {
        if (buttons.get(existing) !== identity.tweetId) {
          delete existing.dataset.feedback;
          buttons.set(existing, identity.tweetId);
          renderState(existing, identity.tweetId);
          queueAlign(existing);
        }
        return;
      }
      const row = actionRow(article);
      if (!row) return;
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
        saving.add(draft.tweetId);
        buttons.forEach((id, item) => renderState(item, id));
        void request<Bookmark>({ type: 'save', draft })
          .then(() => {
            saved.add(draft.tweetId);
            if (buttons.get(button) === draft.tweetId) {
              button.dataset.feedback = 'saved';
              button.title = 'Saved to your library';
            }
          })
          .catch(() => {
            saved.delete(draft.tweetId);
            if (buttons.get(button) === draft.tweetId) {
              button.dataset.feedback = 'error';
            }
          })
          .finally(() => {
            saving.delete(draft.tweetId);
            buttons.forEach((id, item) => renderState(item, id));
            if (button.dataset.feedback === 'error') {
              button.title = 'Could not save. Click to retry.';
              button.setAttribute('aria-label', 'Save failed. Click to retry');
            }
            setTimeout(() => delete button.dataset.feedback, 260);
          });
      });
      row.append(button);
      queueAlign(button);
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
    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => queueAlign(), 150);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.libraryRevision) void refreshSaved();
    });
  },
});
