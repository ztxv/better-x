import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ThemeTokens } from '../themes/types';

/** The tokens as CSS variables for a preview: pure CSS, no images. */
export const previewStyle = (tokens: ThemeTokens) =>
  ({
    '--p-bg': tokens.bg,
    '--p-raised': tokens.raised,
    '--p-border': tokens.border,
    '--p-text': tokens.text,
    '--p-muted': tokens.muted,
    '--p-accent': tokens.accent,
  }) as CSSProperties;

/** A miniature X post drawn in a theme's colors: page, a raised card, text, secondary text, accent. */
export function ThemePreview({ tokens, large = false }: { tokens: ThemeTokens; large?: boolean }) {
  return (
    <span
      className={`theme-preview ${large ? 'is-large' : ''}`}
      style={previewStyle(tokens)}
      aria-hidden="true"
    >
      <span className="tp-avatar" />
      <span className="tp-lines">
        <span className="tp-line tp-name" />
        <span className="tp-line tp-handle" />
        <span className="tp-line tp-body" />
        <span className="tp-card" />
      </span>
      <span className="tp-pill" />
    </span>
  );
}

/** One theme to choose: a button with `aria-pressed`, its preview and its name. */
export function ThemeCard({
  title,
  description,
  tokens,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  tokens: ThemeTokens;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="theme-card"
      aria-pressed={selected}
      title={`${title}: ${description}`}
      onClick={onSelect}
    >
      <ThemePreview tokens={tokens} />
      <span className="theme-card-name">
        <strong>{title}</strong>
        {selected && <Check size={13} strokeWidth={3} aria-hidden="true" />}
      </span>
    </button>
  );
}
