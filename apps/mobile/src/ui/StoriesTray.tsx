import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { publishStoryPhoto, pickImages, friendlyError, mediaUrl } from '../lib/posts';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { RingAvatar } from './RingAvatar';

type Row = {
  id: string;
  author_id: string;
  profiles: { username: string; avatar: { storage_key: string } | null } | null;
  media_assets: { storage_key: string } | null;
};

type Ring = { authorId: string; username: string; avatar: string | null; cover: string | null; seen: boolean };

export function StoriesTray() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const [rings, setRings] = useState<Ring[]>([]);
  const [mine, setMine] = useState<{ avatar: string | null; cover: string | null; has: boolean }>({ avatar: null, cover: null, has: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [stories, views, me] = await Promise.all([
      supabase
        .from('stories')
        .select(
          'id, author_id, media_assets(storage_key), profiles!stories_author_id_fkey(username, avatar:media_assets!profiles_avatar_media_fk(storage_key))',
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
            cover: row.media_assets?.storage_key ?? null,
            seen: !unseen,
          },
        });
      }
    }
    const all = [...byAuthor.values()].map((v) => v.ring);
    setMine({
      avatar: ((me.data as unknown as { avatar: { storage_key: string } | null } | null)?.avatar?.storage_key) ?? null,
      cover: all.find((r) => r.authorId === profile.id)?.cover ?? null,
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
  const w = 100;
  const h = 144;
  const card = (cover: string | null, fallback: string, children?: React.ReactNode) => (
    <View style={{ width: w, height: h, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface }}>
      {cover ? (
        <Image source={{ uri: mediaUrl(cover) }} style={{ width: w, height: h }} contentFit="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 34 }}>{fallback.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      {children}
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingVertical: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine.has ? 'View your story' : 'Add to your story'}
        onPress={() => (mine.has ? router.push({ pathname: '/story/[username]', params: { username: profile.username } }) : addStory())}
        style={{ alignItems: 'center', width: w }}
      >
        {card(mine.cover ?? mine.avatar, profile.username)}
        {!mine.has ? (
          <Pressable
            onPress={addStory}
            accessibilityLabel="Add to your story"
            style={{ position: 'absolute', right: 8, top: h - 36, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="plus" size={18} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ position: 'absolute', left: 0, right: 0, top: h - 52, alignItems: 'center' }}>
            <RingAvatar username={profile.username} storageKey={mine.avatar} size={44} />
          </View>
        )}
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: fontSize.body, marginTop: 6 }}>
          {busy ? 'Sharing…' : 'Your story'}
        </Text>
      </Pressable>
      {rings.map((r) => (
        <Pressable
          key={r.authorId}
          accessibilityRole="button"
          accessibilityLabel={`View ${r.username}'s story`}
          onPress={() => router.push({ pathname: '/story/[username]', params: { username: r.username } })}
          style={{ alignItems: 'center', width: w }}
        >
          {card(r.cover ?? r.avatar, r.username)}
          <View style={{ position: 'absolute', left: 0, right: 0, top: h - 52, alignItems: 'center' }}>
            <RingAvatar username={r.username} storageKey={r.avatar} size={44} seen={r.seen} />
          </View>
          <Text numberOfLines={1} style={{ color: r.seen ? colors.textMuted : colors.text, fontSize: fontSize.body, marginTop: 6 }}>
            {r.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
