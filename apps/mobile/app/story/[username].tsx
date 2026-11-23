import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl, timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { Avatar } from '../../src/ui/Avatar';
import { StoryViewers } from '../../src/ui/StoryViewers';

type Story = { id: string; created_at: string; media_assets: { storage_key: string } | null };

const durationMs = 5000;

export default function StoryViewer() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useSession();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [views, setViews] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const started = useRef(0);
  const progressRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: person } = await supabase
        .from('profiles')
        .select('id, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .eq('username', String(username).toLowerCase())
        .maybeSingle();
      if (!person || cancelled) return setLoading(false);
      setAuthorId(person.id);
      setAvatar((person as unknown as { avatar: { storage_key: string } | null }).avatar?.storage_key ?? null);
      const { data } = await supabase
        .from('stories')
        .select('id, created_at, media_assets(storage_key)')
        .eq('author_id', person.id)
        .gt('expires_at', new Date().toISOString())
        .order('id', { ascending: true });
      if (cancelled) return;
      setStories((data ?? []) as unknown as Story[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const current = stories[index];
  const isMine = !!me && authorId === me.id;

  const next = useCallback(() => {
    if (index < stories.length - 1) setIndex(index + 1);
    else router.back();
  }, [index, stories.length, router]);

  // Record the view and load the view count for the author.
  useEffect(() => {
    if (!current || !me) return;
    if (isMine) {
      supabase
        .from('story_views')
        .select('viewer_id', { count: 'exact', head: true })
        .eq('story_id', current.id)
        .then(({ count }) => setViews(count ?? 0));
    } else {
      void supabase.rpc('view_story', { p_story_id: current.id });
    }
  }, [current, me, isMine]);

  // Restart the progress bar whenever the story changes.
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
  }, [current?.id]);

  // Auto-advance with a progress bar. Pauses while the viewers list is open.
  useEffect(() => {
    if (!current || showViewers) return;
    started.current = Date.now() - progressRef.current * durationMs;
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - started.current) / durationMs);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        next();
      }
    }, 100);
    return () => clearInterval(tick);
  }, [current, next, showViewers]);

  async function remove() {
    if (!current) return;
    await supabase.rpc('delete_story', { p_story_id: current.id });
    const rest = stories.filter((s) => s.id !== current.id);
    if (rest.length === 0) router.back();
    else {
      setStories(rest);
      setIndex(Math.min(index, rest.length - 1));
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!current) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>This story is no longer available.</Text>
        <Text accessibilityRole="button" onPress={() => router.back()} style={{ color: '#fff', textAlign: 'center', marginTop: 16, fontWeight: '700' }}>
          Close
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {current.media_assets ? (
        <Image
          source={{ uri: mediaUrl(current.media_assets.storage_key) }}
          accessibilityLabel={`Story by ${username}`}
          style={{ flex: 1 }}
          contentFit="contain"
        />
      ) : null}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
        <Pressable
          accessibilityLabel="Previous story"
          style={{ flex: 1 }}
          onPress={() => (index > 0 ? setIndex(index - 1) : router.back())}
        />
        <Pressable accessibilityLabel="Next story" style={{ flex: 2 }} onPress={next} />
      </View>
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 }}>
          {stories.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' }}>
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#fff',
                  width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
          <Avatar username={String(username)} storageKey={avatar} size={32} />
          <Text style={{ color: '#fff', fontWeight: '700' }}>{username}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{timeAgo(current.created_at)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
      {isMine ? (
        <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="See who viewed this story" onPress={() => setShowViewers(true)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {views ?? 0} {views === 1 ? 'view' : 'views'}
              </Text>
            </Pressable>
            <Text accessibilityRole="button" onPress={remove} style={{ color: '#fff', fontWeight: '700' }}>
              Delete
            </Text>
          </View>
        </SafeAreaView>
      ) : null}
      {isMine ? <StoryViewers storyId={current.id} visible={showViewers} onClose={() => setShowViewers(false)} /> : null}
    </View>
  );
}
