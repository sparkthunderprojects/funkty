import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Result = { id: string; username: string; display_name: string | null };

export default function Search() {
  const { colors, fontSize, spacing, radius } = useTheme();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);

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
        .select('id, username, display_name')
        .ilike('username', `${clean}%`)
        .order('username')
        .limit(20);
      if (!cancelled) {
        setResults((data ?? []) as Result[]);
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
        label="Search people"
        value={term}
        onChangeText={setTerm}
        placeholder="Search by username"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <Text style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          searched ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No one found with that username.</Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              Type at least two letters of a username.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/user/[username]', params: { username: item.username } }} asChild>
            <Pressable
              accessibilityRole="link"
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: fontSize.body }}>@{item.username}</Text>
              {item.display_name ? (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{item.display_name}</Text>
              ) : null}
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}
