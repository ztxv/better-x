interface SaveFileWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    name: string;
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/**
 * Saves a JSON file. Where the browser can, it opens a Save As window with `suggestedName` filled
 * in, so the person can rename it and choose the folder; otherwise it downloads under that name.
 * Returns the name it was saved under, or null when the person cancelled.
 */
export async function saveJsonFile(
  suggestedName: string,
  data: unknown,
  description = 'Better X file',
): Promise<string | null> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const picker = (globalThis as SaveFileWindow).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker.call(globalThis, {
        suggestedName,
        types: [{ description, accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    } catch (problem) {
      if (problem instanceof DOMException && problem.name === 'AbortError') return null;
      // Any other failure (no permission, no picker in this window): download it instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return suggestedName;
}
