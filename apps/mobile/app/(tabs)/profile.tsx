import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { PostGrid } from '../../src/ui/PostGrid';
import { Screen } from '../../src/ui/Screen';

type Stats = { posts: number; followers: number; following: number };

export default function Profile() {
  const { profile, signOut } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      supabase
        .from('profile_stats')
        .select('posts_count, followers_count, following_count')
        .eq('user_id', profile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setStats({ posts: data.posts_count, followers: data.followers_count, following: data.following_count });
        });
      supabase
        .from('posts')
        .select(feedSelect)
        .eq('author_id', profile.id)
        .order('id', { ascending: false })
        .limit(60)
        .then(({ data }) => setPosts((data ?? []) as unknown as FeedPost[]));
    }, [profile]),
  );

  if (!profile) return null;
  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        {profile.display_name || profile.username}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{profile.username}</Text>
      {profile.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body }}>{profile.bio}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.md }}>
        {([['Posts', stats?.posts], ['Followers', stats?.followers], ['Following', stats?.following]] as const).map(
          ([label, value]) => (
            <View key={label}>
              <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value ?? 0}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{label}</Text>
            </View>
          ),
        )}
      </View>
      {posts.length > 0 ? (
        <PostGrid posts={posts} />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          No posts yet. Tap Create to share your first photo.
        </Text>
      )}
      <Button label="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
