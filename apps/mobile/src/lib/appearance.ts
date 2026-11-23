import * as SecureStore from 'expo-secure-store';
import { Appearance, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export type AppearancePref = 'system' | 'light' | 'dark';

const key = 'funkty.appearance';
let pref: AppearancePref = 'system';
const listeners = new Set<() => void>();

function apply() {
  try {
    // Also tells the native side (keyboard, alerts, status bar) which scheme to use.
    Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);
  } catch {
    /* not supported on this platform */
  }
  listeners.forEach((l) => l());
}

async function read(): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(value: AppearancePref): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* the choice still applies for this session */
  }
}

void read().then((v) => {
  if (v === 'light' || v === 'dark' || v === 'system') {
    pref = v;
    apply();
  }
});

export function setAppearance(next: AppearancePref): void {
  pref = next;
  apply();
  void write(next);
}

export function useAppearance(): AppearancePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pref,
    () => pref,
  );
}
