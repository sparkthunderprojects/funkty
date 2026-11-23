import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { type FeedPost, feedSelect, postVideo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { shareLink } from '../../src/lib/share';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Clip } from '../../src/ui/Clip';
import { RichText } from '../../src/ui/RichText';

function Reel({ post, height, active, near, muted, onToggleMute, liked: initialLiked, saved: initialSaved }: {
  post: FeedPost;
  height: number;
  active: boolean;
  near: boolean;
  muted: boolean;
  onToggleMute: () => void;
  liked: boolean;
  saved: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const video = postVideo(post);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likes, setLikes] = useState(post.post_stats?.like_count ?? 0);
  const username = post.profiles?.username ?? 'unknown';

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    const { error } = await supabase.rpc(next ? 'like_post' : 'unlike_post', { p_post_id: post.id });
    if (error) {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    }
  }
  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    const { error } = await supabase.rpc(next ? 'save_post' : 'unsave_post', { p_post_id: post.id });
    if (error) setSaved(!next);
  }

  if (!video) return <View style={{ height }} />;
  const rail = { alignItems: 'center', gap: 3 } as const;
  const count = { color: '#fff', fontSize: 12, fontWeight: '600' } as const;
  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {near ? (
        <Clip
          uri={video.url}
          poster={video.poster}
          active={active}
          muted={muted}
          onDoubleTap={() => {
            if (!liked) void toggleLike();
          }}
          style={{ width: '100%', height }}
        />
      ) : video.poster ? (
        <Image source={{ uri: video.poster }} contentFit="cover" style={{ width: '100%', height }} />
      ) : null}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 12, bottom: 28, gap: 22, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} onPress={toggleLike} style={rail}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? colors.danger : '#fff'} />
          <Text style={count}>{likes}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="Comments" onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} style={rail}>
          <Ionicons name="chatbubble-outline" size={29} color="#fff" />
          <Text style={count}>{post.post_stats?.comment_count ?? 0}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={() => void shareLink(`${username} on Funkty`, `/post/${post.id}`)} style={rail}>
          <Ionicons name="paper-plane-outline" size={27} color="#fff" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save'} onPress={toggleSave} style={rail}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color="#fff" />
        </Pressable>
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 80, bottom: 28, gap: 8 }}>
        <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar username={username} storageKey={post.profiles?.avatar?.storage_key} size={34} />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{username}</Text>
          </Pressable>
        </Link>
        {post.caption ? <RichText text={post.caption} style={{ color: '#fff', fontSize: 14 }} /> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        onPress={onToggleMute}
        hitSlop={8}
        style={{ position: 'absolute', right: 14, top: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 8 }}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

/** Full-screen vertical video feed. Newest first until the ranking service exists. */
export default function Reels() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // Browsers only allow sound after a tap, so the feed starts muted on the web.
  const [muted, setMuted] = useState(Platform.OS === 'web');
  const viewable = useRef(({ viewableItems }: { viewableItems: { item: unknown; isViewable: boolean }[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first) setActiveId((first.item as FeedPost).id);
  });
  const config = useRef({ itemVisiblePercentThreshold: 80 });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (!profile) return () => setFocused(false);
      void (async () => {
        const { data } = await supabase.from('posts').select(feedSelect).eq('kind', 'video').order('id', { ascending: false }).limit(30);
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
          setActiveId((current) => current ?? rows[0]!.id);
        }
        setLoading(false);
      })();
      return () => setFocused(false);
    }, [profile]),
  );

  const activeIndex = posts.findIndex((p) => p.id === activeId);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 80 }} />
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
          <Ionicons name="film-outline" size={48} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>No reels yet</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Videos people share appear here. Tap + to post the first one.</Text>
        </View>
      ) : height > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={viewable.current}
          viewabilityConfig={config.current}
          windowSize={3}
          renderItem={({ item, index }) => (
            <Reel
              post={item}
              height={height}
              active={focused && item.id === activeId}
              near={Math.abs(index - activeIndex) <= 1}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              liked={liked.has(item.id)}
              saved={saved.has(item.id)}
            />
          )}
        />
      ) : null}
      <Text pointerEvents="none" style={{ position: 'absolute', top: 14, left: 16, color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>
        Reels
      </Text>
    </View>
  );
}
