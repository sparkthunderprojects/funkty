import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from '@funkty/db';

// The URL and publishable key are public by design; access is enforced by Row Level Security.
// The service-role key must never appear in the app (see CLAUDE.md).
const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabasePublishableKey?: string }
  | undefined;

if (!extra?.supabaseUrl || !extra.supabasePublishableKey) {
  throw new Error('Supabase configuration is missing from app.json extra.');
}

// On iOS and Android, session tokens live in the device keychain / keystore, not in plain
// storage. The keychain does not exist on web (used for previews and tests), so it falls back
// to browser storage there.
const secureStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase = createClient<Database>(extra.supabaseUrl, extra.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
