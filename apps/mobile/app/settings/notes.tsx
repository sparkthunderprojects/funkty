import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

type Row = { post_id: string; note: string; created_at: string; posts: { caption: string | null; profiles: { username: string } | null } | null };

/** Every saved post the person has written a private note on. */
export default function Notes() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('saves')
      .select('post_id, note, created_at, posts(caption, profiles!posts_author_id_fkey(username))')
      .eq('user_id', profile.id)
      .not('note', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [profile]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.post_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          rows ? <Text style={{ color: colors.textMuted }}>Add a private note from the "…" menu on any post. Only you can see them.</Text> : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post_id } })}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 4 }}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>{item.note}</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.posts?.profiles?.username ?? 'unknown'}
              {item.posts?.caption ? ` · ${item.posts.caption}` : ''} · saved {timeAgo(item.created_at)}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
