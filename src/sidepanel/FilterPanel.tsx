import { Plus, Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { flagOf, resolveSelectable, searchPlaces, type Place } from '../insights/places';
import {
  MAX_ALWAYS_SHOW,
  MAX_COUNTRIES,
  normalizeHandle,
  type FilterMode,
  type Settings,
  type SettingsPatch,
} from '../lib/settings';

const MODES: Array<{ value: FilterMode; label: string; hint: string }> = [
  {
    value: 'collapse',
    label: 'Collapse (recommended)',
    hint: 'Replaces the post with a small note and a Show post button.',
  },
  { value: 'hide', label: 'Hide', hint: 'Removes the post from view with no note.' },
  { value: 'highlight', label: 'Highlight', hint: 'Keeps the post and marks it.' },
];

/** The place picker: type to search countries (and the region labels X uses), pick several. */
function CountryPicker({
  selected,
  onAdd,
}: {
  selected: readonly string[];
  onAdd: (place: Place) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const taken = useMemo(() => new Set(selected), [selected]);
  const results = useMemo(
    () =>
      searchPlaces(query, 40)
        .filter((place) => !taken.has(place.name))
        .slice(0, 8),
    [query, taken],
  );
  const pick = (place: Place) => {
    onAdd(place);
    setQuery('');
    setActive(0);
  };
  const showList = open && results.length > 0;
  return (
    <div className="picker">
      <div className="customize-search picker-input">
        <Search size={15} aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-label="Add a country or region"
          placeholder="Add a country or region"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && showList) {
              event.preventDefault();
              pick(results[active] ?? results[0]!);
            } else if (event.key === 'Escape' && (open || query)) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setQuery('');
            }
          }}
        />
      </div>
      {showList && (
        <ul className="picker-list" role="listbox" id={listId} aria-label="Matching places">
          {results.map((place, index) => (
            <li
              key={place.code ?? place.name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              // Pointer down, not click: the input would lose focus (and close the list) first.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(place);
              }}
            >
              <span aria-hidden="true">{flagOf(place) ?? '🌐'}</span> {place.name}
              {place.kind === 'region' && <small> region</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The Smart filtering controls: which countries, what happens to a match, where it applies, and
 * the accounts that are always shown. Whether the filter runs is the switch above this panel.
 */
export function FilterPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const { filter } = settings;
  const [handle, setHandle] = useState('');
  const [problem, setProblem] = useState('');

  function addHandle() {
    const clean = normalizeHandle(handle);
    if (!clean) return setProblem('Enter an X username, like @name.');
    if (filter.alwaysShow.some((entry) => entry.handle === clean))
      return setProblem(`@${clean} is already on the list.`);
    if (filter.alwaysShow.length >= MAX_ALWAYS_SHOW)
      return setProblem(`The list holds up to ${MAX_ALWAYS_SHOW} accounts.`);
    setProblem('');
    setHandle('');
    onChange({ filter: { alwaysShow: [...filter.alwaysShow, { handle: clean }] } });
  }

  return (
    <div className="smart-panel" data-panel="filtering">
      <h3 id="countries-title">Countries and regions</h3>
      <CountryPicker
        selected={filter.countries}
        onAdd={(place) => {
          if (filter.countries.length >= MAX_COUNTRIES) return;
          const canonical = resolveSelectable(place.name)?.name ?? place.name;
          onChange({ filter: { countries: [...filter.countries, canonical] } });
        }}
      />
      {filter.countries.length > 0 ? (
        <>
          <ul className="chip-row" aria-labelledby="countries-title">
            {filter.countries.map((name) => {
              const place = resolveSelectable(name);
              return (
                <li key={name}>
                  <span aria-hidden="true">{(place && flagOf(place)) ?? '🌐'}</span> {name}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      onChange({
                        filter: { countries: filter.countries.filter((item) => item !== name) },
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="link-button"
            onClick={() => onChange({ filter: { countries: [] } })}
          >
            Clear all
          </button>
        </>
      ) : (
        <p className="setting-hint">None chosen: nothing is filtered and nothing is looked up.</p>
      )}
      <p className="setting-hint">
        A post matches when X says its author’s account is based in one of these. A region label
        matches only accounts X labels with exactly that region. Accounts X has not answered for are
        never filtered. This only changes what you see here: nobody is blocked, muted or reported.
      </p>

      <h3 id="mode-title">What happens to a match</h3>
      <div className="radio-list" role="radiogroup" aria-labelledby="mode-title">
        {MODES.map((option) => (
          <label key={option.value} className="radio-option">
            <input
              type="radio"
              name="filter-mode"
              checked={filter.mode === option.value}
              onChange={() => onChange({ filter: { mode: option.value } })}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </div>

      <h3 id="apply-title">Apply to</h3>
      <div className="check-row" role="group" aria-labelledby="apply-title">
        <label>
          <input
            type="checkbox"
            checked={filter.posts}
            onChange={(event) => onChange({ filter: { posts: event.target.checked } })}
          />{' '}
          Posts
        </label>
        <label>
          <input
            type="checkbox"
            checked={filter.quotes}
            onChange={(event) => onChange({ filter: { quotes: event.target.checked } })}
          />{' '}
          Quoted posts
        </label>
      </div>
      <p className="setting-hint">
        A quoted post is judged by its own author, apart from the post that quotes it.
      </p>

      <h3 id="always-title">Always show</h3>
      <form
        className="handle-form"
        onSubmit={(event) => {
          event.preventDefault();
          addHandle();
        }}
      >
        <input
          type="text"
          value={handle}
          aria-label="X username to always show"
          aria-invalid={problem ? true : undefined}
          placeholder="@username"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setHandle(event.target.value);
            setProblem('');
          }}
        />
        <button type="submit" className="link-button" disabled={!handle.trim()}>
          <Plus size={13} /> Add
        </button>
      </form>
      {problem && (
        <p className="setting-hint is-error" role="alert">
          {problem}
        </p>
      )}
      {filter.alwaysShow.length > 0 && (
        <ul className="chip-row" aria-labelledby="always-title">
          {filter.alwaysShow.map((entry) => (
            <li key={entry.handle}>
              @{entry.handle}
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove @${entry.handle} from the list`}
                onClick={() =>
                  onChange({
                    filter: {
                      alwaysShow: filter.alwaysShow.filter((item) => item.handle !== entry.handle),
                    },
                  })
                }
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="setting-hint">
        These accounts are never filtered, and neither are your own posts or the post you opened.
        Better X remembers each account’s numeric id once it has looked it up, so a rename does not
        break the entry.
      </p>
    </div>
  );
}
