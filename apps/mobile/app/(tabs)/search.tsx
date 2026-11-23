import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { addRecent, clearRecent, loadRecent, removeRecent } from '../../src/lib/recent';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTabBarSpace } from '../../src/ui/layout';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { PostGrid } from '../../src/ui/PostGrid';

type Account = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null };
type Tab = 'top' | 'accounts' | 'tags';

/** Letters, numbers, dot and underscore only: nothing here can alter a LIKE pattern or a PostgREST filter. */
const clean = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}._]/gu, '');

export default function Search() {
  const { colors, fontSize, spacing } = useTheme();
  const tabSpace = useTabBarSpace();
  const router = useRouter();
  const { profile } = useSession();
  const [recent, setRecent] = useState<string[]>([]);
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<Tab>('top');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [tagRows, setTagRows] = useState<string[]>([]);
  const [explore, setExplore] = useState<FeedPost[]>([]);
  const [searched, setSearched] = useState(false);
  const query = clean(term);
  const active = query.length >= 2;

  useEffect(() => {
    if (profile) loadRecent(profile.id).then(setRecent);
  }, [profile]);

  const remember = (value: string) => {
    if (profile) addRecent(profile.id, value).then(setRecent);
  };

  // Explore: ranked by engagement and freshness on the server. Falls back to the latest posts when nothing ranks.
  useEffect(() => {
    void (async () => {
      const ranked = await supabase.rpc('explore_posts', { p_limit: 60 });
      const ids = (ranked.data ?? []).map((r) => r.post_id);
      if (ids.length > 0) {
        const { data } = await supabase.from('posts').select(feedSelect).in('id', ids);
        const byId = new Map(((data ?? []) as unknown as FeedPost[]).map((p) => [p.id, p]));
        setExplore(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
        return;
      }
      const { data } = await supabase.from('posts').select(feedSelect).order('id', { ascending: false }).limit(60);
      setExplore((data ?? []) as unknown as FeedPost[]);
    })();
  }, []);

  useEffect(() => {
    if (!active) {
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const wordsOnly = query.replace(/[._]/g, '');
      const [people, byCaption, byTag, byAlt] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
          .or(`username.ilike.${query}%,display_name.ilike.${query}%`)
          .order('username')
          .limit(30),
        supabase.from('posts').select(feedSelect).ilike('caption', `%${wordsOnly || query}%`).order('id', { ascending: false }).limit(60),
        supabase.from('posts').select('caption').ilike('caption', `%#${wordsOnly || query}%`).order('id', { ascending: false }).limit(100),
        // Photos are also found by what their alt text describes.
        supabase.from('post_media').select('post_id').ilike('alt_text', `%${wordsOnly || query}%`).limit(60),
      ]);
      const altIds = [...new Set((byAlt.data ?? []).map((r) => r.post_id))];
      const altPosts = altIds.length
        ? await supabase.from('posts').select(feedSelect).in('id', altIds).order('id', { ascending: false })
        : { data: [] };
      // Posts the user saved with a matching private note (saves are only readable by their owner).
      const noteRows = profile
        ? await supabase.from('saves').select('post_id').eq('user_id', profile.id).ilike('note', `%${wordsOnly || query}%`).limit(60)
        : { data: [] as { post_id: string }[] };
      const noteIds = (noteRows.data ?? []).map((r) => r.post_id);
      const notePosts = noteIds.length
        ? await supabase.from('posts').select(feedSelect).in('id', noteIds).order('id', { ascending: false })
        : { data: [] };
      if (cancelled) return;
      setAccounts((people.data ?? []) as unknown as Account[]);
      const seen = new Set<string>();
      setPosts(
        [...((byCaption.data ?? []) as unknown as FeedPost[]), ...((altPosts.data ?? []) as unknown as FeedPost[]), ...((notePosts.data ?? []) as unknown as FeedPost[])].filter((p) =>
          seen.has(p.id) ? false : (seen.add(p.id), true),
        ),
      );
      setTagRows((byTag.data ?? []).map((r) => r.caption ?? ''));
      setSearched(true);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active, profile]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const caption of tagRows) {
      for (const m of caption.toLowerCase().matchAll(/#([\p{L}\p{N}_]+)/gu)) {
        if (m[1] && m[1].includes(query.replace(/[._]/g, ''))) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [tagRows, query]);

  const muted = { color: colors.textMuted, fontSize: fontSize.body, padding: spacing.md } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        {term.length > 0 ? (
          <Pressable accessibilityLabel="Clear search" onPress={() => setTerm('')} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 38 }}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search"
            value={term}
            onChangeText={setTerm}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => remember(term)}
            style={{ flex: 1, color: colors.text, fontSize: 16, outlineStyle: 'none' } as never}
          />
          {term.length > 0 ? (
            <Pressable accessibilityLabel="Clear" onPress={() => setTerm('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {active ? (
        <>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }}>
            {([['top', 'Top'], ['accounts', 'Accounts'], ['tags', 'Tags']] as const).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: tab === key ? colors.text : 'transparent', marginBottom: -1 }}
              >
                <Text style={{ color: tab === key ? colors.text : colors.textMuted, fontWeight: tab === key ? '600' : '400', fontSize: 14 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'top' ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: tabSpace }}>
              {posts.length > 0 ? <PostGrid posts={posts} /> : searched ? <Text style={muted}>No posts found.</Text> : null}
            </ScrollView>
          ) : tab === 'accounts' ? (
            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: tabSpace }}
              ListEmptyComponent={searched ? <Text style={muted}>No accounts found.</Text> : undefined}
              renderItem={({ item }) => (
                <Link href={{ pathname: '/user/[username]', params: { username: item.username } }} asChild>
                  <Pressable accessibilityRole="link" onPress={() => remember(term)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
                    <Avatar username={item.username} storageKey={item.avatar?.storage_key} size={56} />
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{item.username}</Text>
                      {item.display_name ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{item.display_name}</Text> : null}
                    </View>
                  </Pressable>
                </Link>
              )}
            />
          ) : (
            <FlatList
              data={tags}
              keyExtractor={([t]) => t}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: tabSpace }}
              ListEmptyComponent={searched ? <Text style={muted}>No tags found.</Text> : undefined}
              renderItem={({ item: [tag, count] }) => (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    remember(term);
                    router.push({ pathname: '/tag/[tag]', params: { tag } });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 }}
                >
                  <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="pricetag-outline" size={22} color={colors.text} />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>#{tag}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>{count} {count === 1 ? 'post' : 'posts'}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: tabSpace }}>
          {recent.length > 0 ? (
            <View style={{ paddingBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Recent</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear all recent searches"
                  onPress={() => {
                    if (profile) clearRecent(profile.id);
                    setRecent([]);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Clear all</Text>
                </Pressable>
              </View>
              {recent.map((r) => (
                <View key={r} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }}>
                  <Pressable accessibilityRole="button" onPress={() => setTerm(r)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 }}>
                    <Ionicons name="time-outline" size={22} color={colors.textMuted} />
                    <Text style={{ color: colors.text, fontSize: 15 }}>{r}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${r}`}
                    onPress={() => {
                      if (profile) removeRecent(profile.id, r).then(setRecent);
                    }}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {explore.length > 0 ? <PostGrid posts={explore} /> : <Text style={muted}>Nothing to explore yet. Posts from everyone appear here.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
