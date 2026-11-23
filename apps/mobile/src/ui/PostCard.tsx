import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, postImages, timeAgo } from '../lib/posts';
import { shareLink } from '../lib/share';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';
import { Carousel } from './Carousel';
import { RichText } from './RichText';

/** 1200 -> 1.2K, so counts stay short next to the icons. */
function compact(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n);
}

type Props = { post: FeedPost; liked: boolean; saved: boolean };

export function PostCard({ post, liked: initiallyLiked, saved: initiallySaved }: Props) {
  const { colors, fontSize, spacing } = useTheme();
  const [liked, setLiked] = useState(initiallyLiked);
  const [saved, setSaved] = useState(initiallySaved);
  const [likes, setLikes] = useState(post.post_stats?.like_count ?? 0);
  const images = postImages(post);
  const username = post.profiles?.username ?? 'unknown';
  const comments = post.post_stats?.comment_count ?? 0;

  const countStyle = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const;
  const countText = { color: colors.text, fontSize: 14, fontWeight: '600' } as const;

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

  return (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }}>
        <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Avatar username={username} storageKey={post.profiles?.avatar?.storage_key} size={32} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{username}</Text>
          </Pressable>
        </Link>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        </Link>
      </View>
      {images.length > 0 ? (
        <Carousel
          images={images}
          label={`Photo by ${username}`}
          onDoubleTap={() => {
            if (!liked) void toggleLike();
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          onPress={toggleLike}
          hitSlop={8}
          style={countStyle}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? colors.danger : colors.text} />
          <Text style={countText}>{compact(likes)}</Text>
        </Pressable>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Comments" hitSlop={8} style={countStyle}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            <Text style={countText}>{compact(comments)}</Text>
          </Pressable>
        </Link>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share"
          onPress={() => void shareLink(`${username} on Funkty`, `/post/${post.id}`)}
          hitSlop={8}
        >
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          accessibilityState={{ selected: saved }}
          onPress={toggleSave}
          hitSlop={8}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={26} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.md, gap: 2 }}>
        {post.caption ? (
          <RichText lead={username} text={post.caption} style={{ color: colors.text, fontSize: fontSize.body }} />
        ) : null}
        {comments > 0 ? (
          <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              View all {comments} {comments === 1 ? 'comment' : 'comments'}
            </Text>
          </Link>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' }}>{timeAgo(post.created_at)} ago</Text>
      </View>
    </View>
  );
}
