import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../../src/lib/haptics';
import { friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

type Controls = { require: boolean; words: string[]; reposts: boolean };

export default function CommentControls() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [c, setC] = useState<Controls>({ require: false, words: [], reposts: true });
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('account_controls').select('require_comment_approval, comment_words, allow_reposts').eq('user_id', profile.id).maybeSingle();
    if (data) setC({ require: data.require_comment_approval, words: data.comment_words, reposts: data.allow_reposts });
  }, [profile]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: Controls) {
    const prev = c;
    setC(next);
    setError(null);
    const { error: e } = await supabase.rpc('set_account_controls', { p_require_approval: next.require, p_words: next.words, p_allow_reposts: next.reposts });
    if (e) {
      setC(prev);
      setError(friendlyError(e.message));
    } else tap();
  }
  function addWords() {
    const add = input.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (add.length === 0) return;
    setInput('');
    void save({ ...c, words: Array.from(new Set([...c.words, ...add])) });
  }
  const heading = { color: colors.text, fontSize: 17, fontWeight: '700' } as const;
  const muted = { color: colors.textMuted, fontSize: 14 } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...heading, flex: 1 }}>Approve comments first</Text>
            <Switch accessibilityLabel="Approve comments first" value={c.require} onValueChange={(v) => void save({ ...c, require: v })} />
          </View>
          <Text style={muted}>Comments on your posts wait for you to approve them. Open a post to approve or remove them. People only see their own comment while it waits.</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={heading}>Hidden words</Text>
          <Text style={muted}>Comments that contain these words or phrases are held for your approval, even if approval is off.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="Words to hold"
              placeholder="word, another phrase"
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={addWords}
              style={{ flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 }}
            />
            <Pressable accessibilityRole="button" onPress={addWords} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}>
              <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Add</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {c.words.map((w) => (
              <Pressable key={w} accessibilityRole="button" accessibilityLabel={`Stop holding ${w}`} onPress={() => void save({ ...c, words: c.words.filter((x) => x !== w) })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
                <Text style={{ color: colors.text }}>{w}</Text>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...heading, flex: 1 }}>Allow reposts</Text>
            <Switch accessibilityLabel="Allow reposts" value={c.reposts} onValueChange={(v) => void save({ ...c, reposts: v })} />
          </View>
          <Text style={muted}>When off, other people can't repost your posts to their followers. Existing reposts stay until they remove them.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
