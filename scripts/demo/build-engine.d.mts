/** Absolute path of the committed demo engine bundle. */
export const ENGINE_OUT: string;
/** The demo engine bundle as it would be built from the current source. */
export function bundleEngine(): Promise<string>;
