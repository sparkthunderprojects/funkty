import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

type Row = { id: string; name: string; user_id: string; owner: { username: string } | null; collection_posts: { count: number }[]; collection_members: { count: number }[] };

/** Collections of saved posts: the person's own, ones shared with them, and invitations. */
export default function Collections() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [invites, setInvites] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!profile) return;
    void Promise.all([
      supabase
        .from('collections')
        .select('id, name, user_id, owner:profiles!collections_user_id_fkey(username), collection_posts(count), collection_members(count)')
        .order('created_at', { ascending: false }),
      supabase.from('collection_members').select('collection_id').eq('user_id', profile.id).eq('status', 'invited'),
    ]).then(([c, inv]) => {
      setRows((c.data ?? []) as unknown as Row[]);
      setInvites(new Set((inv.data ?? []).map((r) => r.collection_id)));
    });
  }, [profile]);
  useFocusEffect(load);

  async function remove(row: Row) {
    const go = async () => {
      await supabase.rpc('delete_collection', { p_collection_id: row.id });
      load();
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(`Delete "${row.name}"?`, 'The posts stay saved. Only the collection is removed, for everyone in it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void go() },
    ]);
  }
  async function respond(row: Row, accept: boolean) {
    tap();
    await supabase.rpc('respond_collection_invite', { p_collection_id: row.id, p_accept: accept });
    load();
  }

  const mine = (r: Row) => r.user_id === profile?.id;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={[...(rows ?? [])].sort((a, b) => Number(invites.has(b.id)) - Number(invites.has(a.id)))}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          rows ? <Text style={{ color: colors.textMuted }}>Create collections from the "…" menu on any post, using "Save to collection". Open one to invite friends to add posts too.</Text> : undefined
        }
        renderItem={({ item }) => {
          const invited = invites.has(item.id);
          const members = item.collection_members[0]?.count ?? 0;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={invited}
              onPress={() => router.push({ pathname: '/collections/[id]', params: { id: item.id, name: item.name } })}
              onLongPress={mine(item) ? () => void remove(item) : undefined}
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 8 }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {invited
                  ? `${item.owner?.username ?? 'Someone'} invited you to this shared collection`
                  : `${item.collection_posts[0]?.count ?? 0} posts${members > 0 ? ` · shared with ${members}` : ''}${mine(item) ? ' · hold to delete' : ` · by ${item.owner?.username ?? 'someone'}`}`}
              </Text>
              {invited ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable accessibilityRole="button" onPress={() => void respond(item, true)} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 18 }}>
                    <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Join</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void respond(item, false)} style={{ backgroundColor: colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 18 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
