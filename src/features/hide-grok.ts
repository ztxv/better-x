/*
 * Selectors and icon paths adapted from Control Panel for Twitter (MIT, Copyright (c) 2019,
 * Jonny Buchanan). See THIRD_PARTY_NOTICES.md.
 */
import type { ToggleFeature } from './types';

const GROK = '/i/grok';

/**
 * Hides Grok's own interface, using only CSS (so it covers surfaces X renders later, and
 * switching it off restores them at once). Selectors are the ones Control Panel for Twitter has
 * relied on; they target Grok's surfaces, never a post that merely mentions Grok.
 *
 * - Navigation: the Grok entry in the main nav (the side nav, and the narrow layout's bar), in
 *   menus, in the narrow layout's menu dialog, and in the "More" dialog.
 * - Buttons and shortcuts: the Grok drawer, the image-generation button in the composer, the
 *   "Grok actions" button on posts, and "Ask Grok" links inside posts.
 * - Prompts: the suggested follow-up prompts under a post, and the Grok summary at the top of
 *   search results.
 * - The Grok Imagine promo in the sidebar.
 *
 * Fragile by nature: these depend on X's test IDs and link targets. The "Grok actions" button is
 * matched by its English label (X gives it no stable test ID), so it is only hidden in English.
 * Not hidden, to be offered as separate options later: posts that share Grok conversations and
 * Grok's image-editing entry points.
 */
export const hideGrok: ToggleFeature = {
  id: 'cleanup.hideGrok',
  category: 'cleanup',
  title: 'Hide Grok',
  description: 'Remove Grok buttons, shortcuts and promotions.',
  kind: 'toggle',
  defaultEnabled: false,
  css: `
nav a[href$="${GROK}"],
[role="menu"] a[href="${GROK}"],
html[data-bx-layout="narrow"] [role="dialog"] a[href="${GROK}"],
[aria-labelledby="modal-header"] a[href$="${GROK}"],
div[data-testid="GrokDrawer"],
button[data-testid="grokImgGen"],
button[aria-label="Grok actions"],
[data-testid="tweet"] a[href="${GROK}"],
[data-testid="tweet"] [data-testid^="followups_"],
[data-testid="tweet"] [data-testid^="followups_"] + nav,
html[data-bx-route="search"] [data-testid="primaryColumn"] > div > div:has(> [data-testid="followups_search"]),
[data-testid="sidebarColumn"] aside[role="complementary"]:has(> a[href^="https://grok.com/imagine"]) {
  display: none !important;
}`,
};
