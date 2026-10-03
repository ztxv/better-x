import type {
  BookmarkDraft,
  LinkCard,
  MediaKind,
  PostMedia,
  QuotedPost,
  ReplyContext,
} from '../types/model';
import { parsePostUrl, postDateFromId, type PostIdentity } from './url';

/**
 * X ships two post layouts: the long-standing one with `data-testid` hooks, and a newer
 * one (already served to signed-out visitors) with no test IDs, nested `article` quotes,
 * and no `<time>` element. Every lookup prefers the test-ID hook and falls back to
 * structure that both layouts share.
 */
export const X_SELECTORS = {
  post: 'article',
  postLink: 'a[href*="/status/"]',
  time: 'time',
  text: '[data-testid="tweetText"]',
  author: '[data-testid="User-Name"]',
  avatar: '[data-testid="Tweet-User-Avatar"] img, [data-testid^="UserAvatar-Container-"] img',
  actionRow: '[role="group"]',
  reply: '[data-testid="reply"]',
  card: '[data-testid="card.wrapper"]',
  profileImage: 'img[src*="/profile_images/"]',
} as const;

const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/;
const VIDEO_THUMB = /\/(amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//;

/** A quoted post is a `role="link"` block holding another author, or a nested article. */
function isQuoteBlock(element: Element): boolean {
  return (
    element.matches('[role="link"]') &&
    !(element.matches('a[href]') && profileHandle(element as HTMLAnchorElement)) &&
    (!!element.querySelector(`article, ${X_SELECTORS.author}`) ||
      (!!element.querySelector(X_SELECTORS.profileImage) &&
        !!element.querySelector(X_SELECTORS.postLink)))
  );
}

/** The post (or quoted post) that directly owns `element`, searching up to `root`. */
function owner(element: Element, root: Element): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node === root) return root;
    if (node.matches(X_SELECTORS.post) || isQuoteBlock(node)) return node;
  }
  return null;
}

/** Elements under `root` that belong to it rather than to a quoted post inside it. */
function own<T extends Element = HTMLElement>(root: Element, selector: string): T[] {
  return [...root.querySelectorAll<T>(selector)].filter((element) => owner(element, root) === root);
}

/** Visible text, keeping emoji (rendered as `<img alt>`) and line breaks. */
function readText(node: Node | null | undefined): string {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element)) return '';
  const tag = node.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'svg') return '';
  if (tag === 'IMG') return node.getAttribute('alt') ?? '';
  if (tag === 'BR') return '\n';
  let text = '';
  node.childNodes.forEach((child) => (text += readText(child)));
  return text;
}
const clean = (value: string | null | undefined, max = 20000) =>
  value?.replace(/ /g, ' ').trim().slice(0, max) || null;

function safeTwimg(value: string | null | undefined): string | null {
  return value && /^https:\/\/([a-z0-9-]+\.)*twimg\.com\//i.test(value) ? value : null;
}

/** Requests a panel-sized rendition of an X photo instead of the full-size original. */
function thumbnail(value: string | null | undefined): string | null {
  const safe = safeTwimg(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/card_img/'))
      url.searchParams.set('name', 'small');
    return url.href;
  } catch {
    return null;
  }
}

function attempt<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ identity and author */

function identityIn(root: Element): PostIdentity | null {
  const time = own<HTMLTimeElement>(root, X_SELECTORS.time)[0];
  const timeLink = time?.closest<HTMLAnchorElement>(X_SELECTORS.postLink);
  const links =
    timeLink && root.contains(timeLink)
      ? [timeLink]
      : own<HTMLAnchorElement>(root, X_SELECTORS.postLink);
  for (const link of links) {
    const identity = parsePostUrl(link.href);
    if (identity) return identity;
  }
  return null;
}

export function postIdentity(article: HTMLElement): PostIdentity | null {
  return identityIn(article);
}

