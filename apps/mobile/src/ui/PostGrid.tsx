import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { type FeedPost, firstImage } from '../lib/posts';
import { SpoilerVeil } from './SpoilerVeil';
import { useTheme } from '../theme';

const columns = 3;
const gap = 1;

/** Edge-to-edge, three equal square columns with hairline gaps. Place it outside any horizontal padding. */
export function PostGrid({ posts }: { posts: FeedPost[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const size = width > 0 ? Math.floor((width - gap * (columns - 1)) / columns) : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap, width: '100%' }}
    >
      {size > 0
        ? posts.map((post) => {
            const image = firstImage(post);
            return (
              <Link key={post.id} href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={image?.alt ?? post.caption ?? 'Post'}
                  style={{ width: size, height: size, backgroundColor: colors.surface }}
                >
                  {image ? (
                    <Image source={{ uri: image.url }} style={{ width: size, height: size }} contentFit="cover" />
                  ) : null}
                  {post.is_spoiler ? <SpoilerVeil compact /> : null}
                  {post.kind === 'video' ? (
                    <Ionicons name="play" size={18} color="#fff" style={{ position: 'absolute', top: 6, right: 6 }} />
                  ) : post.kind === 'carousel' ? (
                    <Ionicons name="copy" size={16} color="#fff" style={{ position: 'absolute', top: 6, right: 6 }} />
                  ) : null}
                </Pressable>
              </Link>
            );
          })
        : null}
    </View>
  );
}
