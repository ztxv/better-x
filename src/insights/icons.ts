import { siAndroid, siApple } from 'simple-icons';

/**
 * Icons drawn on the X page. The glyphs are Lucide's (ISC) inlined, so nothing loads from the
 * network; the two platform marks are Simple Icons' paths for Apple and Android (CC0), used only
 * to say which platform X reports. See THIRD_PARTY_NOTICES.md.
 */
const line = (body: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const mark = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="none"><path d="${path}"/></svg>`;

export const ACCOUNT_ICONS = {
  globe: line(
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  ),
  mapPin: line(
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  ),
  alert: line(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  refresh: line(
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  ),
  eye: line(
    '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  ),
  close: line('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  info: line('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  shield: line(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  ),
  chevron: line('<path d="m9 18 6-6-6-6"/>'),
  apple: mark(siApple.path),
  android: mark(siAndroid.path),
} as const;

export type AccountIcon = keyof typeof ACCOUNT_ICONS;
