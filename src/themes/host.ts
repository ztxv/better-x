import { SETTINGS_KEY, normalizeSettings, watchSettings, type Settings } from '../lib/settings';
import type { Scope } from '../runtime/scope';
import { THEME_ATTR, themeRules, themeVars } from './css';
import { deriveTokens, resolveTheme } from './derive';
import { watchXMode, xMode } from './detect';
import type { XMode } from './types';

export const THEME_STYLE_ID = 'bx-theme';
/** The last X mode a tab saw, so the next page load paints the right thing on its first frame. */
export const XMODE_CACHE_KEY = 'bx.xmode';

/**
 * Paints X with the chosen theme and keeps it in step with settings and with X's own mode, in
 * every open X tab, without a reload. Owns one `<style id="bx-theme">` (two text nodes: the
 * palette and the surface rules, each rewritten only when it changes) and the `data-bx-theme`
 * attribute on `<html>`, which is set only while a theme is chosen and X is in that theme's
 * mode: removing it switches every rule off at once (X switched to Default, or the theme off).
 * Disposing the scope removes both.
 */
export function startTheme(scope: Scope, doc: Document = document): void {
  const root = doc.documentElement;
  const style = doc.createElement('style');
  style.id = THEME_STYLE_ID;
  const vars = doc.createTextNode('');
  const rules = doc.createTextNode('');
  style.append(vars, rules);
  // `<head>` may not exist yet at document_start; `<html>` always does.
  root.append(style);
  scope.add(() => {
    style.remove();
    root.removeAttribute(THEME_ATTR);
  });

  let settings: Settings | null = null;
  let mode: XMode | null = xMode(doc);
  let cached: XMode | null = null;

  const apply = () => {
    if (scope.disposed || !settings) return;
    const { active, custom, chat } = settings.xTheme;
    const theme = resolveTheme(active, custom);
    const current = mode ?? cached;
    if (!theme || current !== theme.base) {
      root.removeAttribute(THEME_ATTR);
      if (!theme) vars.data = rules.data = '';
      return;
    }
    const nextVars = themeVars(deriveTokens(theme.seed));
    const nextRules = themeRules({ chat });
    if (vars.data !== nextVars) vars.data = nextVars;
    if (rules.data !== nextRules) rules.data = nextRules;
    if (root.getAttribute(THEME_ATTR) !== theme.id) root.setAttribute(THEME_ATTR, theme.id);
  };

  const remember = (next: XMode) => {
    if (next === cached) return;
    cached = next;
    chrome.storage.local.set({ [XMODE_CACHE_KEY]: next }).catch(() => {});
  };

  watchXMode(
    scope,
    (next) => {
      mode = next;
      remember(next);
      apply();
    },
    doc,
  );
  scope.add(
    watchSettings((next) => {
      settings = next;
      apply();
    }),
  );

  chrome.storage.local
    .get([SETTINGS_KEY, XMODE_CACHE_KEY])
    .then((stored) => {
      if (scope.disposed) return;
      const saved = stored[XMODE_CACHE_KEY];
      cached = saved === 'dark' || saved === 'light' ? saved : null;
      settings ??= normalizeSettings(stored[SETTINGS_KEY]);
      mode ??= xMode(doc);
      if (mode) remember(mode);
      apply();
    })
    .catch(() => {});
}
