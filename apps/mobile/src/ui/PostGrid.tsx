import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { type FeedPost, firstImage } from '../lib/posts';
import { SpoilerVeil } from './SpoilerVeil';
import { useTheme } from '../theme';

const columns = 3;
const gap = 8;
const edge = 16;

/** How tall a tile is relative to its width: follows the photo, kept within a pleasant range. */
function tileRatio(post: FeedPost): number {
  const image = firstImage(post);
  const ratio = image && image.ratio > 0 ? 1 / image.ratio : 1;
  return Math.min(1.4, Math.max(0.8, ratio));
}

/** Rounded tiles in three columns of varying height. Place it outside any horizontal padding. */
export function PostGrid({ posts }: { posts: FeedPost[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const size = width > 0 ? Math.floor((width - 2 * edge - gap * (columns - 1)) / columns) : 0;

  // Each post goes to the shortest column so the columns stay roughly level.
  const cols = useMemo(() => {
    const out: { posts: { post: FeedPost; ratio: number }[]; height: number }[] = Array.from({ length: columns }, () => ({ posts: [], height: 0 }));
    for (const post of posts) {
      const ratio = tileRatio(post);
      const target = out.reduce((a, b) => (b.height < a.height ? b : a));
      target.posts.push({ post, ratio });
      target.height += ratio;
    }
    return out;
  }, [posts]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', gap, width: '100%', paddingHorizontal: edge, paddingTop: 4 }}>
      {size > 0
        ? cols.map((col, c) => (
            <View key={c} style={{ width: size, gap }}>
              {col.posts.map(({ post, ratio }) => {
                const image = firstImage(post);
                const height = Math.round(size * ratio);
                return (
                  <Link key={post.id} href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={image?.alt ?? post.caption ?? 'Post'}
                      style={{ width: size, height, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface }}
                    >
                      {image ? <Image source={{ uri: image.url }} style={{ width: size, height }} contentFit="cover" /> : null}
                      {post.is_spoiler ? <SpoilerVeil compact /> : null}
                      {post.kind === 'video' ? (
                        <Ionicons name="play" size={16} color="#fff" style={{ position: 'absolute', top: 8, right: 8 }} />
                      ) : post.kind === 'carousel' ? (
                        <Ionicons name="copy" size={15} color="#fff" style={{ position: 'absolute', top: 8, right: 8 }} />
                      ) : null}
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ))
        : null}
    </View>
  );
}