function profileHandle(link: HTMLAnchorElement): string | null {
  try {
    const url = new URL(link.href);
    if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return null;
    return url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

interface Author {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

function authorIn(root: Element, knownHandle: string | null): Author {
  let handle = knownHandle;
  let displayName: string | null = null;
  const block = own(root, X_SELECTORS.author)[0];
  if (block) {
    const nameLink = block.querySelector('a[href]');
    displayName = clean(readText(nameLink), 160);
    const lines = (block.innerText || readText(block)).split('\n').map((line) => line.trim());
    if (!displayName) displayName = lines.find((line) => line && !/^[@·]/.test(line)) ?? null;
    handle ??=
      lines.map((line) => line.match(/^@([A-Za-z0-9_]{1,15})$/)?.[1]).find(Boolean) ?? null;
  } else {
    for (const link of own<HTMLAnchorElement>(root, 'a[href]')) {
      const linkHandle = profileHandle(link);
      if (!linkHandle || (handle && linkHandle.toLowerCase() !== handle.toLowerCase())) continue;
      const text = clean(readText(link), 160);
      if (!text) continue;
      if (text.startsWith('@')) handle ??= linkHandle;
      else {
        handle ??= linkHandle;
        displayName ??= text;
      }
      if (displayName) break;
    }
    // Compact quotes render the author as plain text rather than links.
    if (!handle || !displayName)
      for (const element of own(root, 'span, div')) {
        if (element.childElementCount > 1) continue;
        const text = clean(readText(element), 160);
        const match = text?.match(HANDLE);
        if (!handle && text?.startsWith('@') && match?.[1]) handle = match[1];
        else if (!displayName && text && element.matches('.font-bold, [class*="font-bold"]'))
          displayName = text;
        if (handle && displayName) break;
      }
  }
  const avatar =
    own<HTMLImageElement>(root, X_SELECTORS.avatar)[0] ??
    own<HTMLImageElement>(root, X_SELECTORS.profileImage)[0];
  return {
    handle,
    displayName,
    avatarUrl: safeTwimg(avatar?.currentSrc || avatar?.src),
  };
}

function textIn(root: Element): string | null {
  const legacy = own(root, X_SELECTORS.text)[0];
  if (legacy) return clean(readText(legacy));
  if (root.querySelector(X_SELECTORS.author)) return null; // Test-ID layout without text.
  const block = own(root, 'div[dir="auto"]').find((element) => !element.closest('a'));
  return clean(readText(block));
}

function createdAtIn(root: Element, identity: PostIdentity | null): string | null {
  const time = own<HTMLTimeElement>(root, X_SELECTORS.time)[0]?.dateTime;
  if (time && !Number.isNaN(Date.parse(time))) return time;
  return identity ? postDateFromId(identity.tweetId) : null;
}

/* ---------------------------------------------------------------------------- media */

function mediaIn(root: Element, exclude: Element | null): PostMedia[] {
  const found: Array<{ node: Element; item: PostMedia }> = [];
  const used = new Set<Element>();
  const skip = (node: Element) => used.has(node) || (exclude?.contains(node) ?? false);
  const genericAlt = (alt: string | null) =>
    alt && !/^(image|video|gif|embedded video)$/i.test(alt.trim()) ? clean(alt, 1000) : null;

  for (const video of own<HTMLVideoElement>(root, 'video')) {
    if (skip(video)) continue;
    const frame = video.parentElement?.parentElement ?? video;
    const poster = frame.querySelector<HTMLImageElement>('img[src*="twimg.com"]');
    if (poster) used.add(poster);
    const source = video.currentSrc || video.src || video.querySelector('source')?.src || '';
    const thumb = video.poster || poster?.src || null;
    const kind: MediaKind = /\/tweet_video(_thumb)?\//.test(`${thumb} ${source}`) ? 'gif' : 'video';
    found.push({
      node: video,
      item: { kind, thumbnailUrl: thumbnail(thumb), alt: null },
    });
    used.add(video);
  }
  for (const image of own<HTMLImageElement>(root, 'img[src*="twimg.com"]')) {
    if (skip(image)) continue;
    const src = image.currentSrc || image.src;
    const isVideo = VIDEO_THUMB.test(src);
    if (!isVideo && !src.includes('/media/')) continue;
    const kind: MediaKind = !isVideo
      ? 'image'
      : src.includes('tweet_video_thumb')
        ? 'gif'
        : 'video';
    found.push({
      node: image,
      item: { kind, thumbnailUrl: thumbnail(src), alt: genericAlt(image.alt) },
    });
    used.add(image);
  }
  // Media X has not loaded (or hides as sensitive) still links to /photo/N or /video/N.
  const seen = new Set<string>();
  for (const link of own<HTMLAnchorElement>(root, 'a[href*="/photo/"], a[href*="/video/"]')) {
    if (skip(link) || seen.has(link.href)) continue;
    seen.add(link.href);
    if ([...used].some((node) => link.contains(node) || node.contains(link))) continue;
    const kind: MediaKind = link.href.includes('/video/') ? 'video' : 'image';
    found.push({ node: link, item: { kind, thumbnailUrl: null, alt: null } });
  }
  return found
    .sort((a, b) =>
      a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map(({ item }) => item)
    .filter(
      (item, index, all) =>
        !item.thumbnailUrl ||
        all.findIndex((other) => other.thumbnailUrl === item.thumbnailUrl) === index,
    )
    .slice(0, 4);
}

/* ---------------------------------------------------------------------- link cards */

const isXUrl = (url: URL) => /(^|\.)(x|twitter)\.com$/i.test(url.hostname);
const DOMAIN = /^(?:From\s+)?((?:[a-z0-9-]+\.)+[a-z]{2,})$/i;

/** Text grouped by its nearest block-level box, since card parts are often sibling inline links. */
function textLines(root: Element): string[] {
  const lines: string[] = [];
  let lastBlock: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim();
    if (!text || node.parentElement?.closest('script, style')) continue;
    let block = node.parentElement;
    while (block && block !== root && /^(inline|contents)$/.test(getComputedStyle(block).display))
      block = block.parentElement;
    if (block === lastBlock && lines.length) lines[lines.length - 1] += ` ${text}`;
    else lines.push(text);
    lastBlock = block;
  }
  return lines;
}

function cardContainer(root: Element): Element | null {
  const wrapper = own(root, X_SELECTORS.card)[0];
  if (wrapper) return wrapper;
  const image = own(root, 'a[href] img[src*="/card_img/"]')[0];
  return image?.closest('a')?.parentElement ?? null;
}

function cardIn(root: Element, container: Element | null): LinkCard | null {
  if (container) {
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')];
    const link = links.find((anchor) => /^https?:/.test(anchor.href));
    const lines = textLines(container);
    const domainLine = lines.find((line) => DOMAIN.test(line));
    let domain = domainLine?.match(DOMAIN)?.[1] ?? null;
    const rest = lines.filter((line) => line !== domainLine && !/^\d+:\d+$/.test(line));
    if (link) {
      const url = new URL(link.href);
      // Large cards can show "From domain" as a separate link after the card itself.
      domain ??=
        own<HTMLAnchorElement>(root, 'a[href]')
          .filter((anchor) => anchor.href === link.href && !container.contains(anchor))
          .map((anchor) => clean(readText(anchor))?.match(DOMAIN)?.[1])
          .find(Boolean) ?? null;
      if (!domain && url.hostname !== 't.co') domain = url.hostname.replace(/^www\./, '');
      const image = container.querySelector<HTMLImageElement>('img[src*="twimg.com"]');
      return {
        kind: 'link',
        url: url.href,
        domain,
        title: clean(rest[0], 300),
        description: clean(rest[1], 500),
        imageUrl: thumbnail(image?.src),
      };
    }
  }
  // X Articles (long-form posts) preview as a link to /i/article/ or /article/.
  const article = own<HTMLAnchorElement>(root, 'a[href*="/article/"]').find((anchor) =>
    /\/(i\/)?article\/\d+/.test(anchor.href),
  );
  if (article) {
    const lines = textLines(article).filter((line) => !/^article$/i.test(line));
    return {
      kind: 'article',
      url: article.href,
      domain: 'x.com',
      title: clean(lines[0], 300),
      description: clean(lines[1], 500),
      imageUrl: thumbnail(article.querySelector('img')?.src),
    };
  }
  // A bare link in the post text still deserves a tidy domain row.
  const text = own(root, X_SELECTORS.text)[0] ?? root;
  for (const anchor of own<HTMLAnchorElement>(text, 'a[href^="http"]')) {
    if (owner(anchor, root) !== root) continue;
    const url = new URL(anchor.href);
    if (isXUrl(url)) continue;
    const shown = readText(anchor)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/…$/, '');
    const domain =
      url.hostname === 't.co' ? (shown.split('/')[0] ?? null) : url.hostname.replace(/^www\./, '');
    return {
      kind: 'link',
      url: url.href,
      domain: domain && DOMAIN.test(domain) ? domain : null,
      title: null,
      description: null,
      imageUrl: null,
    };
  }
  return null;
}

/* ---------------------------------------------------------------------- quotes */

function quoteIn(article: Element): QuotedPost | null {
  const block =
    own(article, '[role="link"]').find(isQuoteBlock) ?? own(article, X_SELECTORS.post)[0];
  if (!block) return null;
  const scope = block.matches(X_SELECTORS.post)
    ? block
    : (own(block, X_SELECTORS.post)[0] ?? block);
  const identity = identityIn(scope);
  const author = authorIn(scope, identity?.handle ?? null);
  return {
    tweetId: identity?.tweetId ?? null,
    url: identity?.url ?? null,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    text: textIn(scope),
    createdAt: createdAtIn(scope, identity),
    media: mediaIn(scope, cardContainer(scope)),
  };
}

/* ---------------------------------------------------------------------- replies */

const isVisible = (rect: DOMRect) => rect.width > 0 && rect.height > 0;

/** A thin vertical line in the avatar column: X's thread connector between posts. */
function connector(article: Element, edge: 'top' | 'bottom'): boolean {
  const box = article.getBoundingClientRect();
  for (const element of own(article, 'div, span')) {
    if (element.childElementCount) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.width > 4 || rect.height < 6 || rect.left > box.left + 100) continue;
    const touches =
      edge === 'bottom'
        ? rect.bottom >= box.bottom - 16 && rect.top > box.top + 16
        : rect.top <= box.top + 16;
    if (!touches) continue;
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)) return true;
  }
  return false;
}

