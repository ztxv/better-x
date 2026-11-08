export type Section = 'library' | 'customize' | 'themes';

export const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'library', label: 'Library' },
  { id: 'customize', label: 'Customize' },
  { id: 'themes', label: 'Themes' },
];

/**
 * The Library | Customize | Themes switch: an ARIA tab list, with the selected tab the only one in
 * the Tab order, Left/Right moving between tabs (wrapping at the ends) and Home/End to the first
 * and last.
 */
export function SectionTabs({
  section,
  onChange,
}: {
  section: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <div className="section-tabs" role="tablist" aria-label="Better X">
      {SECTIONS.map(({ id, label }, index) => (
        <button
          key={id}
          role="tab"
          id={`${id}-tab`}
          aria-selected={section === id}
          aria-controls={`${id}-panel`}
          tabIndex={section === id ? 0 : -1}
          className={section === id ? 'selected' : ''}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            const last = SECTIONS.length - 1;
            const to =
              event.key === 'ArrowRight'
                ? index === last
                  ? 0
                  : index + 1
                : event.key === 'ArrowLeft'
                  ? index === 0
                    ? last
                    : index - 1
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? last
                      : null;
            if (to === null) return;
            event.preventDefault();
            const next = SECTIONS[to]!.id;
            onChange(next);
            document.getElementById(`${next}-tab`)?.focus();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
