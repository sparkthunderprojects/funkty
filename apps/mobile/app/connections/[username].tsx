import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Screen } from '../../src/ui/Screen';

type Row = { follower_id: string; profiles: { username: string; display_name: string | null; avatar: { storage_key: string } | null } | null };

export default function Connections() {
  const { username, type } = useLocalSearchParams<{ username: string; type: 'followers' | 'following' }>();
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile: me } = useSession();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const followers = type !== 'following';

  useEffect(() => {
    (async () => {
      const { data: person } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', String(username).toLowerCase())
        .maybeSingle();
      if (!person) return setLoading(false);
      setOwnerId(person.id);
      const embed = followers ? 'profiles!follows_follower_id_fkey' : 'profiles!follows_followee_id_fkey';
      const { data } = await supabase
        .from('follows')
        .select(`follower_id, ${embed}(username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key))`)
        .eq(followers ? 'followee_id' : 'follower_id', person.id)
        .eq('state', 'active')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, [username, followers]);

  async function removeFollower(id: string) {
    await supabase.rpc('remove_follower', { p_follower: id });
    setRows((list) => list.filter((r) => r.follower_id !== id));
    setConfirming(null);
  }
  const canRemove = followers && !!me && ownerId === me.id;

  return (
    <Screen>
      <Stack.Screen options={{ title: followers ? 'Followers' : 'Following' }} />
      <FlatList
        data={rows}
        keyExtractor={(r, i) => r.profiles?.username ?? String(i)}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              {followers ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          )
        }
        renderItem={({ item }) =>
          item.profiles ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/user/[username]', params: { username: item.profiles!.username } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <Avatar username={item.profiles.username} storageKey={item.profiles.avatar?.storage_key} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>{item.profiles.username}</Text>
                {item.profiles.display_name ? (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{item.profiles.display_name}</Text>
                ) : null}
              </View>
              {canRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.profiles.username}`}
                  onPress={() => (confirming === item.follower_id ? void removeFollower(item.follower_id) : setConfirming(item.follower_id))}
                  hitSlop={8}
                  style={{ backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: confirming === item.follower_id ? colors.danger : colors.text, fontWeight: '700', fontSize: 13 }}>
                    {confirming === item.follower_id ? 'Confirm' : 'Remove'}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}
