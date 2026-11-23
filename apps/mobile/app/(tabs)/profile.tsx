import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Button } from '../../src/ui/Button';
import { PostGrid } from '../../src/ui/PostGrid';
import { Screen } from '../../src/ui/Screen';

type Stats = { posts: number; followers: number; following: number };
type Tab = 'posts' | 'saved';

export default function Profile() {
  const { profile, signOut } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [saved, setSaved] = useState<FeedPost[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('posts');

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
      supabase
        .from('saves')
        .select(`created_at, posts(${feedSelect})`)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(60)
        .then(({ data }) =>
          setSaved(
            ((data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : [])),
          ),
        );
      supabase
        .from('profiles')
        .select('avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .eq('id', profile.id)
        .maybeSingle()
        .then(({ data }) =>
          setAvatar((data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key ?? null),
        );
    }, [profile]),
  );

  if (!profile) return null;
  const shown = tab === 'posts' ? posts : saved;
  const counts: [string, number | undefined, (() => void) | undefined][] = [
    ['Posts', stats?.posts, undefined],
    ['Followers', stats?.followers, () => router.push({ pathname: '/connections/[username]', params: { username: profile.username, type: 'followers' } })],
    ['Following', stats?.following, () => router.push({ pathname: '/connections/[username]', params: { username: profile.username, type: 'following' } })],
  ];
  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar username={profile.username} storageKey={avatar} size={84} />
        <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around' }}>
          {counts.map(([label, value, onPress]) => (
            <Pressable key={label} accessibilityRole={onPress ? 'link' : 'text'} onPress={onPress} style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value ?? 0}</Text>
              <Text style={{ color: colors.text, fontSize: fontSize.caption }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{profile.username}</Text>
        {profile.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body }}>{profile.bio}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Log out" variant="secondary" onPress={signOut} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderColor: colors.border }}>
        {(['posts', 'saved'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            style={{ paddingVertical: spacing.sm, borderBottomWidth: 2, borderColor: tab === t ? colors.text : 'transparent', flex: 1, alignItems: 'center' }}
          >
            <Text style={{ color: tab === t ? colors.text : colors.textMuted, fontWeight: '700' }}>{t === 'posts' ? 'Posts' : 'Saved'}</Text>
          </Pressable>
        ))}
      </View>
      {shown.length > 0 ? (
        <PostGrid posts={shown} />
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          {tab === 'posts' ? 'No posts yet. Tap + to share your first photo.' : 'Posts you save appear here, only visible to you.'}
        </Text>
      )}
    </Screen>
  );
}
