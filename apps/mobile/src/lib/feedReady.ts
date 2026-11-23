import { useSyncExternalStore } from 'react';

let ready = false;
const listeners = new Set<() => void>();

/** Set once the first feed load has finished, so the logo screen can lift. */
export function markFeedReady(): void {
  if (ready) return;
  ready = true;
  listeners.forEach((l) => l());
}

export function useFeedReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready,
    () => ready,
  );
}
