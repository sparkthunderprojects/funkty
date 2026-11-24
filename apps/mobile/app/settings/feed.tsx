import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

export default function FeedPreferences() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [topics, setTopics] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    const [t, h] = await Promise.all([
      supabase.from('muted_topics').select('tag').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('feed_not_interested').select('post_id', { count: 'exact', head: true }).eq('user_id', profile.id),
    ]);
    setTopics((t.data ?? []).map((r) => r.tag));
    setHiddenCount(h.count ?? 0);
  }, [profile]);
  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError(null);
    const { error: e } = await supabase.rpc('mute_topic', { p_tag: input });
    if (e) return setError(friendlyError(e.message));
    tap();
    setInput('');
    await load();
  }
  async function remove(tag: string) {
    tap();
    await supabase.rpc('unmute_topic', { p_tag: tag });
    await load();
  }
  async function reset() {
    tap();
    const { error: e } = await supabase.rpc('reset_not_interested');
    if (e) return setError(friendlyError(e.message));
    setNotice('Done. Posts you marked as not interested can appear again.');
    await load();
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Manage topics</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          Posts with these hashtags are hidden from your feed. You can also tap Not interested or Don't show on any post.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            accessibilityLabel="Topic to hide"
            placeholder="#hashtag"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void add()}
            style={{ flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 }}
          />
          <Pressable accessibilityRole="button" onPress={() => void add()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}>
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Hide</Text>
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {topics.map((t) => (
            <Pressable key={t} accessibilityRole="button" accessibilityLabel={`Show #${t} again`} onPress={() => void remove(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
              <Text style={{ color: colors.text }}>#{t}</Text>
              <Ionicons name="close" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
          {topics.length === 0 ? <Text style={{ color: colors.textMuted }}>No topics hidden.</Text> : null}
        </View>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.lg }}>Refresh your feed</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          Brings back the {hiddenCount} {hiddenCount === 1 ? 'post' : 'posts'} you marked Not interested. Your hidden topics stay hidden.
        </Text>
        <Pressable accessibilityRole="button" disabled={hiddenCount === 0} onPress={() => void reset()} style={{ alignSelf: 'flex-start', backgroundColor: hiddenCount === 0 ? colors.surface : colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 }}>
          <Text style={{ color: hiddenCount === 0 ? colors.textMuted : colors.onPrimary, fontWeight: '700' }}>Refresh my feed</Text>
        </Pressable>
        {notice ? <Text style={{ color: colors.text }}>{notice}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
