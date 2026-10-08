import type { Scope } from '../runtime/scope';
import type { Settings } from '../lib/settings';
import type { Overlay } from './overlay';

/**
 * The Saved feature's shared state. One instance per content script, passed to the modules that
 * make up the feature (control, chip, menu, downloads, overlay) instead of living in one closure.
 */
export interface SavedContext {
  /** Owns everything the feature keeps running; disposing it takes the feature down. */
  scope: Scope;
  /** Post ids that are in the library. */
  saved: Set<string>;
  /** Post ids whose save is in flight. */
  saving: Set<string>;
  /** Each injected save control and the post it currently shows. */
  buttons: Map<HTMLButtonElement, string>;
  /** The one open chip or menu, if any. */
  overlay: Overlay | null;
  /** Controls waiting to be measured against X's own icons, and the frame that will do it. */
  unaligned: Set<HTMLButtonElement>;
  cancelAlign: () => void;
  settings: Settings;
  /** Settles once the stored settings have been applied (the defaults hold until then). */
  settingsReady: Promise<void>;
}
