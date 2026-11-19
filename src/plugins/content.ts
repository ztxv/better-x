import type { ContentPlugin } from './host';
import { spotifyPlugin } from './spotify';

/** The X-page half of every plugin in `./catalog.ts`. A test keeps the two lists in step. */
export const CONTENT_PLUGINS: readonly ContentPlugin[] = [spotifyPlugin];
