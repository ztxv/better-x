import { useCallback, useEffect, useState } from 'react';
import { request } from '../lib/api';
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  watchSettings,
  type Settings,
  type SettingsPatch,
} from '../lib/settings';
import { DOWNLOADS_REVISION_KEY } from '../storage/db';
import type { DownloadRecord } from '../types/model';

/** The theme is also cached locally so the panel opens without a flash of the wrong theme. */
const THEME_CACHE = 'bx.theme';

function applyAppearance(settings: Settings) {
  const root = document.documentElement;
  const accent = ACCENTS[settings.accent];
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  root.style.setProperty('--brand', accent.brand);
  root.style.setProperty('--accent-light', accent.text);
  root.style.setProperty('--accent-dark', accent.textDark);
  root.style.setProperty('--accent-soft-light', accent.softLight);
  root.style.setProperty('--accent-soft-dark', accent.softDark);
  try {
    localStorage.setItem(THEME_CACHE, settings.theme);
  } catch {
    /* Storage can be unavailable; the shared setting still applies. */
  }
}

function cachedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_CACHE);
  } catch {
    return null;
  }
}

/** Shared settings, live across the panel, every X tab, and the background worker. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() =>
    normalizeSettings({ ...DEFAULT_SETTINGS, theme: cachedTheme() }),
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    applyAppearance(settings);
  }, [settings]);
  useEffect(() => {
    let active = true;
    void loadSettings().then((loaded) => {
      if (!active) return;
      setSettings(loaded);
      setReady(true);
    });
    const stop = watchSettings(setSettings);
    return () => {
      active = false;
      stop();
    };
  }, []);
  const update = useCallback(async (patch: SettingsPatch) => {
    setSettings(await saveSettings(patch));
  }, []);
  return { settings, ready, update };
}

/** Download history, refreshed whenever any context records a change. */
export function useDownloads() {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const refresh = useCallback(async () => {
    try {
      setRecords(await request<DownloadRecord[]>({ type: 'downloads' }));
    } catch {
      /* History is optional for browsing; the library keeps working. */
    }
  }, []);
  useEffect(() => {
    // Opening the library is a good moment to catch up with Chrome's own download state.
    void request({ type: 'reconcileDownloads' })
      .catch(() => {})
      .finally(() => void refresh());
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[DOWNLOADS_REVISION_KEY]) void refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);
  return { records, refresh };
}

/** Whether each completed download's file is still where Chrome saved it. */
export function useFileStatus(records: DownloadRecord[]) {
  const [exists, setExists] = useState<Map<number, boolean>>(new Map());
  const ids = records
    .filter((record) => record.status === 'complete' && record.chromeId !== null)
    .map((record) => record.chromeId!)
    .join(',');
  useEffect(() => {
    if (!ids || !chrome.downloads?.search) return;
    let active = true;
    void Promise.all(
      ids.split(',').map(async (id) => {
        const [item] = await chrome.downloads.search({ id: Number(id) }).catch(() => []);
        return [Number(id), !!item?.exists] as const;
      }),
    ).then((entries) => {
      if (active) setExists(new Map(entries));
    });
    return () => {
      active = false;
    };
  }, [ids]);
  return exists;
}
