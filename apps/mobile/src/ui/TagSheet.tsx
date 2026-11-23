import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';

type Tags = FeedPost['post_tags'];
type Found = { id: string; username: string; avatar: { storage_key: string } | null };

/** Author's panel: tag people (they must approve before it shows) and take tags back. */
export function TagSheet({ postId, tags, visible, onClose, onChanged }: { postId: string; tags: Tags; visible: boolean; onClose: () => void; onChanged: (t: Tags) => void }) {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '');
    if (!visible || term.length < 2) return setFound([]);
    let live = true;
    supabase
      .from('profiles')
      .select('id, username, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
      .ilike('username', `${term}%`)
      .neq('id', profile?.id ?? '')
      .limit(8)
      .then(({ data }) => live && setFound((data ?? []) as unknown as Found[]));
    return () => {
      live = false;
    };
  }, [q, visible, profile?.id]);

  async function tag(u: Found) {
    setMsg(null);
    const { error } = await supabase.rpc('tag_user', { p_post_id: postId, p_user: u.id });
    if (error) return setMsg(friendlyError(error.message));
    if (!tags.some((t) => t.tagged_id === u.id)) onChanged([...tags, { status: 'pending', tagged_id: u.id, tagged: { username: u.username } }]);
    setQ('');
  }
  async function untag(id: string) {
    const { error } = await supabase.rpc('untag_user', { p_post_id: postId, p_user: id });
    if (error) return setMsg(friendlyError(error.message));
    onChanged(tags.filter((t) => t.tagged_id !== id));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <View style={{ width: 70 }} />
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>Tag people</Text>
          <Text accessibilityRole="button" onPress={onClose} style={{ color: colors.primary, fontSize: 16, fontWeight: '700', width: 70, textAlign: 'right' }}>
            Done
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.md }}>
          People you tag are asked first. The tag only shows once they approve. Up to 10 per post.
        </Text>
        <TextInput
          accessibilityLabel="Search people"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search by username"
          placeholderTextColor={colors.textMuted}
          style={{ color: colors.text, backgroundColor: colors.surface, borderRadius: 12, margin: spacing.md, paddingHorizontal: 12, height: 44, fontSize: 16 }}
        />
        {msg ? <Text accessibilityRole="alert" style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{msg}</Text> : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {found.map((u) => (
            <Pressable key={u.id} accessibilityRole="button" accessibilityLabel={`Tag ${u.username}`} onPress={() => void tag(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 }}>
              <Avatar username={u.username} storageKey={u.avatar?.storage_key} size={40} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{u.username}</Text>
            </Pressable>
          ))}
          {tags.length > 0 ? <Text style={{ color: colors.textMuted, fontWeight: '700', marginTop: spacing.md }}>Tagged</Text> : null}
          {tags
            .filter((t) => t.status !== 'declined')
            .map((t) => (
              <View key={t.tagged_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>
                  @{t.tagged?.username ?? 'unknown'}
                  {t.status === 'pending' ? '  · waiting for approval' : ''}
                </Text>
                <Text accessibilityRole="button" accessibilityLabel={`Remove tag ${t.tagged?.username}`} onPress={() => void untag(t.tagged_id)} style={{ color: colors.danger, fontWeight: '600' }}>
                  Remove
                </Text>
              </View>
            ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
