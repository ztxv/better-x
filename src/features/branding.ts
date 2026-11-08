import { observe } from '../runtime/observe';
import type { ToggleFeature } from './types';

/**
 * Twitter branding: the bird as the tab icon and "Twitter" in the tab title. Both only touch the
 * document's `<head>` (the icon links and `<title>`), never X's page, and each watches `<head>`
 * with one managed observer for as long as it is on, because X rewrites both as you navigate and
 * when notifications arrive. Switching off puts X's own icon and title back.
 */

/** The classic Twitter bird (24 x 24), the mark the web app used until 2023. */
const BIRD_PATH =
  'M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.850 2.313 3.198 4.352 3.234-1.595 1.250-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.510 2.093 7.140 2.093 8.570 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.910-.658 1.700-1.477 2.323-2.410z';
const BIRD_BLUE = '#1d9bf0';

/** The bird as an SVG data URL; `pip` adds the unread dot X shows when there are notifications. */
export function birdIcon(pip = false): string {
  const dot = pip ? '<circle cx="20" cy="4" r="4" fill="#f91880"/>' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${BIRD_BLUE}" d="${BIRD_PATH}"/>${dot}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ICON_LINKS = 'link[rel~="icon"]';
/** X's own icon for "you have notifications" is its favicon with `pip` in the file name. */
const isPip = (href: string) => /pip/i.test(href);

export const twitterBird: ToggleFeature = {
  id: 'appearance.twitterBird',
  category: 'appearance',
  title: 'Twitter bird icon',
  description: 'Show the classic blue Twitter bird as the tab icon instead of the X logo.',
  keywords: ['favicon', 'logo', 'twitter', 'bird', 'tab icon', 'branding'],
  kind: 'toggle',
  defaultEnabled: false,
  activate({ scope }) {
    const head = document.head;
    /** X's own href for each icon link we changed, to put back when switched off. */
    const originals = new Map<HTMLLinkElement, string>();
    const apply = () => {
      for (const link of head.querySelectorAll<HTMLLinkElement>(ICON_LINKS)) {
        const href = link.getAttribute('href') ?? '';
        if (href.startsWith('data:image/svg+xml')) continue;
        originals.set(link, href);
        link.setAttribute('href', birdIcon(isPip(href)));
      }
    };
    apply();
    // X swaps the icon (the notification dot) by rewriting the link or adding a new one.
    observe(
      scope,
      head,
      { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] },
      apply,
    );
    scope.add(() => {
      for (const [link, href] of originals) if (link.isConnected) link.setAttribute('href', href);
    });
  },
};

/**
 * X's title with X named Twitter: "Home / X" → "Home / Twitter", "Name on X: "…" / X" →
 * "Name on Twitter: "…" / Twitter", and a bare "X" → "Twitter". Anything else is unchanged.
 */
export function twitterTitle(title: string): string {
  if (title === 'X') return 'Twitter';
  return title.replace(/ on X: /, ' on Twitter: ').replace(/ \/ X$/, ' / Twitter');
}

export const twitterName: ToggleFeature = {
  id: 'appearance.twitterTitle',
  category: 'appearance',
  title: 'Say Twitter in the tab title',
  description: 'Name the site Twitter in the browser tab, as in “Home / Twitter”.',
  keywords: ['title', 'tab', 'twitter', 'name', 'branding'],
  kind: 'toggle',
  defaultEnabled: false,
  activate({ scope }) {
    /** The last title X itself wrote, to restore when switched off. */
    let original = document.title;
    const apply = () => {
      const title = document.title;
      const renamed = twitterTitle(title);
      if (renamed === title) {
        // Either X wrote something with no "X" in it, or this is already ours.
        if (twitterTitle(original) !== title) original = title;
        return;
      }
      original = title;
      document.title = renamed;
    };
    apply();
    observe(scope, document.head, { childList: true, subtree: true, characterData: true }, apply);
    scope.add(() => {
      if (document.title === twitterTitle(original)) document.title = original;
    });
  },
};

export const BRANDING_FEATURES = [twitterBird, twitterName] as const;
