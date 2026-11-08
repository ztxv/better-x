import { PRODUCT_NAME } from './brand';

/** Injected at build time by wxt.config.ts (ISO date of the build). Absent under tests. */
declare const __BUILD_DATE__: string | undefined;

export const REPO_URL = 'https://github.com/ztxv/better-x';

export type About = { name: string; version: string; updated: string | null };

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getAbout(): About {
  let version = 'dev';
  try {
    version = chrome.runtime.getManifest().version;
  } catch {
    // Not running as an extension (tests, previews).
  }
  const built = typeof __BUILD_DATE__ === 'undefined' ? undefined : __BUILD_DATE__;
  return { name: PRODUCT_NAME, version, updated: formatDate(built) };
}
