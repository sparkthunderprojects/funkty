import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { PostGrid } from '../../src/ui/PostGrid';
import { Screen } from '../../src/ui/Screen';

export default function Tag() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { colors, fontSize } = useTheme();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only letters, numbers and underscore can appear in a hashtag, so nothing needs escaping.
    const clean = String(tag).toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');
    supabase
      .from('posts')
      .select(feedSelect)
      .ilike('caption', `%#${clean}%`)
      .order('id', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setPosts((data ?? []) as unknown as FeedPost[]);
        setLoading(false);
      });
  }, [tag]);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>#{tag}</Text>
      {posts.length > 0 ? (
        <PostGrid posts={posts} />
      ) : (
        !loading && <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No posts with this hashtag yet.</Text>
      )}
    </Screen>
  );
}
