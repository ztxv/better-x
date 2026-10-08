import {
  Ban,
  Compass,
  Home,
  MessageSquareText,
  Palette,
  PanelRight,
  RotateCcw,
  Search,
  SearchX,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { FEATURES, featureRegistry } from '../features';
import { presetPatch, resetPatch, restorePatch, type Preset } from '../features/presets';
import { CATEGORY_SHORT, CATEGORY_TITLES, type FeatureCategory } from '../features/types';
import type { Settings, SettingsPatch } from '../lib/settings';
import { featureState, matchesQuery, searchTerms } from './customizeModel';
import { FeatureGroup } from './FeatureGroup';
import { Presets } from './Presets';
import { SliderRow } from './SliderRow';
import { Toggle } from './Toggle';

const CATEGORY_ICONS: Record<FeatureCategory, ComponentType<{ size?: number }>> = {
  navigation: Compass,
  feed: Home,
  posts: MessageSquareText,
  sidebar: PanelRight,
  appearance: Palette,
  cleanup: Ban,
};
const CATEGORIES = Object.keys(CATEGORY_TITLES) as FeatureCategory[];
const UI_KEY = 'bx.customize.ui';

/** Which groups are open, remembered between visits to the panel (a convenience, never required). */
function loadOpen(): FeatureCategory[] {
  try {
    const stored = JSON.parse(localStorage.getItem(UI_KEY) ?? 'null') as { open?: unknown } | null;
    if (Array.isArray(stored?.open))
      return stored.open.filter((id): id is FeatureCategory => CATEGORIES.includes(id));
  } catch {
    /* Storage can be unavailable or hold something else; fall through to the default. */
  }
  return ['navigation'];
}
function saveOpen(open: FeatureCategory[]) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ open }));
  } catch {
    /* Remembering is optional. */
  }
}

interface Applied {
  preset: Preset;
  before: Pick<Settings, 'features' | 'values'>;
}

/**
 * The Customize view: every customization feature, searchable and grouped by category. A switch
 * (or slider) takes effect on every open X tab as soon as it changes, and turning one off
 * restores what it changed. Stays mounted while the Library is showing, so the search, the open
 * groups and the scroll position are where you left them.
 */