function replyIn(article: HTMLElement): ReplyContext | null {
  // Timelines label replies whose parent is not shown ("Replying to @handle").
  for (const element of own(article, 'div, span')) {
    const first = element.firstChild;
    if (first?.nodeType !== Node.TEXT_NODE || !/^\s*Replying to\b/i.test(first.textContent ?? ''))
      continue;
    const handle = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .map(profileHandle)
      .find(Boolean);
    const typed = readText(element).match(/@([A-Za-z0-9_]{1,15})/)?.[1];
    if (handle || typed)
      return {
        tweetId: null,
        url: null,
        authorHandle: handle ?? typed ?? null,
        authorDisplayName: null,
        text: null,
      };
  }
  // Conversations show the parent directly above, joined by a connector line.
  const box = article.getBoundingClientRect();
  if (!isVisible(box)) return null;
  let parent: HTMLElement | null = null;
  let parentBottom = -Infinity;
  for (const candidate of document.querySelectorAll<HTMLElement>(X_SELECTORS.post)) {
    if (candidate === article || candidate.parentElement?.closest(X_SELECTORS.post)) continue;
    const rect = candidate.getBoundingClientRect();
    if (!isVisible(rect) || rect.bottom > box.top + 4 || rect.bottom <= parentBottom) continue;
    if (rect.right < box.left || rect.left > box.right) continue;
    parent = candidate;
    parentBottom = rect.bottom;
  }
  if (!parent || box.top - parentBottom > 40) return null;
  if (!connector(parent, 'bottom') && !connector(article, 'top')) return null;
  const identity = identityIn(parent);
  const author = authorIn(parent, identity?.handle ?? null);
  return {
    tweetId: identity?.tweetId ?? null,
    url: identity?.url ?? null,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    text: clean(textIn(parent), 280),
  };
}

