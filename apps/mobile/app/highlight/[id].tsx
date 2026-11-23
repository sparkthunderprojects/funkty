import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyError, mediaUrl } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';

type Detail = {
  id: string;
  title: string;
  owner_id: string;
  highlight_items: { media_id: string; added_at: string; media_assets: { storage_key: string } | null }[];
};

export default function HighlightViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useSession();
  const router = useRouter();
  const [h, setH] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('highlights')
      .select('id, title, owner_id, highlight_items(media_id, added_at, media_assets(storage_key))')
      .eq('id', String(id))
      .maybeSingle();
    const d = data as unknown as Detail | null;
    if (d) d.highlight_items.sort((a, b) => a.added_at.localeCompare(b.added_at));
    setH(d);
    setTitle(d?.title ?? '');
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  const items = h?.highlight_items ?? [];
  const current = items[Math.min(index, items.length - 1)];
  if (!h || !current) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>This highlight is no longer available.</Text>
        <Text accessibilityRole="button" onPress={() => router.back()} style={{ color: '#fff', textAlign: 'center', marginTop: 16, fontWeight: '700' }}>
          Close
        </Text>
      </SafeAreaView>
    );
  }
  const mine = me?.id === h.owner_id;

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, after?: () => void) {
    setError(null);
    const { error: e } = await fn();
    if (e) return setError(friendlyError(e.message));
    after?.();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {current.media_assets ? (
        <Image source={{ uri: mediaUrl(current.media_assets.storage_key) }} accessibilityLabel={`Highlight ${h.title}`} style={{ flex: 1 }} contentFit="contain" />
      ) : null}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
        <Pressable accessibilityLabel="Previous" style={{ flex: 1 }} onPress={() => (index > 0 ? setIndex(index - 1) : router.back())} />
        <Pressable accessibilityLabel="Next" style={{ flex: 2 }} onPress={() => (index < items.length - 1 ? setIndex(index + 1) : router.back())} />
      </View>
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 }}>
          {items.map((it, i) => (
            <View key={it.media_id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
          {renaming ? (
            <TextInput
              accessibilityLabel="Highlight name"
              value={title}
              onChangeText={setTitle}
              maxLength={20}
              autoFocus
              style={{ color: '#fff', fontWeight: '700', fontSize: 16, borderBottomWidth: 1, borderColor: '#fff', minWidth: 120 }}
            />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{h.title}</Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
      {mine ? (
        <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
          {error ? <Text accessibilityRole="alert" style={{ color: '#fff', textAlign: 'center', padding: 8 }}>{error}</Text> : null}
          {confirmDelete ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={{ color: '#fff', textAlign: 'center' }}>Delete this highlight? Your stories in it are removed from the highlight.</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32 }}>
                <Text accessibilityRole="button" onPress={() => void run(() => supabase.rpc('delete_highlight', { p_highlight_id: h.id }), () => router.back())} style={{ color: '#fff', fontWeight: '800' }}>
                  Delete
                </Text>
                <Text accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={{ color: '#fff' }}>
                  Cancel
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              {renaming ? (
                <Text
                  accessibilityRole="button"
                  onPress={() =>
                    void run(
                      () => supabase.rpc('rename_highlight', { p_highlight_id: h.id, p_title: title }),
                      () => {
                        setRenaming(false);
                        void load();
                      },
                    )
                  }
                  style={{ color: '#fff', fontWeight: '700' }}
                >
                  Save name
                </Text>
              ) : (
                <Text accessibilityRole="button" onPress={() => setRenaming(true)} style={{ color: '#fff', fontWeight: '700' }}>
                  Rename
                </Text>
              )}
              <Text
                accessibilityRole="button"
                onPress={() =>
                  void run(
                    () => supabase.rpc('remove_highlight_item', { p_highlight_id: h.id, p_media_id: current.media_id }),
                    () => (items.length === 1 ? router.back() : void load()),
                  )
                }
                style={{ color: '#fff', fontWeight: '700' }}
              >
                Remove this story
              </Text>
              <Text accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ color: '#fff', fontWeight: '700' }}>
                Delete
              </Text>
            </View>
          )}
        </SafeAreaView>
      ) : null}
    </View>
  );
}
