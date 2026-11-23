import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { type FeedPost, feedSelect, friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { PostCard } from '../../src/ui/PostCard';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Comment = { id: string; body: string; created_at: string; author_id: string; profiles: { username: string } | null };

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [postRes, likeRes, commentRes] = await Promise.all([
      supabase.from('posts').select(feedSelect).eq('id', id).maybeSingle(),
      supabase.from('likes').select('post_id').eq('user_id', profile.id).eq('post_id', id).maybeSingle(),
      supabase
        .from('comments')
        .select('id, body, created_at, author_id, profiles(username)')
        .eq('post_id', id)
        .order('id', { ascending: true })
        .limit(200),
    ]);
    setPost((postRes.data as unknown as FeedPost) ?? null);
    setLiked(!!likeRes.data);
    setComments((commentRes.data ?? []) as unknown as Comment[]);
    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!body.trim() || !id) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('add_comment', { p_post_id: id, p_body: body.trim() });
    setBusy(false);
    if (rpcError) {
      setError(friendlyError(rpcError.message));
      return;
    }
    setBody('');
    void load();
  }

  async function remove(commentId: string) {
    await supabase.rpc('delete_comment', { p_comment_id: commentId });
    void load();
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!post) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
          This post is not available. It may have been removed.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -spacing.lg, marginBottom: spacing.md }}>
            <PostCard post={post} liked={liked} />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No comments yet. Start the conversation.</Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: fontSize.body, flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>@{item.profiles?.username ?? 'unknown'} </Text>
              {item.body}
            </Text>
            {item.author_id === profile?.id || post.author_id === profile?.id ? (
              <Text
                accessibilityRole="button"
                onPress={() => remove(item.id)}
                style={{ color: colors.textMuted, fontSize: fontSize.caption }}
              >
                Delete
              </Text>
            ) : null}
          </View>
        )}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSize.body }}>
          {error}
        </Text>
      ) : null}
      <TextField label="Add a comment" value={body} onChangeText={setBody} placeholder="Say something nice…" maxLength={2200} />
      <Button label="Post comment" onPress={send} loading={busy} disabled={!body.trim()} />
    </Screen>
  );
}
