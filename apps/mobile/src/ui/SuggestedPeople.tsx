import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { loadMuted } from '../lib/mutes';
import { useSession } from '../lib/session';
import { tap } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';

type Person = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null };

/** "Suggested for you": newest accounts you don't follow yet, with a one-tap Follow. */
export function SuggestedPeople() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [state, setState] = useState<Record<string, 'active' | 'pending'>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    const [follows, blocks, muted, found] = await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', profile.id),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id),
      loadMuted(profile.id),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .neq('id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    const skip = new Set([
      ...(follows.data ?? []).map((f) => f.followee_id),
      ...(blocks.data ?? []).map((b) => b.blocked_id),
      ...muted,
    ]);
    setPeople(((found.data ?? []) as unknown as Person[]).filter((p) => !skip.has(p.id)).slice(0, 10));
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function follow(id: string) {
    tap();
    const { data, error } = await supabase.rpc('follow_user', { p_target: id });
    if (!error && (data === 'active' || data === 'pending')) setState((s) => ({ ...s, [id]: data }));
  }

  if (people.length === 0) return null;
  return (
    <View style={{ paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Suggested for you</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Find friends" onPress={() => router.push('/find-friends')} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Find friends</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        {people.map((p) => {
          const s = state[p.id];
          return (
            <View key={p.id} style={{ width: 150, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, gap: 6 }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`View ${p.username}`}
                onPress={() => router.push({ pathname: '/user/[username]', params: { username: p.username } })}
                style={{ alignItems: 'center', gap: 6 }}
              >
                <Avatar username={p.username} storageKey={p.avatar?.storage_key} size={64} />
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                  {p.username}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, minHeight: 15 }}>
                  {p.display_name ?? ''}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s ? (s === 'pending' ? `Requested ${p.username}` : `Following ${p.username}`) : `Follow ${p.username}`}
                disabled={!!s}
                onPress={() => void follow(p.id)}
                style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: s ? colors.surface : colors.primary }}
              >
                <Text style={{ color: s ? colors.text : colors.onPrimary, fontWeight: '600', fontSize: 14 }}>
                  {s === 'pending' ? 'Requested' : s === 'active' ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${p.username}`}
                onPress={() => setPeople((c) => c.filter((x) => x.id !== p.id))}
                hitSlop={8}
                style={{ position: 'absolute', top: 6, right: 6 }}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
