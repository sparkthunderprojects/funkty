import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { loadMuted } from '../../src/lib/mutes';
import { supabase } from '../../src/lib/supabase';
import { useTabBarSpace } from '../../src/ui/layout';
import { useTheme } from '../../src/theme';
import { Wordmark } from '../../src/ui/Logo';
import { PostCard } from '../../src/ui/PostCard';
import { SuggestedPeople } from '../../src/ui/SuggestedPeople';
import { StoriesTray } from '../../src/ui/StoriesTray';

type Mode = 'everyone' | 'following';

/** Keyset-ordered reverse-chronological feed. Ranking arrives with the feed service (later phase). */
export default function Home() {
  const { colors, fontSize, spacing } = useTheme();
  const tabSpace = useTabBarSpace();
  const { profile } = useSession();
  const router = useRouter();
  const [unreadActivity, setUnreadActivity] = useState(0);
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
      const muted = await loadMuted(profile.id);
      const rows = ((data ?? []) as unknown as FeedPost[]).filter((r) => !muted.has(r.author_id));
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
    const unread = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .is('read_at', null);
    setUnreadActivity(unread.count ?? 0);
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
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Wordmark height={26} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 3 }}>
            {(['everyone', 'following'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityLabel={m === 'everyone' ? 'For You' : 'Following'}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setLoading(true);
                    setMode(m);
                  }}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: on ? colors.card : 'transparent',
                    shadowColor: '#000',
                    shadowOpacity: on ? 0.08 : 0,
                    shadowRadius: 5,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: on ? 2 : 0,
                  }}
                >
                  <Text style={{ color: on ? colors.text : colors.textMuted, fontWeight: on ? '700' : '600', fontSize: 13 }}>
                    {m === 'everyone' ? 'For You' : 'Following'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={unreadActivity > 0 ? `Activity, ${unreadActivity} unread` : 'Activity'}
          onPress={() => router.push('/activity')}
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={25} color={colors.text} />
          {unreadActivity > 0 ? (
            <View style={{ position: 'absolute', top: 0, right: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={unreadDms > 0 ? `Messages, ${unreadDms} unread` : 'Messages'}
          onPress={() => router.push('/messages')}
          hitSlop={10}
        >
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          {unreadDms > 0 ? (
            <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unreadDms}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <FlatList
        data={posts}
        ListHeaderComponent={
          <>
            <StoriesTray />
            <SuggestedPeople />
          </>
        }
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: tabSpace, flexGrow: 1 }}
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
