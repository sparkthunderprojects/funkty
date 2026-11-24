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
import { markFeedReady } from '../../src/lib/feedReady';
import { StoriesTray } from '../../src/ui/StoriesTray';

type Mode = 'everyone' | 'following' | 'friends';
type Item = { key: string; post: FeedPost; repostBy?: { username: string; note: string | null }; at: string };
type RepostRow = { user_id: string; note: string | null; created_at: string; reposter: { username: string } | null; post: FeedPost | null };

/** Keyset-ordered reverse-chronological feed. Ranking arrives with the feed service (later phase). */
export default function Home() {
  const { colors, fontSize, spacing } = useTheme();
  const tabSpace = useTabBarSpace();
  const { profile } = useSession();
  const router = useRouter();
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [unreadDms, setUnreadDms] = useState(0);
  const [mode, setMode] = useState<Mode>('everyone');
  const [posts, setPosts] = useState<Item[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setFailed(false);
    let query = supabase.from('posts').select(feedSelect).is('archived_at', null).order('id', { ascending: false }).limit(30);
    let circle: string[] | null = null;
    if (mode !== 'everyone') {
      const [following, followers] = await Promise.all([
        supabase.from('follows').select('followee_id').eq('follower_id', profile.id).eq('state', 'active'),
        mode === 'friends'
          ? supabase.from('follows').select('follower_id').eq('followee_id', profile.id).eq('state', 'active')
          : Promise.resolve({ data: [] as { follower_id: string }[] }),
      ]);
      let ids = (following.data ?? []).map((f) => f.followee_id);
      if (mode === 'friends') {
        const back = new Set((followers.data ?? []).map((f) => f.follower_id));
        ids = ids.filter((id) => back.has(id));
      }
      circle = ids;
      query = query.in('author_id', [profile.id, ...ids]);
    }
    const { data, error } = await query;
    if (error) {
      setFailed(true);
    } else {
      const [muted, hidden, topics, reposted] = await Promise.all([
        loadMuted(profile.id),
        supabase.from('feed_not_interested').select('post_id').eq('user_id', profile.id),
        supabase.from('muted_topics').select('tag').eq('user_id', profile.id),
        circle && circle.length > 0
          ? supabase
              .from('reposts')
              .select(`user_id, note, created_at, reposter:profiles!reposts_user_id_fkey(username), post:posts!reposts_post_id_fkey(${feedSelect})`)
              .in('user_id', circle)
              .order('created_at', { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] }),
      ]);
      const skipPosts = new Set((hidden.data ?? []).map((h) => h.post_id));
      const tags = (topics.data ?? []).map((t) => t.tag);
      const topicHidden = (p: FeedPost) => tags.some((t) => (p.caption ?? '').toLowerCase().split(/[^\p{L}\p{N}_#]+/u).includes(`#${t}`));
      const ok = (p: FeedPost) => !muted.has(p.author_id) && !skipPosts.has(p.id) && p.archived_at === null && !topicHidden(p);
      const own: Item[] = ((data ?? []) as unknown as FeedPost[]).filter(ok).map((p) => ({ key: p.id, post: p, at: p.created_at }));
      const seen = new Set(own.map((i) => i.post.id));
      const shared: Item[] = [];
      for (const r of (reposted.data ?? []) as unknown as RepostRow[]) {
        if (!r.post || !r.reposter || seen.has(r.post.id) || !ok(r.post)) continue;
        seen.add(r.post.id);
        shared.push({ key: `r-${r.user_id}-${r.post.id}`, post: r.post, repostBy: { username: r.reposter.username, note: r.note }, at: r.created_at });
      }
      const rows = [...own, ...shared].sort((a, b) => b.at.localeCompare(a.at));
      setPosts(rows);
      if (rows.length > 0) {
        const ids = rows.map((r) => r.post.id);
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
    markFeedReady();
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
            {(['everyone', 'following', 'friends'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityLabel={m === 'everyone' ? 'For You' : m === 'following' ? 'Following' : 'Friends'}
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
                    {m === 'everyone' ? 'For You' : m === 'following' ? 'Following' : 'Friends'}
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
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unreadDms > 9 ? '9+' : unreadDms}</Text>
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
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: tabSpace, flexGrow: 1 }}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body, margin: spacing.lg }}>
              {failed
                ? 'Could not load the feed. Pull down to try again.'
                : mode === 'friends'
                  ? 'Friends are people you follow who follow you back. Nothing here yet.'
                : mode === 'following'
                  ? 'Nothing here yet. Follow people from Search to fill your feed.'
                  : 'No posts yet. Tap Create to share the first one.'}
            </Text>
          )
        }
        renderItem={({ item }) => <PostCard post={item.post} repostBy={item.repostBy} liked={liked.has(item.post.id)} saved={saved.has(item.post.id)} />}
      />
    </SafeAreaView>
  );
}
