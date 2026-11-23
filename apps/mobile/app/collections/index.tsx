import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

type Row = { id: string; name: string; collection_posts: { count: number }[] };

/** The person's private collections of saved posts. */
export default function Collections() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(() => {
    if (!profile) return;
    supabase
      .from('collections')
      .select('id, name, collection_posts(count)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [profile]);
  useFocusEffect(load);

  async function remove(row: Row) {
    const go = async () => {
      await supabase.rpc('delete_collection', { p_collection_id: row.id });
      load();
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(`Delete "${row.name}"?`, 'The posts stay saved. Only the collection is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void go() },
    ]);
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          rows ? <Text style={{ color: colors.textMuted }}>Create collections from the "…" menu on any post, using "Save to collection".</Text> : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/collections/[id]', params: { id: item.id, name: item.name } })}
            onLongPress={() => void remove(item)}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.collection_posts[0]?.count ?? 0} posts · hold to delete</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
