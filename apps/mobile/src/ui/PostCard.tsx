import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, postImages, timeAgo } from '../lib/posts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';
import { Carousel } from './Carousel';
import { RichText } from './RichText';

type Props = { post: FeedPost; liked: boolean; saved: boolean };

export function PostCard({ post, liked: initiallyLiked, saved: initiallySaved }: Props) {
  const { colors, fontSize, spacing } = useTheme();
  const [liked, setLiked] = useState(initiallyLiked);
  const [saved, setSaved] = useState(initiallySaved);
  const [likes, setLikes] = useState(post.post_stats?.like_count ?? 0);
  const images = postImages(post);
  const username = post.profiles?.username ?? 'unknown';
  const comments = post.post_stats?.comment_count ?? 0;

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
    <View style={{ gap: spacing.sm }}>
      <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
        <Pressable
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md }}
        >
          <Avatar username={username} storageKey={post.profiles?.avatar?.storage_key} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>{username}</Text>
        </Pressable>
      </Link>
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
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? colors.danger : colors.text} />
        </Pressable>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Comments" hitSlop={8}>
            <Ionicons name="chatbubble-outline" size={25} color={colors.text} />
          </Pressable>
        </Link>
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
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>
          {likes} {likes === 1 ? 'like' : 'likes'}
        </Text>
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
        <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{timeAgo(post.created_at)} ago</Text>
      </View>
    </View>
  );
}
