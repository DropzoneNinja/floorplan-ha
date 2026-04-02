/**
 * Lightweight pub/sub bus for settings changes.
 * Lets the settings route notify all active SSE streams when a value is updated.
 */

type Listener = (key: string) => void;

const listeners = new Set<Listener>();

export const settingsBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  emit(key: string): void {
    for (const fn of listeners) fn(key);
  },
};
