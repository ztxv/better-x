import type { ActionRowService } from '../runtime/action-row';
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
  /** Where the save control is mounted, and which post each one currently shows. */
  actionRow: ActionRowService;
  /** The one open chip or menu, if any. */
  overlay: Overlay | null;
  settings: Settings;
  /** Settles once the stored settings have been applied (the defaults hold until then). */
  settingsReady: Promise<void>;
  /**
   * Opens the library inside the page (the panel overlay) and returns true, or returns false when
   * the overlay is not in use and the worker should open the panel. Set by the content script.
   */
  openLibrary?: () => boolean;
}
