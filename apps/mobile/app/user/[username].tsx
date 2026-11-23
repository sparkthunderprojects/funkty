import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Highlights } from '../../src/ui/Highlights';
import { ProfileLines } from '../../src/ui/ProfileLines';
import { ProfileBanner, RingAvatar } from '../../src/ui/RingAvatar';
import { Button } from '../../src/ui/Button';
import { PostGrid } from '../../src/ui/PostGrid';
import { type ProfileTab, ProfileTabs } from '../../src/ui/ProfileTabs';
import { Screen } from '../../src/ui/Screen';

type Person = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_private: boolean;
  location: string | null;
  website: string | null;
  cover: { storage_key: string } | null;
  avatar: { storage_key: string } | null;
};
type Follow = 'none' | 'pending' | 'active';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [hasStory, setHasStory] = useState(false);
  const [tagged, setTagged] = useState<FeedPost[]>([]);
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [follow, setFollow] = useState<Follow>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(async () => {
    if (!me || !username) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, is_private, location, website, avatar:media_assets!profiles_avatar_media_fk(storage_key), cover:media_assets!profiles_cover_media_id_fkey(storage_key)')
      .eq('username', String(username).toLowerCase())
      .maybeSingle();
    const p = data as unknown as Person | null;
    setPerson(p);
    if (p) {
      const [s, f, ps, tg, st] = await Promise.all([
        supabase.from('profile_stats').select('posts_count, followers_count, following_count').eq('user_id', p.id).maybeSingle(),
        supabase.from('follows').select('state').eq('follower_id', me.id).eq('followee_id', p.id).maybeSingle(),
        supabase.from('posts').select(feedSelect).eq('author_id', p.id).order('id', { ascending: false }).limit(60),
        supabase.from('post_tags').select(`created_at, posts(${feedSelect})`).eq('tagged_id', p.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(60),
        supabase.from('stories').select('id', { count: 'exact', head: true }).eq('author_id', p.id).gt('expires_at', new Date().toISOString()),
      ]);
      setHasStory((st.count ?? 0) > 0);
      setTagged(((tg.data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : [])));
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

  async function block() {
    if (!person) return;
    await supabase.rpc('block_user', { p_target: person.id });
    router.back();
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
  const shown = tab === 'reels' ? posts.filter((p) => p.kind === 'video') : tab === 'tagged' ? tagged : posts;
  const counts: [string, number, (() => void) | undefined][] = [
    ['Posts', stats.posts, undefined],
    ['Followers', stats.followers, () => router.push({ pathname: '/connections/[username]', params: { username: person.username, type: 'followers' } })],
    ['Following', stats.following, () => router.push({ pathname: '/connections/[username]', params: { username: person.username, type: 'following' } })],
  ];
  return (
    <Screen scroll>
      <View>
        <ProfileBanner storageKey={person.cover?.storage_key} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.sm, marginTop: -48 }}>
          <RingAvatar
            username={person.username}
            storageKey={person.avatar?.storage_key}
            size={104}
            onPress={hasStory ? () => router.push({ pathname: '/story/[username]', params: { username: person.username } }) : undefined}
          />
          <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around', paddingBottom: 4 }}>
            {counts.map(([label, value, onPress]) => (
              <Pressable key={label} accessibilityRole={onPress ? 'link' : 'text'} onPress={onPress} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '800' }}>{value}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>{person.display_name || person.username}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>@{person.username}</Text>
        {person.bio ? <Text style={{ color: colors.text, fontSize: fontSize.body, marginTop: 4 }}>{person.bio}</Text> : null}
      </View>
      <ProfileLines location={person.location} website={person.website} />
      <Highlights ownerId={person.id} />
      {isMe ? (
        <Button label="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} compact />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label={follow === 'active' ? 'Following' : follow === 'pending' ? 'Requested' : 'Follow'}
                variant={follow === 'none' ? 'primary' : 'secondary'}
                onPress={toggleFollow}
                loading={busy}
                compact
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Message"
                variant="secondary"
                compact
                onPress={() => router.push({ pathname: '/messages/[username]', params: { username: person.username } })}
              />
            </View>
          </View>
          {confirmBlock ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                Block {person.username}? They will not be able to find your profile, posts or stories.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label="Block" onPress={block} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="secondary" onPress={() => setConfirmBlock(false)} compact />
                </View>
              </View>
            </View>
          ) : (
            <Text accessibilityRole="button" onPress={() => setConfirmBlock(true)} style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
              Block this account
            </Text>
          )}
        </>
      )}
      <View style={{ marginHorizontal: -spacing.lg }}>
        <ProfileTabs tabs={['posts', 'reels', 'tagged']} value={tab} onChange={setTab} />
      </View>
      {shown.length > 0 ? (
        <View style={{ marginHorizontal: -spacing.lg }}>
          <PostGrid posts={shown} />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          {person.is_private && follow !== 'active' && !isMe
            ? 'This account is private. Follow to see their posts.'
            : tab === 'reels'
              ? 'No reels yet.'
              : tab === 'tagged'
                ? 'No tagged posts yet.'
              : 'No posts yet.'}
        </Text>
      )}
    </Screen>
  );
}
