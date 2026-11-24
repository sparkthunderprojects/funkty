import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';

type Person = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null };

/** Choose who sees your close friends stories. The list is private: nobody is told they are on it. */
export default function CloseFriends() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [people, setPeople] = useState<Person[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [follows, close] = await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', profile.id).eq('state', 'active').limit(500),
      supabase.from('close_friends').select('friend_id').eq('owner_id', profile.id),
    ]);
    const closeIds = (close.data ?? []).map((c) => c.friend_id);
    setChosen(new Set(closeIds));
    const ids = [...new Set([...(follows.data ?? []).map((f) => f.followee_id), ...closeIds])];
    if (ids.length === 0) return setPeople([]);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
      .in('id', ids)
      .order('username');
    setPeople((data ?? []) as unknown as Person[]);
  }, [profile]);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string) {
    tap();
    setError(null);
    const on = !chosen.has(id);
    setChosen((c) => {
      const n = new Set(c);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    const { error: e } = await supabase.rpc('set_close_friend', { p_friend: id, p_in: on });
    if (e) {
      setError(friendlyError(e.message));
      void load();
    }
  }

  const q = term.trim().toLowerCase();
  const shown = people.filter((p) => !q || p.username.includes(q) || (p.display_name ?? '').toLowerCase().includes(q));
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ margin: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput accessibilityLabel="Search people you follow" placeholder="Search" placeholderTextColor={colors.textMuted} value={term} onChangeText={setTerm} autoCapitalize="none" style={{ flex: 1, color: colors.text, paddingVertical: 12, fontSize: 16 }} />
      </View>
      <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: 8 }}>
        {chosen.size} close {chosen.size === 1 ? 'friend' : 'friends'}. Only they can see stories you share to close friends.
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, paddingHorizontal: spacing.lg }}>{error}</Text> : null}
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl }}>Follow people to add them here.</Text>}
        renderItem={({ item }) => {
          const on = chosen.has(item.id);
          return (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${item.username} close friend`} onPress={() => void toggle(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8, paddingHorizontal: spacing.lg }}>
              <Avatar username={item.username} storageKey={item.avatar?.storage_key} size={44} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>{item.username}</Text>
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>{item.display_name ?? ''}</Text>
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? '#22A559' : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Ionicons name="star" size={15} color="#fff" /> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
