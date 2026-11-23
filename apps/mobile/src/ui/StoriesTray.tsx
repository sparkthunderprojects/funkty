import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { publishStoryPhoto, pickImages, friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';

type Row = {
  id: string;
  author_id: string;
  profiles: { username: string; avatar: { storage_key: string } | null } | null;
};

type Ring = { authorId: string; username: string; avatar: string | null; seen: boolean };

export function StoriesTray() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [rings, setRings] = useState<Ring[]>([]);
  const [mine, setMine] = useState<{ avatar: string | null; has: boolean }>({ avatar: null, has: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [stories, views, me] = await Promise.all([
      supabase
        .from('stories')
        .select(
          'id, author_id, profiles!stories_author_id_fkey(username, avatar:media_assets!profiles_avatar_media_fk(storage_key))',
        )
        .gt('expires_at', new Date().toISOString())
        .order('id', { ascending: false })
        .limit(200),
      supabase.from('story_views').select('story_id').eq('viewer_id', profile.id).limit(500),
      supabase
        .from('profiles')
        .select('avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .eq('id', profile.id)
        .maybeSingle(),
    ]);
    const seenIds = new Set((views.data ?? []).map((v) => v.story_id));
    const byAuthor = new Map<string, { ring: Ring; unseen: boolean }>();
    for (const row of (stories.data ?? []) as unknown as Row[]) {
      const existing = byAuthor.get(row.author_id);
      const unseen = !seenIds.has(row.id);
      if (existing) {
        existing.unseen = existing.unseen || unseen;
        existing.ring.seen = !existing.unseen;
      } else {
        byAuthor.set(row.author_id, {
          unseen,
          ring: {
            authorId: row.author_id,
            username: row.profiles?.username ?? 'unknown',
            avatar: row.profiles?.avatar?.storage_key ?? null,
            seen: !unseen,
          },
        });
      }
    }
    const all = [...byAuthor.values()].map((v) => v.ring);
    setMine({
      avatar: ((me.data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key) ?? null,
      has: all.some((r) => r.authorId === profile.id),
    });
    setRings(all.filter((r) => r.authorId !== profile.id).sort((a, b) => Number(a.seen) - Number(b.seen)));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function addStory() {
    if (!profile || busy) return;
    const [asset] = await pickImages(false);
    if (!asset) return;
    setBusy(true);
    try {
      await publishStoryPhoto(asset, profile.id);
      await load();
    } catch (e) {
      // Surfaced inline: the tray has no error area, so keep it short.
      console.warn(e instanceof Error ? e.message : friendlyError(undefined));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;
  const size = 64;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md, paddingVertical: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine.has ? 'View your story' : 'Add to your story'}
        onPress={() => (mine.has ? router.push({ pathname: '/story/[username]', params: { username: profile.username } }) : addStory())}
        style={{ alignItems: 'center', width: size + 8 }}
      >
        <View style={{ padding: 3, borderRadius: size, borderWidth: mine.has ? 2.5 : 0, borderColor: colors.primary }}>
          <Avatar username={profile.username} storageKey={mine.avatar} size={size - 6} />
          {!mine.has ? (
            <Pressable
              onPress={addStory}
              accessibilityLabel="Add to your story"
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14, lineHeight: 16 }}>+</Text>
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: fontSize.caption, marginTop: 4 }}>
          {busy ? 'Sharing…' : 'Your story'}
        </Text>
      </Pressable>
      {rings.map((r) => (
        <Pressable
          key={r.authorId}
          accessibilityRole="button"
          accessibilityLabel={`View ${r.username}'s story`}
          onPress={() => router.push({ pathname: '/story/[username]', params: { username: r.username } })}
          style={{ alignItems: 'center', width: size + 8 }}
        >
          <View style={{ padding: 3, borderRadius: size, borderWidth: 2.5, borderColor: r.seen ? colors.border : colors.primary }}>
            <Avatar username={r.username} storageKey={r.avatar} size={size - 6} />
          </View>
          <Text numberOfLines={1} style={{ color: r.seen ? colors.textMuted : colors.text, fontSize: fontSize.caption, marginTop: 4 }}>
            {r.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
