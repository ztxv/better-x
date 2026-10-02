import { useState } from 'react';
import { CornerUpLeft, Film, Image as ImageIcon, Link2, Newspaper, Play } from 'lucide-react';
import type { Bookmark, LinkCard, PostMedia, QuotedPost, ReplyContext } from '../types/model';

/* Everything here renders inside the card's <button>, so it uses phrasing content only. */

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function mediaLabel(media: PostMedia[]): string {
  const photos = media.filter((item) => item.kind === 'image').length;
  const videos = media.filter((item) => item.kind === 'video').length;
  const gifs = media.filter((item) => item.kind === 'gif').length;
  return [
    photos && plural(photos, 'photo'),
    videos && plural(videos, 'video'),
    gifs && plural(gifs, 'GIF'),
  ]
    .filter(Boolean)
    .join(', ');
}

/** A short spoken summary of the context, for the card's accessible name. */
export function contextSummary(bookmark: Bookmark): string {
  return [
    bookmark.replyTo && `replying to @${bookmark.replyTo.authorHandle ?? 'a post'}`,
    bookmark.media.length > 0 && `with ${mediaLabel(bookmark.media)}`,
    bookmark.quote && `quoting @${bookmark.quote.authorHandle ?? 'a post'}`,
    bookmark.card &&
      (bookmark.card.kind === 'article'
        ? 'with an article'
        : `with a link to ${bookmark.card.domain ?? 'a website'}`),
  ]
    .filter(Boolean)
    .join(', ');
}

export function hasContext(bookmark: Bookmark): boolean {
  return !!(bookmark.media.length || bookmark.quote || bookmark.card);
}

function Thumb({ item, compact = false }: { item: PostMedia; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const Icon = item.kind === 'image' ? ImageIcon : Film;
  return (
    <span className={`media-tile is-${item.kind}`}>
      {item.thumbnailUrl && !failed ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="media-placeholder">
          <Icon size={compact ? 14 : 16} />
          {!compact && (
            <span>{item.kind === 'image' ? 'Photo' : item.kind === 'gif' ? 'GIF' : 'Video'}</span>
          )}
        </span>
      )}
      {item.kind === 'video' && item.thumbnailUrl && !failed && (
        <span className="media-badge" aria-hidden="true">
          <Play size={10} fill="currentColor" />
        </span>
      )}
      {item.kind === 'gif' && item.thumbnailUrl && !failed && (
        <span className="media-badge gif-badge" aria-hidden="true">
          GIF
        </span>
      )}
    </span>
  );
}

export function MediaStrip({ media }: { media: PostMedia[] }) {
  if (!media.length) return null;
  return (
    <span className="media-grid" data-count={media.length} title={mediaLabel(media)}>
      {media.map((item, index) => (
        <Thumb item={item} key={`${item.thumbnailUrl ?? item.kind}-${index}`} />
      ))}
    </span>
  );
}

export function ReplyLine({ reply }: { reply: ReplyContext }) {
  const who = reply.authorHandle ? `@${reply.authorHandle}` : 'a post';
  return (
    <span className="reply-line" title={reply.text ? `${who}: ${reply.text}` : undefined}>
      <CornerUpLeft size={12} aria-hidden="true" />
      <span className="reply-to">
        Replying to <strong>{who}</strong>
        {reply.text && <span className="reply-snippet"> · {reply.text}</span>}
      </span>
    </span>
  );
}

export function QuoteBox({ quote }: { quote: QuotedPost }) {
  const name =
    quote.authorDisplayName || (quote.authorHandle ? `@${quote.authorHandle}` : 'Quoted post');
  const first = quote.media[0];
  return (
    <span className="quote-box">
      <span className="quote-head">
        {quote.authorAvatarUrl && (
          <img
            className="quote-avatar"
            src={quote.authorAvatarUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        <strong>{name}</strong>
        {quote.authorHandle && quote.authorDisplayName && <span>@{quote.authorHandle}</span>}
      </span>
      <span className="quote-body">
        <span className={`quote-text ${quote.text ? '' : 'is-muted'}`}>
          {quote.text || (quote.media.length ? mediaLabel(quote.media) : 'Quoted post')}
        </span>
        {first && (
          <span className="quote-media">
            <Thumb item={first} compact />
            {quote.media.length > 1 && (
              <span className="media-more">+{quote.media.length - 1}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
}

export function LinkPreview({ card }: { card: LinkCard }) {
  const [failed, setFailed] = useState(false);
  const Icon = card.kind === 'article' ? Newspaper : Link2;
  const domain = card.domain ?? (card.kind === 'article' ? 'X Article' : 'Link');
  if (!card.title)
    return (
      <span className="link-row">
        <Icon size={13} aria-hidden="true" />
        <span>{domain}</span>
      </span>
    );
  return (
    <span className="link-card">
      {card.imageUrl && !failed && (
        <img
          className="link-thumb"
          src={card.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      <span className="link-meta">
        <span className="link-domain">
          <Icon size={12} aria-hidden="true" />
          {card.kind === 'article' ? 'Article' : domain}
        </span>
        <span className="link-title">{card.title}</span>
      </span>
    </span>
  );
}
