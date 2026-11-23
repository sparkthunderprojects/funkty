import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { timeAgo } from '../lib/posts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';

type Viewer = {
  viewed_at: string;
  profiles: { username: string; display_name: string | null; avatar: { storage_key: string } | null } | null;
};

/** Bottom sheet for the story's author: who has seen this story, newest first. */
export function StoryViewers({ storyId, visible, onClose }: { storyId: string; visible: boolean; onClose: () => void }) {
  const { colors, spacing } = useTheme();
  const [viewers, setViewers] = useState<Viewer[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setViewers(null);
    supabase
      .from('story_views')
      .select('viewed_at, profiles!story_views_viewer_id_fkey(username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key))')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setViewers((data ?? []) as unknown as Viewer[]));
  }, [visible, storyId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close viewers" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', padding: spacing.md }}>
          Viewers{viewers ? ` · ${viewers.length}` : ''}
        </Text>
        <FlatList
          data={viewers ?? []}
          keyExtractor={(v, i) => `${v.profiles?.username ?? 'x'}-${i}`}
          ListEmptyComponent={
            viewers ? <Text style={{ color: colors.textMuted, padding: spacing.lg, textAlign: 'center' }}>No one has seen this story yet.</Text> : undefined
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
              <Avatar username={item.profiles?.username ?? '?'} storageKey={item.profiles?.avatar?.storage_key} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{item.profiles?.username ?? 'Unknown'}</Text>
                {item.profiles?.display_name ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{item.profiles.display_name}</Text> : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{timeAgo(item.viewed_at)}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
