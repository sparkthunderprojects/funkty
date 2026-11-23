import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Logo } from '../../src/ui/Logo';
import { PostCard } from '../../src/ui/PostCard';
import { StoriesTray } from '../../src/ui/StoriesTray';

type Mode = 'everyone' | 'following';

/** Keyset-ordered reverse-chronological feed. Ranking arrives with the feed service (later phase). */
export default function Home() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [unreadDms, setUnreadDms] = useState(0);
  const [mode, setMode] = useState<Mode>('everyone');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
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
        const ids = rows.map((r) => r.id);
        const [likes, saves] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', profile.id).in('post_id', ids),
          supabase.from('saves').select('post_id').eq('user_id', profile.id).in('post_id', ids),
        ]);
        setLiked(new Set((likes.data ?? []).map((l) => l.post_id)));
        setSaved(new Set((saves.data ?? []).map((l) => l.post_id)));
      }
    }
    const inbox = await supabase.rpc('inbox');
    setUnreadDms((inbox.data ?? []).reduce((n, c) => n + Number(c.unread), 0));
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo height={34} />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={unreadDms > 0 ? `Messages, ${unreadDms} unread` : 'Messages'}
            onPress={() => router.push('/messages')}
            hitSlop={10}
          >
            <Text style={{ color: colors.text, fontSize: 28 }}>✉</Text>
            {unreadDms > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unreadDms}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
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
        ListHeaderComponent={<StoriesTray />}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
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
        renderItem={({ item }) => <PostCard post={item} liked={liked.has(item.id)} saved={saved.has(item.id)} />}
      />
    </SafeAreaView>
  );
}
