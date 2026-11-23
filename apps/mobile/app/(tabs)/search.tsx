import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { PostGrid } from '../../src/ui/PostGrid';

type Account = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null };
type Tab = 'top' | 'accounts' | 'tags';

/** Letters, numbers, dot and underscore only: nothing here can alter a LIKE pattern or a PostgREST filter. */
const clean = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}._]/gu, '');

export default function Search() {
  const { colors, fontSize, spacing } = useTheme();
  const router = useRouter();
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
    supabase
      .from('posts')
      .select(feedSelect)
      .order('id', { ascending: false })
      .limit(60)
      .then(({ data }) => setExplore((data ?? []) as unknown as FeedPost[]));
  }, []);

  useEffect(() => {
    if (!active) {
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const wordsOnly = query.replace(/[._]/g, '');
      const [people, byCaption, byTag] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
          .or(`username.ilike.${query}%,display_name.ilike.${query}%`)
          .order('username')
          .limit(30),
        supabase.from('posts').select(feedSelect).ilike('caption', `%${wordsOnly || query}%`).order('id', { ascending: false }).limit(60),
        supabase.from('posts').select('caption').ilike('caption', `%#${wordsOnly || query}%`).order('id', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      setAccounts((people.data ?? []) as unknown as Account[]);
      setPosts((byCaption.data ?? []) as unknown as FeedPost[]);
      setTagRows((byTag.data ?? []).map((r) => r.caption ?? ''));
      setSearched(true);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active]);

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
            <ScrollView keyboardShouldPersistTaps="handled">
              {posts.length > 0 ? <PostGrid posts={posts} /> : searched ? <Text style={muted}>No posts found.</Text> : null}
            </ScrollView>
          ) : tab === 'accounts' ? (
            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={searched ? <Text style={muted}>No accounts found.</Text> : undefined}
              renderItem={({ item }) => (
                <Link href={{ pathname: '/user/[username]', params: { username: item.username } }} asChild>
                  <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
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
              ListEmptyComponent={searched ? <Text style={muted}>No tags found.</Text> : undefined}
              renderItem={({ item: [tag, count] }) => (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag } })}
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
        <ScrollView keyboardShouldPersistTaps="handled">
          {explore.length > 0 ? <PostGrid posts={explore} /> : <Text style={muted}>Nothing to explore yet. Posts from everyone appear here.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
