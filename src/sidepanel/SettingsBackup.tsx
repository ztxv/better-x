import { Download, FileJson, Upload } from 'lucide-react';
import { Fragment, useId, useRef, useState } from 'react';
import { featureRegistry } from '../features';
import {
  createSettingsBackup,
  importPatch,
  MAX_BACKUP_BYTES,
  parseSettingsBackup,
  settingsBackupFilename,
  type ImportMode,
  type ImportPreview,
  type ValidatedBackup,
} from '../lib/settings-backup';
import { loadSettings, type Settings, type SettingsPatch } from '../lib/settings';

interface Pending {
  fileName: string;
  backup: ValidatedBackup;
  preview: ImportPreview;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Export and import of the customization settings, kept apart from the Library's backup. Importing
 * reads and checks the file first and shows what it holds (counts only, nothing from the file is
 * displayed); nothing changes until Apply, and Merge or Replace is chosen there. The settings are
 * written in one go through `apply`, and every open X tab and panel follows.
 */
export function SettingsBackup({
  settings,
  apply,
}: {
  settings: Settings;
  apply: (patch: SettingsPatch) => Promise<unknown>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [status, setStatus] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const modeName = useId();

  function exportSettings() {
    const backup = createSettingsBackup(settings, featureRegistry);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = settingsBackupFilename();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const count = Object.keys(backup.features).length + Object.keys(backup.values).length;
    setStatus({
      text: count
        ? `Exported ${plural(count, 'setting')} to ${link.download}.`
        : `Exported your look (theme and accent) to ${link.download}; no customizations are switched on yet.`,
      kind: 'ok',
    });
  }

  async function chooseFile(file?: File) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setPending(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setStatus({ text: 'That file is too large to be a settings backup.', kind: 'error' });
      return;
    }
    const result = parseSettingsBackup(await file.text(), featureRegistry, await loadSettings());
    if (!result.ok) {
      setStatus({ text: result.error, kind: 'error' });
      return;
    }
    setStatus(null);
    setMode('merge');
    setPending({ fileName: file.name, backup: result.backup, preview: result.preview });
  }

  async function confirm() {
    if (!pending) return;
    const { preview, backup } = pending;
    const changes = mode === 'merge' ? preview.mergeChanges : preview.replaceChanges;
    try {
      // The file is read again against what is stored now, so a change made since the preview
      // is not overwritten with a stale comparison; the write itself is one storage set.
      await apply(importPatch(backup, mode, featureRegistry, await loadSettings()));
      const ignored = preview.unsupported + preview.invalid;
      setStatus({
        text: changes
          ? `Imported ${plural(preview.recognized, 'setting')}: ${plural(changes, 'change')} applied` +
            (ignored ? `, ${ignored} ignored.` : '.')
          : 'No changes needed: your settings already match this file.',
        kind: 'ok',
      });
    } catch {
      setStatus({
        text: 'Could not save the imported settings. Nothing was changed.',
        kind: 'error',
      });
    }
    setPending(null);
  }

  const changes = pending
    ? mode === 'merge'
      ? pending.preview.mergeChanges
      : pending.preview.replaceChanges
    : 0;

  return (
    <Fragment>
      <h4 className="data-group">Customization settings</h4>
      <button onClick={exportSettings}>
        <FileJson size={15} />
        Export customization settings
      </button>
      <button onClick={() => fileRef.current?.click()}>
        <Upload size={15} />
        Import customization settings
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Settings backup file"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      <p className="setting-hint">
        Transfer your Better X customization settings between browsers without an account. They hold
        your switches, sliders, theme, account insights and country filter choices, not your
        library, and never any cached account data.
      </p>

      {pending && (
        <div className="backup-preview" role="group" aria-label="Import preview">
          <ul>
            <li>
              <strong>{plural(pending.preview.found, 'setting')}</strong> found
            </li>
            <li>
              <strong>{pending.preview.recognized}</strong> recognized
            </li>
            {pending.preview.unsupported > 0 && (
              <li>
                <strong>{pending.preview.unsupported}</strong> unsupported (from another version of
                Better X, ignored)
              </li>
            )}
            {pending.preview.invalid > 0 && (
              <li>
                <strong>{pending.preview.invalid}</strong> with an invalid value (ignored)
              </li>
            )}
          </ul>
          <div className="backup-modes" role="radiogroup" aria-label="How to import">
            <label className="radio-option">
              <input
                type="radio"
                name={modeName}
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              <span>
                <strong>Merge with current settings</strong>
                <small>Sets what the file names. Everything else stays as it is.</small>
              </span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name={modeName}
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <span>
                <strong>Replace customization settings</strong>
                <small>
                  Makes the file your whole setup. Switches and sliders it does not name go back to
                  their defaults.
                </small>
              </span>
            </label>
          </div>
          <p className="backup-effect" role="status">
            {changes
              ? `${plural(changes, 'setting')} would change.`
              : 'Nothing would change: your settings already match.'}
          </p>
          <div className="backup-actions">
            <button className="text-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="text-button primary" onClick={() => void confirm()}>
              <Download size={13} />
              {mode === 'merge' ? 'Merge' : 'Replace'}
            </button>
          </div>
        </div>
      )}
      {status && (
        <p className={`backup-status is-${status.kind}`} role="status">
          {status.text}
        </p>
      )}
    </Fragment>
  );
}
