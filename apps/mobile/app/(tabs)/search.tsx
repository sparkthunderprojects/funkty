import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { type FeedPost, feedSelect } from '../../src/lib/posts';
import { PostGrid } from '../../src/ui/PostGrid';
import { Avatar } from '../../src/ui/Avatar';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Result = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null };

export default function Search() {
  const { colors, fontSize, spacing, radius } = useTheme();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [explore, setExplore] = useState<FeedPost[]>([]);

  useEffect(() => {
    supabase
      .from('posts')
      .select(feedSelect)
      .order('id', { ascending: false })
      .limit(60)
      .then(({ data }) => setExplore((data ?? []) as unknown as FeedPost[]));
  }, []);

  useEffect(() => {
    // Strip characters that have meaning in LIKE patterns or PostgREST filters.
    const clean = term.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (clean.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)')
        .ilike('username', `${clean}%`)
        .order('username')
        .limit(20);
      if (!cancelled) {
        setResults((data ?? []) as unknown as Result[]);
        setSearched(true);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <Screen>
      <TextField
        label="Search"
        value={term}
        onChangeText={setTerm}
        placeholder="Search by username"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {term.trim().length < 2 ? (
        <FlatList
          data={[0]}
          keyExtractor={() => 'explore'}
          renderItem={() =>
            explore.length > 0 ? (
              <PostGrid posts={explore} />
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
                Nothing to explore yet. Posts from everyone appear here.
              </Text>
            )
          }
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            searched ? (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No one found with that username.</Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/user/[username]', params: { username: item.username } }} asChild>
              <Pressable
                accessibilityRole="link"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }}
              >
                <Avatar username={item.username} storageKey={item.avatar?.storage_key} size={44} />
                <View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>@{item.username}</Text>
                  {item.display_name ? <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{item.display_name}</Text> : null}
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </Screen>
  );
}
