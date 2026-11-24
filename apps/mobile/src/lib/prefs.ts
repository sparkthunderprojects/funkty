import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

/** A small value kept on this device (JSON), readable from anywhere and usable as a hook. */
export function createPref<T>(key: string, initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  void (async () => {
    try {
      const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
      if (raw) {
        value = { ...initial, ...JSON.parse(raw) } as T;
        notify();
      }
    } catch {
      /* keep the default */
    }
  })();

  const get = () => value;
  const set = (next: T) => {
    value = next;
    notify();
    try {
      const raw = JSON.stringify(next);
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, raw);
      else void SecureStore.setItemAsync(key, raw);
    } catch {
      /* the value still applies for this session */
    }
  };
  const use = () =>
    useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      get,
      get,
    );
  return { get, set, use };
}
