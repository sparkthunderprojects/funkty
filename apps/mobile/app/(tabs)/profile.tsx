import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Highlights } from '../../src/ui/Highlights';
import { ProfileLines } from '../../src/ui/ProfileLines';
import { ProfileBanner, RingAvatar } from '../../src/ui/RingAvatar';
import { Wordmark } from '../../src/ui/Logo';
import { ActionSheet } from '../../src/ui/ActionSheet';
import { Button } from '../../src/ui/Button';
import { shareLink } from '../../src/lib/share';
import { PostGrid } from '../../src/ui/PostGrid';
import { type ProfileTab, ProfileTabs } from '../../src/ui/ProfileTabs';
import { Screen } from '../../src/ui/Screen';

type Stats = { posts: number; followers: number; following: number };
type Tab = ProfileTab;

export default function Profile() {
  const { profile, signOut } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [saved, setSaved] = useState<FeedPost[]>([]);
  const [tagged, setTagged] = useState<FeedPost[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [menu, setMenu] = useState(false);

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
        .from('post_tags')
        .select(`created_at, posts(${feedSelect})`)
        .eq('tagged_id', profile.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(60)
        .then(({ data }) =>
          setTagged(
            ((data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : [])),
          ),
        );
      supabase
        .from('profiles')
        .select('avatar:media_assets!profiles_avatar_media_fk(storage_key), cover:media_assets!profiles_cover_media_id_fkey(storage_key)')
        .eq('id', profile.id)
        .maybeSingle()
        .then(({ data }) => {
          const d = data as unknown as { avatar: { storage_key: string } | null; cover: { storage_key: string } | null } | null;
          setAvatar(d?.avatar?.storage_key ?? null);
          setCover(d?.cover?.storage_key ?? null);
        });
    }, [profile]),
  );

  if (!profile) return null;
  const shown = tab === 'posts' ? posts : tab === 'reels' ? posts.filter((p) => p.kind === 'video') : tab === 'tagged' ? tagged : saved;
  const counts: [string, number | undefined, (() => void) | undefined][] = [
    ['Posts', stats?.posts, undefined],
    ['Followers', stats?.followers, () => router.push({ pathname: '/connections/[username]', params: { username: profile.username, type: 'followers' } })],
    ['Following', stats?.following, () => router.push({ pathname: '/connections/[username]', params: { username: profile.username, type: 'following' } })],
  ];
  return (
    <Screen scroll tabs>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Wordmark height={30} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Create" onPress={() => router.push('/create')} hitSlop={10} style={{ marginRight: spacing.md }}>
          <Feather name="plus-square" size={26} color={colors.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => setMenu(true)} hitSlop={10}>
          <Ionicons name="menu" size={30} color={colors.text} />
        </Pressable>
      </View>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Edit profile', onPress: () => router.push('/edit-profile') },
          { label: 'Share profile', onPress: () => void shareLink(`${profile.username} on Funkty`, `/user/${profile.username}`) },
          { label: 'Settings', onPress: () => router.push('/settings') },
          { label: 'Log out', onPress: () => void signOut(), destructive: true },
        ]}
      />
      <View>
        <ProfileBanner storageKey={cover} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.sm, marginTop: -48 }}>
          <RingAvatar username={profile.username} storageKey={avatar} size={104} />
          <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around', paddingBottom: 4 }}>
            {counts.map(([label, value, onPress]) => (
              <Pressable key={label} accessibilityRole={onPress ? 'link' : 'text'} onPress={onPress} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value ?? 0}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>{profile.display_name || profile.username}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{profile.username}</Text>
        {profile.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body, marginTop: 4 }}>{profile.bio}</Text> : null}
      </View>
      <ProfileLines location={profile.location} website={profile.website} />
      <Highlights ownerId={profile.id} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} compact />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Share profile" variant="secondary" onPress={() => void shareLink(`${profile.username} on Funkty`, `/user/${profile.username}`)} compact />
        </View>
      </View>
      <ProfileTabs tabs={['posts', 'reels', 'tagged', 'saved']} value={tab} onChange={setTab} />
      {shown.length > 0 ? (
        <View style={{ marginHorizontal: -spacing.lg }}>
          <PostGrid posts={shown} />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          {tab === 'posts' ? 'No posts yet. Tap + to share your first photo.' : tab === 'reels' ? 'Videos you share appear here.' : tab === 'tagged' ? 'Posts you are tagged in, once you approve them, appear here.' : 'Posts you save appear here, only visible to you.'}
        </Text>
      )}
    </Screen>
  );
}
