import { useEffect, useRef } from 'react';
import { Check, Download, History, Layers2, RotateCcw, Trash, Upload, X } from 'lucide-react';
import { SettingsBackup } from './SettingsBackup';
import { Toggle } from './Toggle';
import { REPO_URL, getAbout } from '../lib/about';
import {
  ACCENTS,
  type AccentId,
  type AfterSave,
  type OpenAs,
  type Settings,
  type SettingsPatch,
  type Theme,
  saveSettings,
} from '../lib/settings';

const OPEN_AS: Array<{ value: OpenAs; label: string; hint: string }> = [
  {
    value: 'sidepanel',
    label: 'Side panel',
    hint: 'Stays open beside the page while you browse X',
  },
  {
    value: 'popup',
    label: 'Popup',
    hint: 'A compact window under the toolbar icon, closed by clicking elsewhere',
  },
];

const AFTER_SAVE: Array<{ value: AfterSave; label: string; hint: string }> = [
  {
    value: 'downloadOffer',
    label: 'Saved + Download',
    hint: 'Offer a download for posts with media',
  },
  {
    value: 'confirmationOnly',
    label: 'Saved only',
    hint: 'A brief confirmation, no download offer',
  },
  { value: 'quiet', label: 'Quiet', hint: 'Only the icon fills in' },
];

/** A miniature of the X page overlays, drawn with the chosen accent and the current theme. */
function Preview({ settings }: { settings: Settings }) {
  const download = settings.downloadsEnabled;
  return (
    <div className="settings-preview" aria-hidden="true">
      <div className="preview-row">
        <span className="preview-icon">
          <Layers2 size={15} strokeWidth={2} />
        </span>
        {settings.afterSave !== 'quiet' && (
          <span className="preview-chip">
            <Check size={12} strokeWidth={2.5} /> Saved
            {download && settings.afterSave === 'downloadOffer' && (
              <>
                <span className="preview-dot">·</span>
                <span className="preview-action">
                  <Download size={12} strokeWidth={2.5} /> Download
                </span>
              </>
            )}
          </span>
        )}
      </div>
      <div className="preview-menu">
        {download && settings.menuActions.download && (
          <span>
            <Download size={12} /> Download image
          </span>
        )}
        {settings.menuActions.openLibrary && <span>Open bookmark library</span>}
        <span className="preview-danger">Remove bookmark</span>
      </div>
    </div>
  );
}

export function SettingsDialog({
  settings,
  onChange,
  onReset,
  onClose,
  onExport,
  onImport,
  onClearBookmarks,
  onClearDownloads,
  bookmarkCount,
  downloadCount,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
  onReset: () => void;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  onClearBookmarks: () => void;
  onClearDownloads: () => void;
  bookmarkCount: number;
  downloadCount: number;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  const downloads = settings.downloadsEnabled;
  const about = getAbout();
  return (
    <div
      className="modal-backdrop settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="editor settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="editor-head">
          <h2 id="settings-title">Settings</h2>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <section className="settings-section" aria-labelledby="appearance-title">
          <h3 id="appearance-title">Appearance</h3>
          <div className="field-label" id="theme-label">
            Library theme
          </div>
          <div className="theme-switch" role="radiogroup" aria-labelledby="theme-label">
            {(['auto', 'light', 'dark'] as Theme[]).map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={settings.theme === value}
                className={settings.theme === value ? 'active' : ''}
                onClick={() => onChange({ theme: value })}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <p className="setting-hint">On X, menus follow X's own display setting.</p>
          <div className="field-label" id="accent-label">
            Accent color
          </div>
          <div className="accent-swatches" role="radiogroup" aria-labelledby="accent-label">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.accent === id}
                aria-label={ACCENTS[id].label}
                title={ACCENTS[id].label}
                className={`swatch ${settings.accent === id ? 'active' : ''}`}
                style={{ '--swatch': ACCENTS[id].brand } as React.CSSProperties}
                onClick={() => onChange({ accent: id })}
              >
                {settings.accent === id && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
          <Preview settings={settings} />
        </section>

        <section className="settings-section" aria-labelledby="open-title">
          <h3 id="open-title">Open Better X as</h3>
          <div className="radio-list" role="radiogroup" aria-labelledby="open-title">
            {OPEN_AS.map((option) => (
              <label key={option.value} className="radio-option">
                <input
                  type="radio"
                  name="open-as"
                  checked={settings.openAs === option.value}
                  onChange={() => onChange({ openAs: option.value })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="setting-hint">
            Applies the next time you click the toolbar icon. You can change it here again in either
            mode.
          </p>
        </section>

        <section className="settings-section" aria-labelledby="downloads-title">
          <h3 id="downloads-title">Downloads</h3>
          <Toggle
            label="Show download options"
            hint="Turning this off hides download actions. History is kept."
            checked={downloads}
            onChange={(value) => onChange({ downloadsEnabled: value })}
          />
          <div className="field-label" id="after-save-label">
            After saving a post on X
          </div>
          <div className="radio-list" role="radiogroup" aria-labelledby="after-save-label">
            {AFTER_SAVE.map((option) => (
              <label key={option.value} className="radio-option">
                <input
                  type="radio"
                  name="after-save"
                  checked={settings.afterSave === option.value}
                  onChange={() => onChange({ afterSave: option.value })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>
                    {option.value === 'downloadOffer' && !downloads
                      ? 'Shows Saved only while download options are off'
                      : option.hint}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <Toggle
            label="Ask where to save each file"
            hint="Chrome may still ask if its own “Ask where to save” setting is on."
            checked={settings.saveAs}
            disabled={!downloads}
            onChange={(value) => onChange({ saveAs: value })}
          />
        </section>

        <section className="settings-section" aria-labelledby="menu-title">
          <h3 id="menu-title">Saved-post menu on X</h3>
          <Toggle
            label="Download"
            checked={settings.menuActions.download}
            disabled={!downloads}
            onChange={(value) => onChange({ menuActions: { download: value } })}
          />
          <Toggle
            label="Open bookmark library"
            hint="The toolbar icon always opens the library."
            checked={settings.menuActions.openLibrary}
            onChange={(value) => onChange({ menuActions: { openLibrary: value } })}
          />
          <p className="setting-hint">Remove bookmark is always available.</p>
          <button className="text-button reset-button" onClick={onReset}>
            <RotateCcw size={13} /> Reset appearance and Saved settings
          </button>
        </section>

        <section className="settings-section data-section" aria-labelledby="data-title">
          <h3 id="data-title">Data &amp; backup</h3>
          <h4 className="data-group">Library</h4>
          <button onClick={onExport}>
            <Download size={15} />
            Export Library
          </button>
          <button onClick={onImport}>
            <Upload size={15} />
            Import Library
          </button>
          <p className="setting-hint">
            Backups hold bookmarks, collections, and download history, not the media files.
          </p>
          <button className="danger" disabled={!bookmarkCount} onClick={onClearBookmarks}>
            <Trash size={15} />
            Clear all bookmarks…
          </button>
          <button className="danger" disabled={!downloadCount} onClick={onClearDownloads}>
            <History size={15} />
            Clear download history…
          </button>
          <SettingsBackup settings={settings} apply={saveSettings} />
        </section>

        <footer className="settings-about">
          <span>
            {about.name} v{about.version}
            {about.updated && <> · Updated {about.updated}</>}
          </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </footer>
      </section>
    </div>
  );
}
