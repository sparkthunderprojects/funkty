import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';

/** Bottom sheet on your own story: add it to a highlight or start a new one. */
export function HighlightSheet({ storyId, visible, onClose }: { storyId: string; visible: boolean; onClose: () => void }) {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [list, setList] = useState<{ id: string; title: string }[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !profile) return;
    setMsg(null);
    setName('');
    supabase
      .from('highlights')
      .select('id, title')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setList(data ?? []));
  }, [visible, profile]);

  async function add(id: string) {
    const { error } = await supabase.rpc('add_story_to_highlight', { p_highlight_id: id, p_story_id: storyId });
    if (error) return setMsg(friendlyError(error.message));
    onClose();
  }
  async function create() {
    const { error } = await supabase.rpc('create_highlight', { p_title: name, p_story_id: storyId });
    if (error) return setMsg(friendlyError(error.message));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close highlights" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', padding: spacing.md }}>Add to highlight</Text>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg }}>
          {list.map((h) => (
            <Pressable key={h.id} accessibilityRole="button" onPress={() => void add(h.id)} style={{ paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{h.title}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <TextInput
              accessibilityLabel="New highlight name"
              placeholder="New highlight"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={20}
              style={{ flex: 1, color: colors.text, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, height: 44 }}
            />
            <Text accessibilityRole="button" onPress={() => void create()} style={{ color: name.trim() ? colors.primary : colors.textMuted, fontWeight: '700' }}>
              Create
            </Text>
          </View>
          {msg ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{msg}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
