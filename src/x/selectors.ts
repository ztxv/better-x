import type { BookmarkDraft } from '../types/model';
import { parsePostUrl, type PostIdentity } from './url';

export const X_SELECTORS = {
  post: 'article',
  postLink: 'a[href*="/status/"]',
  timestamp: 'a[href*="/status/"] time',
  text: '[data-testid="tweetText"]',
  author: '[data-testid="User-Name"]',
  actionRow: '[role="group"]',
  avatar: '[data-testid="Tweet-User-Avatar"] img',
} as const;

export function postIdentity(article: HTMLElement): PostIdentity | null {
  const timestamp = article.querySelector<HTMLTimeElement>(X_SELECTORS.timestamp);
  const timestampLink = timestamp?.closest<HTMLAnchorElement>('a[href*="/status/"]');
  const links = timestampLink
    ? [timestampLink]
    : [...article.querySelectorAll<HTMLAnchorElement>(X_SELECTORS.postLink)];
  for (const link of links) {
    const identity = parsePostUrl(link.href);
    if (identity) return identity;
  }
  return null;
}

export function extractPost(article: HTMLElement): BookmarkDraft | null {
  const identity = postIdentity(article);
  if (!identity) return null;
  const authorNode = article.querySelector<HTMLElement>(X_SELECTORS.author);
  const authorText = authorNode?.innerText?.trim() ?? '';
  const displayName =
    authorText
      .split('\n')
      .find((part) => part && !part.startsWith('@'))
      ?.trim() || null;
  const text = article.querySelector<HTMLElement>(X_SELECTORS.text)?.innerText?.trim() || null;
  const avatar = article.querySelector<HTMLImageElement>(X_SELECTORS.avatar)?.src ?? null;
  const safeAvatar =
    avatar && /^https:\/\/([a-z0-9.-]+\.)?twimg\.com\//i.test(avatar) ? avatar : null;
  const timestamp = article.querySelector<HTMLTimeElement>(X_SELECTORS.timestamp)?.dateTime ?? null;
  return {
    tweetId: identity.tweetId,
    url: identity.url,
    authorHandle: identity.handle,
    authorDisplayName: displayName,
    authorAvatarUrl: safeAvatar,
    text,
    createdAt: timestamp,
  };
}

export function actionRow(article: HTMLElement): HTMLElement | null {
  const groups = [...article.querySelectorAll<HTMLElement>(X_SELECTORS.actionRow)];
  return (
    groups.find((group) => group.querySelector('[data-testid="reply"]')) ??
    groups.find((group) => group.querySelector('button')) ??
    null
  );
}