/* ---------------------------------------------------------------------- public API */

export function extractPost(article: HTMLElement): BookmarkDraft | null {
  const identity = identityIn(article);
  if (!identity) return null;
  const author = authorIn(article, identity.handle);
  const container = attempt(() => cardContainer(article), null);
  return {
    tweetId: identity.tweetId,
    url: identity.url,
    authorHandle: identity.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    text: textIn(article),
    createdAt: createdAtIn(article, identity),
    media: attempt(() => mediaIn(article, container), []),
    quote: attempt(() => quoteIn(article), null),
    replyTo: attempt(() => replyIn(article), null),
    card: attempt(() => cardIn(article, container), null),
  };
}

/** True when each of a row's children holds an icon control (reply, repost, like, …). */
function isControlRow(row: Element): boolean {
  const items = [...row.children].filter((child) => !child.classList.contains('sfx-control'));
  return (
    items.length >= 4 &&
    items.every((item) => item.querySelector('button svg, a[href] svg')) &&
    row.querySelectorAll('button').length >= 3 &&
    !row.querySelector('img')
  );
}

export function actionRow(article: HTMLElement): HTMLElement | null {
  const groups = own<HTMLElement>(article, X_SELECTORS.actionRow);
  const legacy =
    groups.find((group) => group.querySelector(X_SELECTORS.reply)) ??
    groups.find((group) => group.querySelector('button'));
  return legacy ?? own<HTMLElement>(article, 'div').filter(isControlRow).at(-1) ?? null;
}
