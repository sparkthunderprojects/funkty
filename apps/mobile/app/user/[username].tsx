import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { PostGrid } from '../../src/ui/PostGrid';
import { Screen } from '../../src/ui/Screen';

type Person = { id: string; username: string; display_name: string | null; bio: string | null; is_private: boolean };
type Follow = 'none' | 'pending' | 'active';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const [person, setPerson] = useState<Person | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [follow, setFollow] = useState<Follow>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!me || !username) return;
    const { data: p } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, is_private')
      .eq('username', String(username).toLowerCase())
      .maybeSingle();
    setPerson(p);
    if (p) {
      const [s, f, ps] = await Promise.all([
        supabase.from('profile_stats').select('posts_count, followers_count, following_count').eq('user_id', p.id).maybeSingle(),
        supabase.from('follows').select('state').eq('follower_id', me.id).eq('followee_id', p.id).maybeSingle(),
        supabase.from('posts').select(feedSelect).eq('author_id', p.id).order('id', { ascending: false }).limit(60),
      ]);
      if (s.data) setStats({ posts: s.data.posts_count, followers: s.data.followers_count, following: s.data.following_count });
      setFollow((f.data?.state as Follow | undefined) ?? 'none');
      setPosts((ps.data ?? []) as unknown as FeedPost[]);
    }
    setLoading(false);
  }, [me, username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!person) return;
    setBusy(true);
    await supabase.rpc(follow === 'none' ? 'follow_user' : 'unfollow_user', { p_target: person.id });
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!person) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>This account does not exist.</Text>
      </Screen>
    );
  }

  const isMe = person.id === me?.id;
  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        {person.display_name || person.username}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{person.username}</Text>
      {person.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body }}>{person.bio}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {([['Posts', stats.posts], ['Followers', stats.followers], ['Following', stats.following]] as const).map(
          ([label, value]) => (
            <View key={label}>
              <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{label}</Text>
            </View>
          ),
        )}
      </View>
      {!isMe ? (
        <Button
          label={follow === 'active' ? 'Following' : follow === 'pending' ? 'Requested' : 'Follow'}
          variant={follow === 'none' ? 'primary' : 'secondary'}
          onPress={toggleFollow}
          loading={busy}
        />
      ) : null}
      {posts.length > 0 ? (
        <PostGrid posts={posts} />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          {person.is_private && follow !== 'active' && !isMe ? 'This account is private.' : 'No posts yet.'}
        </Text>
      )}
    </Screen>
  );
}
