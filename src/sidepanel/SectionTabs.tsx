export type Section = 'library' | 'customize';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'library', label: 'Library' },
  { id: 'customize', label: 'Customize' },
];

/**
 * The Library | Customize switch: an ARIA tab list, with the selected tab the only one in the Tab
 * order and Left/Right moving between tabs.
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
      {SECTIONS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          id={`${id}-tab`}
          aria-selected={section === id}
          aria-controls={id === 'customize' ? 'customize-panel' : 'library-panel'}
          tabIndex={section === id ? 0 : -1}
          className={section === id ? 'selected' : ''}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const next = id === 'library' ? 'customize' : 'library';
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
