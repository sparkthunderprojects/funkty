import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect, firstImage, friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

export default function Archive() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('posts')
      .select(feedSelect)
      .eq('author_id', profile.id)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .limit(100);
    setPosts((data ?? []) as unknown as FeedPost[]);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function restore(id: string) {
    setError(null);
    const { error: e } = await supabase.rpc('set_post_archived', { p_post_id: id, p_on: false });
    if (e) return setError(friendlyError(e.message));
    setPosts((list) => (list ?? []).filter((p) => p.id !== id));
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
          Archived posts are hidden from everyone but you. Restore one to put it back on your profile.
        </Text>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        {posts && posts.length === 0 ? <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>Nothing archived.</Text> : null}
        {(posts ?? []).map((p) => {
          const image = firstImage(p);
          return (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }}>
                {image ? <Image source={{ uri: image.url }} style={{ width: 64, height: 64 }} contentFit="cover" /> : null}
              </View>
              <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: fontSize.body }}>
                {p.caption || 'No caption'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Restore post" onPress={() => void restore(p.id)} hitSlop={8}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Restore</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
