import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../src/lib/haptics';
import { friendlyError, mediaUrl } from '../src/lib/posts';
import { type ScheduleKey, describeWhen, scheduleDate, scheduleOptions } from '../src/lib/schedule';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/theme';

type Draft = { id: string; caption: string | null; media_ids: string[]; scheduled_for: string | null; status: string; error: string | null; thumb?: string };

/** Drafts and scheduled posts. Scheduled posts go out by themselves, even with the app closed. */
export default function Drafts() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('post_drafts').select('id, caption, media_ids, scheduled_for, status, error').eq('owner_id', profile.id).order('created_at', { ascending: false });
    const rows = (data ?? []) as Draft[];
    const firsts = rows.map((r) => r.media_ids[0]).filter((x): x is string => !!x);
    if (firsts.length > 0) {
      const { data: media } = await supabase.from('media_assets').select('id, storage_key').in('id', firsts);
      const keys = new Map((media ?? []).map((m) => [m.id, m.storage_key]));
      for (const r of rows) r.thumb = keys.get(r.media_ids[0]!);
    }
    setDrafts(rows);
  }, [profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(id: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(id);
    setError(null);
    const { error: e } = await fn();
    setBusy(null);
    if (e) setError(friendlyError(e.message));
    else tap();
    await load();
  }

  async function reschedule(d: Draft, key: ScheduleKey) {
    const at = scheduleDate(key);
    await run(d.id, () => supabase.rpc('update_draft', { p_id: d.id, p_caption: text, p_scheduled_for: at ? at.toISOString() : undefined }));
    setEditing(null);
  }

  if (!drafts) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, padding: spacing.lg }}>{error}</Text> : null}
      <FlatList
        data={drafts}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl }}>No drafts or scheduled posts. When you create a post, choose a time or Save as draft.</Text>}
        renderItem={({ item: d }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {d.thumb ? <Image source={{ uri: mediaUrl(d.thumb) }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" /> : <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: colors.border }} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: d.status === 'failed' ? colors.danger : colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                  {d.status === 'scheduled' && d.scheduled_for ? `Scheduled · ${describeWhen(d.scheduled_for)}` : d.status === 'failed' ? 'Could not post' : 'Draft'}
                  {d.media_ids.length > 1 ? ` · ${d.media_ids.length} photos` : ''}
                </Text>
                {editing === d.id ? null : <Text numberOfLines={3} style={{ color: colors.text, fontSize: 15 }}>{d.caption || 'No caption'}</Text>}
                {d.status === 'failed' && d.error ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{d.error}</Text> : null}
              </View>
            </View>
            {editing === d.id ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput accessibilityLabel="Caption" value={text} onChangeText={setText} multiline maxLength={2200} style={{ color: colors.text, backgroundColor: colors.background, borderRadius: 10, padding: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 15 }} />
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Save for later:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {scheduleOptions.map((o) => (
                    <Pressable key={o.key} accessibilityRole="button" onPress={() => void reschedule(d, o.key)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.background }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{o.key === 'now' ? 'No time (draft)' : o.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text accessibilityRole="button" onPress={() => setEditing(null)} style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                {busy === d.id ? <ActivityIndicator color={colors.primary} /> : (
                  <>
                    <Text accessibilityRole="button" onPress={() => void run(d.id, async () => { const r = await supabase.rpc('publish_draft', { p_id: d.id }); if (!r.error) router.navigate('/'); return r; })} style={{ color: colors.primary, fontWeight: '700' }}>Post now</Text>
                    <Text accessibilityRole="button" onPress={() => { setText(d.caption ?? ''); setEditing(d.id); }} style={{ color: colors.text, fontWeight: '600' }}>Edit</Text>
                    <Text accessibilityRole="button" onPress={() => void run(d.id, () => supabase.rpc('delete_draft', { p_id: d.id }))} style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
