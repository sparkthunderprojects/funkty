import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { type FeedPost, feedSelect, friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { PostGrid } from '../../src/ui/PostGrid';

type Person = { id: string; username: string; avatar: { storage_key: string } | null };
type Member = { user_id: string; status: string; profile: Person | null };

export default function CollectionPage() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [owner, setOwner] = useState<Person | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [mutuals, setMutuals] = useState<Person[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, c, m] = await Promise.all([
      supabase.from('collection_posts').select(`added_at, posts(${feedSelect})`).eq('collection_id', id).order('added_at', { ascending: false }).limit(100),
      supabase.from('collections').select('user_id, owner:profiles!collections_user_id_fkey(id, username, avatar:media_assets!profiles_avatar_media_fk(storage_key))').eq('id', id).maybeSingle(),
      supabase.from('collection_members').select('user_id, status, profile:profiles!collection_members_user_id_fkey(id, username, avatar:media_assets!profiles_avatar_media_fk(storage_key))').eq('collection_id', id),
    ]);
    setPosts(((p.data ?? []) as unknown as { posts: FeedPost | null }[]).flatMap((r) => (r.posts ? [r.posts] : [])));
    setOwner(((c.data as unknown as { owner: Person | null } | null)?.owner) ?? null);
    setMembers((m.data ?? []) as unknown as Member[]);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = !!owner && owner.id === profile?.id;
  const iAmMember = members.some((m) => m.user_id === profile?.id);

  async function openPicker() {
    setPicking((v) => !v);
    if (mutuals || !profile) return;
    const [a, b] = await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', profile.id).eq('state', 'active').limit(500),
      supabase.from('follows').select('follower_id').eq('followee_id', profile.id).eq('state', 'active').limit(500),
    ]);
    const back = new Set((b.data ?? []).map((r) => r.follower_id));
    const ids = (a.data ?? []).map((r) => r.followee_id).filter((x) => back.has(x));
    if (ids.length === 0) return setMutuals([]);
    const { data } = await supabase.from('profiles').select('id, username, avatar:media_assets!profiles_avatar_media_fk(storage_key)').in('id', ids).order('username');
    setMutuals((data ?? []) as unknown as Person[]);
  }
  async function invite(p: Person) {
    tap();
    setError(null);
    const { error: e } = await supabase.rpc('invite_to_collection', { p_collection_id: id, p_user: p.id });
    if (e) return setError(friendlyError(e.message));
    await load();
  }
  async function removeMember(userId: string, leaving: boolean) {
    const go = async () => {
      await supabase.rpc('remove_collection_member', { p_collection_id: id, p_user: userId });
      if (leaving) router.back();
      else void load();
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(leaving ? 'Leave this collection?' : 'Remove this person?', leaving ? 'Posts you added stay in the collection.' : 'Posts they added stay in the collection.', [
      { text: 'Cancel', style: 'cancel' },
      { text: leaving ? 'Leave' : 'Remove', style: 'destructive', onPress: () => void go() },
    ]);
  }

  const taken = new Set([...members.map((m) => m.user_id), profile?.id]);
  const heading = { color: colors.text, fontSize: 16, fontWeight: '700' } as const;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        {name ? <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', padding: spacing.lg, paddingBottom: spacing.sm }}>{name}</Text> : null}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...heading, flex: 1 }}>People</Text>
            {isOwner ? (
              <Pressable accessibilityRole="button" onPress={() => void openPicker()}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{picking ? 'Done' : 'Invite'}</Text>
              </Pressable>
            ) : iAmMember ? (
              <Pressable accessibilityRole="button" onPress={() => void removeMember(profile!.id, true)}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Leave</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {owner ? <Chip person={owner} note="Owner" /> : null}
            {members.map((m) =>
              m.profile ? (
                <Chip key={m.user_id} person={m.profile} note={m.status === 'invited' ? 'Invited' : undefined} onRemove={isOwner ? () => void removeMember(m.user_id, false) : undefined} />
              ) : null,
            )}
          </View>
          {picking ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, gap: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>You can invite people who follow you back. Up to 10 people.</Text>
              {mutuals === null ? null : mutuals.filter((p) => !taken.has(p.id)).length === 0 ? (
                <Text style={{ color: colors.textMuted, paddingVertical: 8 }}>No one to invite yet.</Text>
              ) : (
                mutuals.filter((p) => !taken.has(p.id)).map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Invite ${p.username}`} onPress={() => void invite(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                    <Avatar username={p.username} storageKey={p.avatar?.storage_key} size={32} />
                    <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{p.username}</Text>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Invite</Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        </View>
        {posts && posts.length > 0 ? <PostGrid posts={posts} /> : posts ? <Text style={{ color: colors.textMuted, padding: spacing.lg }}>Nothing in this collection yet. Add posts from the "…" menu on any post.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );

  function Chip({ person, note, onRemove }: { person: Person; note?: string; onRemove?: () => void }) {
    return (
      <Pressable
        accessibilityRole={onRemove ? 'button' : 'text'}
        accessibilityLabel={onRemove ? `Remove ${person.username}` : person.username}
        onPress={onRemove}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 12 }}
      >
        <Avatar username={person.username} storageKey={person.avatar?.storage_key} size={26} />
        <Text style={{ color: colors.text, fontWeight: '600' }}>{person.username}</Text>
        {note ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{note}</Text> : null}
        {onRemove ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>✕</Text> : null}
      </Pressable>
    );
  }
}
