import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { mediaUrl, timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';

type Notice = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request';
  post_id: string | null;
  actor_id: string;
  created_at: string;
  read_at: string | null;
  actor: { username: string; avatar: { storage_key: string } | null } | null;
  post: { post_media: { position: number; media_assets: { storage_key: string } | null }[] } | null;
};

const select =
  'id, type, post_id, actor_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(username, avatar:media_assets!profiles_avatar_media_fk(storage_key)), post:posts(post_media(position, media_assets(storage_key)))';

const verbs: Record<Notice['type'], string> = {
  like: 'liked your post.',
  comment: 'commented on your post.',
  follow: 'started following you.',
  follow_request: 'requested to follow you.',
};

export default function Activity() {
  const { colors, fontSize, spacing, radius } = useTheme();
  const { profile } = useSession();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select(select)
      .eq('user_id', profile.id)
      .order('id', { ascending: false })
      .limit(60);
    setItems((data ?? []) as unknown as Notice[]);
    setLoading(false);
    // Viewing the list marks everything read. The unread highlight stays until the next load.
    void supabase.rpc('mark_notifications_read');
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function respond(n: Notice, accept: boolean) {
    await supabase.rpc(accept ? 'accept_follow_request' : 'reject_follow_request', { p_follower: n.actor_id });
    void load();
  }

  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>Activity</Text>
      <FlatList
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        data={items}
        keyExtractor={(n) => n.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              Nothing yet. Likes, comments and new followers show up here.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const thumb = item.post?.post_media
            .slice()
            .sort((a, b) => a.position - b.position)[0]?.media_assets?.storage_key;
          const username = item.actor?.username ?? 'someone';
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: item.read_at ? 0.85 : 1 }}>
              {!item.read_at ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} accessibilityLabel="Unread" />
              ) : null}
              <Link href={{ pathname: '/user/[username]', params: { username } }} asChild>
                <Pressable accessibilityRole="link">
                  <Avatar username={username} storageKey={item.actor?.avatar?.storage_key} size={44} />
                </Pressable>
              </Link>
              <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.body }}>
                <Text style={{ fontWeight: '700' }}>{username} </Text>
                {verbs[item.type]}
                <Text style={{ color: colors.textMuted }}> {timeAgo(item.created_at)}</Text>
              </Text>
              {item.type === 'follow_request' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ width: 84 }}>
                    <Button label="Accept" onPress={() => respond(item, true)} />
                  </View>
                  <View style={{ width: 84 }}>
                    <Button label="Decline" variant="secondary" onPress={() => respond(item, false)} />
                  </View>
                </View>
              ) : thumb && item.post_id ? (
                <Link href={{ pathname: '/post/[id]', params: { id: item.post_id } }} asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel="Open post">
                    <Image source={{ uri: mediaUrl(thumb) }} style={{ width: 44, height: 44, borderRadius: radius.sm }} contentFit="cover" />
                  </Pressable>
                </Link>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}
