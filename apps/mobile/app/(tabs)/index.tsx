import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { PostCard } from '../../src/ui/PostCard';

type Mode = 'everyone' | 'following';

/** Keyset-ordered reverse-chronological feed. Ranking arrives with the feed service (later phase). */
export default function Home() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const [mode, setMode] = useState<Mode>('everyone');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setFailed(false);
    let query = supabase.from('posts').select(feedSelect).order('id', { ascending: false }).limit(30);
    if (mode === 'following') {
      const follows = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', profile.id)
        .eq('state', 'active');
      query = query.in('author_id', [profile.id, ...(follows.data ?? []).map((f) => f.followee_id)]);
    }
    const { data, error } = await query;
    if (error) {
      setFailed(true);
    } else {
      const rows = (data ?? []) as unknown as FeedPost[];
      setPosts(rows);
      if (rows.length > 0) {
        const likes = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', profile.id)
          .in('post_id', rows.map((r) => r.id));
        setLiked(new Set((likes.data ?? []).map((l) => l.post_id)));
      }
    }
    setLoading(false);
  }, [mode, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
        <Text style={{ color: colors.primary, fontSize: fontSize.headline, fontWeight: '800', letterSpacing: -1 }}>
          funkty
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {(['everyone', 'following'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => {
                setLoading(true);
                setMode(m);
              }}
            >
              <Text
                style={{
                  color: mode === m ? colors.text : colors.textMuted,
                  fontWeight: '700',
                  fontSize: fontSize.body,
                  textDecorationLine: mode === m ? 'underline' : 'none',
                }}
              >
                {m === 'everyone' ? 'Everyone' : 'Following'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
        contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body, margin: spacing.lg }}>
              {failed
                ? 'Could not load the feed. Pull down to try again.'
                : mode === 'following'
                  ? 'Nothing here yet. Follow people from Search to fill your feed.'
                  : 'No posts yet. Tap Create to share the first one.'}
            </Text>
          )
        }
        renderItem={({ item }) => <PostCard post={item} liked={liked.has(item.id)} />}
      />
    </SafeAreaView>
  );
}
