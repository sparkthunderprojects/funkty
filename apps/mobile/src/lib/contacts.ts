import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const contactsSupported = Platform.OS !== 'web';

/** SHA-256 of a lowercased, trimmed email. The server hashes account emails the same way. */
async function hashEmail(email: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email.trim().toLowerCase());
}

export type ContactMatch = { ok: true; ids: string[]; checked: number } | { ok: false; reason: 'denied' | 'unsupported' | 'rate_limited' | 'error' };

/**
 * Looks for people in the phone's contacts who chose to be found by email. Only hashes leave the phone;
 * names, numbers and addresses stay on it and nothing is stored.
 */
export async function findContacts(): Promise<ContactMatch> {
  if (!contactsSupported) return { ok: false, reason: 'unsupported' };
  const perm = await Contacts.requestPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails], pageSize: 5000 });
  const emails = new Set<string>();
  for (const c of data) for (const e of c.emails ?? []) if (e.email) emails.add(e.email.trim().toLowerCase());
  const hashes = await Promise.all([...emails].map(hashEmail));
  const ids = new Set<string>();
  for (let i = 0; i < hashes.length; i += 1000) {
    const { data: rows, error } = await supabase.rpc('match_contacts', { p_hashes: hashes.slice(i, i + 1000) });
    if (error) return { ok: false, reason: error.message === 'rate_limited' ? 'rate_limited' : 'error' };
    for (const r of rows ?? []) ids.add(r.user_id);
  }
  return { ok: true, ids: [...ids], checked: emails.size };
}
