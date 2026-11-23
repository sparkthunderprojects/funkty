import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { mediaUrl } from '../lib/posts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';

type Item = { id: string; title: string; cover: { storage_key: string } | null };

/** Row of rounded highlight tiles under the bio. Renders nothing when there are none. */
export function Highlights({ ownerId, own }: { ownerId: string; own?: boolean }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('highlights')
        .select('id, title, cover:media_assets!highlights_cover_media_id_fkey(storage_key)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
        .limit(20)
        .then(({ data }) => setItems((data ?? []) as unknown as Item[]));
    }, [ownerId]),
  );

  if (items.length === 0) {
    if (!own) return null;
    return (
      <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.sm }}>
        Keep your best stories on your profile: open one of your stories and tap Highlight.
      </Text>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.sm }}>
      {items.map((h) => (
        <Pressable
          key={h.id}
          accessibilityRole="button"
          accessibilityLabel={`Highlight ${h.title}`}
          onPress={() => router.push({ pathname: '/highlight/[id]', params: { id: h.id } })}
          style={{ alignItems: 'center', width: 72, gap: 6 }}
        >
          <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden' }}>
            {h.cover ? <Image source={{ uri: mediaUrl(h.cover.storage_key) }} style={{ width: 68, height: 68 }} contentFit="cover" /> : null}
          </View>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
            {h.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