export function Customize({
  settings,
  onChange,
  hidden = false,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
  hidden?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FeatureCategory | 'all'>('all');
  const [open, setOpen] = useState<FeatureCategory[]>(loadOpen);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => searchTerms(query), [query]);
  const searching = terms.length > 0;
  const states = useMemo(
    () => new Map(FEATURES.map((def) => [def.id, featureState(def, settings, featureRegistry)])),
    [settings],
  );

  const visible = useMemo(
    () =>
      FEATURES.filter(
        (def) => (category === 'all' || def.category === category) && matchesQuery(def, terms),
      ),
    [category, terms],
  );
  const groups = CATEGORIES.map((id) => ({
    id,
    all: FEATURES.filter((def) => def.category === id),
    shown: visible.filter((def) => def.category === id),
  })).filter((group) => group.shown.length > 0);

  const totalOn = [...states.values()].filter((state) => state.enabled).length;
  const anyChanged = [...states.values()].some((state) => state.changed);

  const setGroupOpen = useCallback((id: FeatureCategory, next: boolean) => {
    setOpen((current) => {
      const updated = next ? [...new Set([...current, id])] : current.filter((item) => item !== id);
      saveOpen(updated);
      return updated;
    });
  }, []);

  function pickCategory(next: FeatureCategory | 'all') {
    setCategory(next);
    if (next !== 'all') setGroupOpen(next, true);
  }
  function apply(preset: Preset) {
    setApplied({ preset, before: { features: settings.features, values: settings.values } });
    setConfirmReset(false);
    onChange(presetPatch(preset, featureRegistry));
  }
  function undo() {
    if (!applied) return;
    onChange(restorePatch(applied.before, featureRegistry));
    setApplied(null);
  }
  // Any change made by hand after a preset makes "Undo" ambiguous, so the notice goes away.
  function change(patch: SettingsPatch) {
    setApplied(null);
    setConfirmReset(false);
    onChange(patch);
  }

  // "/" jumps to the search, as on most sites with a settings search.
  useEffect(() => {
    if (hidden) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const modal = document.querySelector('dialog[open], [aria-modal="true"]');
      if (
        event.key === '/' &&
        !typing &&
        !modal &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hidden]);

  return (
    <main
      className="customize"
      id="customize-panel"
      role="tabpanel"
      aria-labelledby="customize-tab"
      hidden={hidden}
    >
      <div className="customize-top">
        <div className="customize-search" role="search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={`Search ${FEATURES.length} settings`}
            aria-label="Search settings"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="category-chips" role="group" aria-label="Show category">
          {(['all', ...CATEGORIES] as const).map((id) => {
            const members = id === 'all' ? FEATURES : FEATURES.filter((def) => def.category === id);
            const on = members.filter((def) => states.get(def.id)!.enabled).length;
            return (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={category === id}
                onClick={() => pickCategory(id)}
              >
                {id === 'all' ? 'All' : CATEGORY_SHORT[id]}
                {on > 0 && <span className="chip-count">{on}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="customize-summary" aria-live="polite">
        {searching
          ? `${visible.length} ${visible.length === 1 ? 'setting' : 'settings'} found`
          : `${totalOn} of ${FEATURES.length} on · changes apply to X right away`}
      </p>

      {!searching && category === 'all' && (
        <Presets active={applied?.preset.id ?? null} onApply={apply} />
      )}
      {applied && (
        <div className="preset-notice" role="status">
          <span>
            <strong>{applied.preset.title}</strong> applied.
          </span>
          <button type="button" onClick={undo}>
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="customize-empty" role="status">
          <SearchX size={22} aria-hidden="true" />
          <strong>No settings match “{query.trim()}”</strong>
          <small>Try a shorter word, such as “ads”, “counts” or “sidebar”.</small>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            Clear search
          </button>
        </div>
      )}

      {groups.map(({ id, all, shown }) => {
        const members = all.map((def) => states.get(def.id)!);
        return (
          <FeatureGroup
            key={id}
            category={id}
            icon={CATEGORY_ICONS[id]}
            open={searching || open.includes(id)}
            on={members.filter((state) => state.enabled).length}
            total={all.length}
            changed={members.some((state) => state.changed)}
            onOpen={(next) => setGroupOpen(id, next)}
            onReset={() =>
              change(
                resetPatch(
                  featureRegistry,
                  all.map((def) => def.id),
                ),
              )
            }
          >
            {shown.map((def) => {
              const state = states.get(def.id)!;
              return (
                <div
                  className="feature-row"
                  key={def.id}
                  data-feature={def.id}
                  data-on={state.enabled}
                >
                  {def.kind === 'slider' ? (
                    <SliderRow
                      feature={def}
                      enabled={state.enabled}
                      value={state.value!}
                      onToggle={(on) => change({ features: { [def.id]: on } })}
                      onValue={(value) => change({ values: { [def.id]: value } })}
                    />
                  ) : (
                    <Toggle
                      label={def.title}
                      hint={def.description}
                      checked={state.enabled}
                      onChange={(on) => change({ features: { [def.id]: on } })}
                    />
                  )}
                </div>
              );
            })}
          </FeatureGroup>
        );
      })}

      {anyChanged && !searching && (
        <div className="customize-footer">
          {confirmReset ? (
            <>
              <span>Turn every customization off?</span>
              <button
                type="button"
                className="link-button danger"
                onClick={() => {
                  change(resetPatch(featureRegistry));
                }}
              >
                Reset all
              </button>
              <button type="button" className="link-button" onClick={() => setConfirmReset(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="link-button" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={13} /> Reset customization
            </button>
          )}
        </div>
      )}
    </main>
  );
}
