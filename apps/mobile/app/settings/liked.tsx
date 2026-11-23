import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { PostGrid } from '../../src/ui/PostGrid';

export default function LikedPosts() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('likes')
      .select(`created_at, posts(${feedSelect})`)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) =>
        setPosts(((data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : []))),
      );
  }, [profile]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        {posts && posts.length > 0 ? (
          <PostGrid posts={posts} />
        ) : posts ? (
          <Text style={{ color: colors.textMuted, padding: spacing.lg }}>Posts you like appear here, only visible to you.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
