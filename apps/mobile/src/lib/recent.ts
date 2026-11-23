import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Recent searches stay on this device only, one list per account, never sent to the server.
const max = 12;
const keyFor = (userId: string) => `funkty.recent.${userId}`;

const store =
  Platform.OS === 'web'
    ? {
        get: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        set: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        del: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : {
        get: (k: string) => SecureStore.getItemAsync(k),
        set: (k: string, v: string) => SecureStore.setItemAsync(k, v),
        del: (k: string) => SecureStore.deleteItemAsync(k),
      };

export async function loadRecent(userId: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await store.get(keyFor(userId))) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, max) : [];
  } catch {
    return [];
  }
}

export async function addRecent(userId: string, term: string): Promise<string[]> {
  const value = term.trim();
  const current = await loadRecent(userId);
  if (value.length < 2) return current;
  const next = [value, ...current.filter((t) => t.toLowerCase() !== value.toLowerCase())].slice(0, max);
  try {
    await store.set(keyFor(userId), JSON.stringify(next));
  } catch {}
  return next;
}

export async function removeRecent(userId: string, term: string): Promise<string[]> {
  const next = (await loadRecent(userId)).filter((t) => t !== term);
  try {
    await store.set(keyFor(userId), JSON.stringify(next));
  } catch {}
  return next;
}

export async function clearRecent(userId: string): Promise<void> {
  try {
    await store.del(keyFor(userId));
  } catch {}
}
