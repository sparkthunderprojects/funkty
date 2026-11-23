import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Screen } from '../../src/ui/Screen';

type FeedPost = {
  id: string;
  caption: string | null;
  created_at: string;
  profiles: { username: string } | null;
  post_stats: { like_count: number; comment_count: number } | null;
};

/** Keyset-paginated reverse-chronological feed. Ranking arrives with the feed service (later phase). */
export default function Home() {
  const { colors, fontSize, spacing, radius } = useTheme();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const { data, error } = await supabase
      .from('posts')
      .select('id, caption, created_at, profiles(username), post_stats(like_count, comment_count)')
      .order('id', { ascending: false })
      .limit(30);
    if (error) setFailed(true);
    else setPosts((data ?? []) as unknown as FeedPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <Text style={{ color: colors.primary, fontSize: fontSize.headline, fontWeight: '800', letterSpacing: -1 }}>
        funkty
      </Text>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body, marginTop: spacing.xl }}>
              {failed ? 'Could not load the feed. Pull down to try again.' : 'No posts yet.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>@{item.profiles?.username ?? 'unknown'}</Text>
            {item.caption ? <Text style={{ color: colors.text, fontSize: fontSize.body }}>{item.caption}</Text> : null}
            <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
              {item.post_stats?.like_count ?? 0} likes · {item.post_stats?.comment_count ?? 0} comments
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}
