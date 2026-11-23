import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';

type Blocked = { blocked_id: string; profiles: { username: string; display_name: string | null } | null };

export default function BlockedAccounts() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [rows, setRows] = useState<Blocked[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id, profiles!blocks_blocked_id_fkey(username, display_name)')
      .eq('blocker_id', profile.id)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as unknown as Blocked[]);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unblock(id: string) {
    setError(null);
    const { error: e } = await supabase.rpc('unblock_user', { p_target: id });
    if (e) return setError('Could not unblock this account. Please try again.');
    setRows((c) => (c ?? []).filter((r) => r.blocked_id !== id));
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? <Text style={{ color: colors.danger, padding: spacing.md }}>{error}</Text> : null}
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.blocked_id}
        ListEmptyComponent={
          rows ? <Text style={{ color: colors.textMuted, padding: spacing.lg }}>You haven't blocked anyone.</Text> : undefined
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
            <Avatar username={item.profiles?.username ?? '?'} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{item.profiles?.username ?? 'Unknown'}</Text>
              {item.profiles?.display_name ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{item.profiles.display_name}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item.profiles?.username ?? 'account'}`}
              onPress={() => void unblock(item.blocked_id)}
              style={{ backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Unblock</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
