import { ChevronDown, RotateCcw } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { CATEGORY_HINTS, CATEGORY_TITLES, type FeatureCategory } from '../features/types';

/**
 * One category of settings: a header that opens and closes it (with how many are on, and a reset
 * when anything differs from the defaults) and the settings themselves. A closed group stays in
 * the document so it keeps its state, but is inert: not focusable and not read out. Opening and
 * closing animate the height with CSS only.
 */
export function FeatureGroup({
  category,
  icon: Icon,
  open,
  on,
  total,
  changed,
  onOpen,
  onReset,
  children,
}: {
  category: FeatureCategory;
  icon: ComponentType<{ size?: number }>;
  open: boolean;
  on: number;
  total: number;
  changed: boolean;
  onOpen: (open: boolean) => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const title = CATEGORY_TITLES[category];
  return (
    <section className="customize-group" data-category={category} data-open={open}>
      <div className="group-head">
        <button
          type="button"
          className="group-toggle"
          id={`group-${category}`}
          aria-expanded={open}
          aria-controls={`group-panel-${category}`}
          onClick={() => onOpen(!open)}
        >
          <span className="group-icon">
            <Icon size={15} />
          </span>
          <span className="group-title">
            <h2>{title}</h2>
            <small>{CATEGORY_HINTS[category]}</small>
          </span>
          <span className="group-count" data-any={on > 0} aria-label={`${on} of ${total} on`}>
            {on}/{total}
          </span>
          <ChevronDown size={15} className="group-chevron" aria-hidden="true" />
        </button>
        {changed && (
          <button
            type="button"
            className="icon-button group-reset"
            aria-label={`Reset ${title} to defaults`}
            title={`Reset ${title}`}
            onClick={onReset}
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      <div
        className="group-panel"
        id={`group-panel-${category}`}
        role="region"
        aria-labelledby={`group-${category}`}
        inert={!open}
      >
        <div className="group-panel-inner">
          <div className="customize-card">{children}</div>
        </div>
      </div>
    </section>
  );
}
