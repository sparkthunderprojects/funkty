import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { type FeedPost, feedSelect, friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { PostCard } from '../../src/ui/PostCard';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Comment = { id: string; body: string; created_at: string; author_id: string; profiles: { username: string } | null };

const reportReasons: [string, string][] = [
  ['spam', 'Spam'],
  ['nudity_sexual', 'Nudity or sexual content'],
  ['harassment', 'Bullying or harassment'],
  ['hate_speech', 'Hate speech'],
  ['violence', 'Violence'],
  ['self_harm', 'Self-harm'],
  ['other', 'Something else'],
];

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const { colors, fontSize, spacing } = useTheme();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [postRes, likeRes, saveRes, commentRes] = await Promise.all([
      supabase.from('posts').select(feedSelect).eq('id', id).maybeSingle(),
      supabase.from('likes').select('post_id').eq('user_id', profile.id).eq('post_id', id).maybeSingle(),
      supabase.from('saves').select('post_id').eq('user_id', profile.id).eq('post_id', id).maybeSingle(),
      supabase
        .from('comments')
        .select('id, body, created_at, author_id, profiles!comments_author_id_fkey(username)')
        .eq('post_id', id)
        .order('id', { ascending: true })
        .limit(200),
    ]);
    setPost((postRes.data as unknown as FeedPost) ?? null);
    setLiked(!!likeRes.data);
    setSaved(!!saveRes.data);
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

  async function deletePost() {
    if (!id) return;
    await supabase.rpc('delete_post', { p_post_id: id });
    router.back();
  }

  async function report(code: string) {
    if (!id) return;
    await supabase.rpc('report_content', { p_target_type: 'post', p_target_id: id, p_reason_code: code });
    setReporting(false);
    setReported(true);
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
    <Screen scroll>
      <View style={{ marginHorizontal: -spacing.lg }}>
        <PostCard post={post} liked={liked} saved={saved} />
      </View>
      <View style={{ gap: spacing.sm }}>
        {comments.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No comments yet. Start the conversation.</Text>
        ) : (
          comments.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <Text style={{ color: colors.text, fontSize: fontSize.body, flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.profiles?.username ?? 'unknown'} </Text>
                {item.body}
              </Text>
              {item.author_id === profile?.id || post.author_id === profile?.id ? (
                <Text accessibilityRole="button" onPress={() => remove(item.id)} style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
                  Delete
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
      {post.author_id === profile?.id ? (
        confirmDelete ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: fontSize.body, flex: 1 }}>Delete this post for good?</Text>
            <View style={{ width: 90 }}>
              <Button label="Delete" onPress={deletePost} />
            </View>
            <View style={{ width: 90 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Text accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
            Delete post
          </Text>
        )
      ) : reported ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>Thanks. We will review this post.</Text>
      ) : reporting ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '700' }}>Why are you reporting this?</Text>
          {reportReasons.map(([code, label]) => (
            <Text key={code} accessibilityRole="button" onPress={() => report(code)} style={{ color: colors.primary, fontSize: fontSize.body }}>
              {label}
            </Text>
          ))}
        </View>
      ) : (
        <Text accessibilityRole="button" onPress={() => setReporting(true)} style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
          Report post
        </Text>
      )}
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
