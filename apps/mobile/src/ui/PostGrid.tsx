import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { type FeedPost, firstImage } from '../lib/posts';
import { useTheme } from '../theme';

/** Three-column square thumbnail grid. Uses flex wrap so it adapts to any width. */
export function PostGrid({ posts }: { posts: FeedPost[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {posts.map((post) => {
        const image = firstImage(post);
        return (
          <Link key={post.id} href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={image?.alt ?? post.caption ?? 'Post'}
              style={{ width: '33%', flexGrow: 1, aspectRatio: 1, backgroundColor: colors.surface }}
            >
              {image ? (
                <Image source={{ uri: image.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : null}
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
