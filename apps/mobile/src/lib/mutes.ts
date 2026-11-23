import { supabase } from './supabase';

/** Accounts the signed-in user has muted. Their posts are hidden from the feed and Reels. */
export async function loadMuted(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('mutes').select('muted_id').eq('muter_id', userId);
  return new Set((data ?? []).map((m) => m.muted_id));
}
