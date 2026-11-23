import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { PostGrid } from '../../src/ui/PostGrid';

export default function CollectionPage() {
  const { colors, spacing } = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('collection_posts')
      .select(`added_at, posts(${feedSelect})`)
      .eq('collection_id', id)
      .order('added_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setPosts(((data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : []))));
  }, [id]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        {name ? <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', padding: spacing.lg }}>{name}</Text> : null}
        {posts && posts.length > 0 ? <PostGrid posts={posts} /> : posts ? <Text style={{ color: colors.textMuted, padding: spacing.lg }}>Nothing in this collection yet.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
