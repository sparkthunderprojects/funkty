import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl, timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { HighlightSheet } from '../../src/ui/HighlightSheet';

type Story = { id: string; created_at: string; media_assets: { storage_key: string } | null };

/** Your stories after the 24 hours are up. Only you can see them; add the good ones to a highlight. */
export default function StoryArchive() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const { width } = useWindowDimensions();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [open, setOpen] = useState<Story | null>(null);
  const [highlight, setHighlight] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('stories')
      .select('id, created_at, media_assets(storage_key)')
      .eq('author_id', profile.id)
      .lt('expires_at', new Date().toISOString())
      .order('id', { ascending: false })
      .limit(120);
    setStories((data ?? []) as unknown as Story[]);
  }, [profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function remove(story: Story) {
    await supabase.rpc('delete_story', { p_story_id: story.id });
    setOpen(null);
    setStories((l) => (l ?? []).filter((s) => s.id !== story.id));
  }

  const cell = (width - 4) / 3;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <Text style={{ color: colors.textMuted, fontSize: 14, padding: spacing.lg }}>
          Stories are kept here after they expire. Only you can see them.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {(stories ?? []).map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Story from ${timeAgo(s.created_at)} ago`} onPress={() => setOpen(s)}>
              {s.media_assets ? <Image source={{ uri: mediaUrl(s.media_assets.storage_key) }} style={{ width: cell, height: cell * 1.6 }} contentFit="cover" /> : null}
            </Pressable>
          ))}
        </View>
        {stories && stories.length === 0 ? <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl }}>No expired stories yet.</Text> : null}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {open?.media_assets ? <Image source={{ uri: mediaUrl(open.media_assets.storage_key) }} style={{ flex: 1 }} contentFit="contain" /> : null}
          <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <Text accessibilityRole="button" onPress={() => setOpen(null)} style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
              <Text accessibilityRole="button" onPress={() => setHighlight(true)} style={{ color: '#fff', fontWeight: '700' }}>Highlight</Text>
              <Text accessibilityRole="button" onPress={() => open && void remove(open)} style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
            </View>
          </SafeAreaView>
          {open ? <HighlightSheet storyId={open.id} visible={highlight} onClose={() => setHighlight(false)} /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
