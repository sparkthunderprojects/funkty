import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, firstImage } from '../lib/posts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';

type Props = { post: FeedPost; liked: boolean };

export function PostCard({ post, liked: initiallyLiked }: Props) {
  const { colors, fontSize, spacing } = useTheme();
  const [liked, setLiked] = useState(initiallyLiked);
  const [likes, setLikes] = useState(post.post_stats?.like_count ?? 0);
  const image = firstImage(post);
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

  return (
    <View style={{ gap: spacing.sm }}>
      <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
        <Pressable accessibilityRole="link" style={{ paddingHorizontal: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>@{username}</Text>
        </Pressable>
      </Link>
      {image ? (
        <Image
          source={{ uri: image.url }}
          accessibilityLabel={image.alt ?? `Photo by ${username}`}
          style={{ width: '100%', aspectRatio: image.ratio, backgroundColor: colors.surface }}
          contentFit="cover"
          transition={150}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          onPress={toggleLike}
          hitSlop={8}
        >
          <Text style={{ color: liked ? colors.primary : colors.text, fontWeight: '700', fontSize: fontSize.body }}>
            {liked ? '♥' : '♡'} {likes}
          </Text>
        </Pressable>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Comments" hitSlop={8}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>
              💬 {post.post_stats?.comment_count ?? 0}
            </Text>
          </Pressable>
        </Link>
      </View>
      {post.caption ? (
        <Text style={{ color: colors.text, fontSize: fontSize.body, paddingHorizontal: spacing.md }}>
          <Text style={{ fontWeight: '700' }}>@{username} </Text>
          {post.caption}
        </Text>
      ) : null}
    </View>
  );
}
