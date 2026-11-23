import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { PostGrid } from '../../src/ui/PostGrid';

/** All posts in one series, oldest first so it reads as a sequence. */
export default function SeriesPage() {
  const { colors, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('series')
      .select('title, profiles!series_author_id_fkey(username)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as { title: string; profiles: { username: string } | null } | null;
        setTitle(row?.title ?? '');
        setAuthor(row?.profiles?.username ?? '');
      });
    supabase
      .from('posts')
      .select(feedSelect)
      .eq('series_id', id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => setPosts((data ?? []) as unknown as FeedPost[]));
  }, [id]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', padding: spacing.lg, paddingBottom: 2 }}>{title}</Text>
        {author ? <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>A series by {author}</Text> : null}
        {posts && posts.length > 0 ? <PostGrid posts={posts} /> : posts ? <Text style={{ color: colors.textMuted, padding: spacing.lg }}>No posts in this series yet.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
