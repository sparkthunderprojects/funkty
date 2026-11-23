import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { type FeedPost, feedSelect, friendlyError, timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Button } from '../../src/ui/Button';
import { PostCard } from '../../src/ui/PostCard';
import { Screen } from '../../src/ui/Screen';
import { useMemo } from 'react';

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  profiles: { username: string; avatar: { storage_key: string } | null } | null;
};

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
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [postRes, likeRes, saveRes, commentRes] = await Promise.all([
      supabase.from('posts').select(feedSelect).eq('id', id).maybeSingle(),
      supabase.from('likes').select('post_id').eq('user_id', profile.id).eq('post_id', id).maybeSingle(),
      supabase.from('saves').select('post_id').eq('user_id', profile.id).eq('post_id', id).maybeSingle(),
      supabase
        .from('comments')
        .select('id, body, created_at, author_id, parent_id, profiles!comments_author_id_fkey(username, avatar:media_assets!profiles_avatar_media_fk(storage_key))')
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
    const { error: rpcError } = await supabase.rpc('add_comment', {
      p_post_id: id,
      p_body: body.trim(),
      ...(replyTo ? { p_parent_id: replyTo.id } : {}),
    });
    setBusy(false);
    if (rpcError) {
      setError(friendlyError(rpcError.message));
      return;
    }
    if (replyTo) setOpen((o) => new Set(o).add(replyTo.id));
    setBody('');
    setReplyTo(null);
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

  const threads = useMemo(() => {
    const replies = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
    }
    return { top: comments.filter((c) => !c.parent_id), replies };
  }, [comments]);

  function row(item: Comment, reply: boolean) {
    const canDelete = item.author_id === profile?.id || post?.author_id === profile?.id;
    return (
      <View key={item.id} style={{ flexDirection: 'row', gap: 10, marginLeft: reply ? 46 : 0, paddingVertical: 6 }}>
        <Avatar username={item.profiles?.username ?? '?'} storageKey={item.profiles?.avatar?.storage_key} size={reply ? 24 : 34} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            <Text style={{ fontWeight: '600' }}>{item.profiles?.username ?? 'unknown'} </Text>
            {item.body}
          </Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{timeAgo(item.created_at)}</Text>
            <Text
              accessibilityRole="button"
              onPress={() => {
                // Replies are one level deep, so replying to a reply addresses the same thread.
                setReplyTo({ id: item.parent_id ?? item.id, username: item.profiles?.username ?? '' });
                setBody(`@${item.profiles?.username ?? ''} `);
              }}
              style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}
            >
              Reply
            </Text>
            {canDelete ? (
              <Text accessibilityRole="button" onPress={() => remove(item.id)} style={{ color: colors.textMuted, fontSize: 12 }}>
                Delete
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
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
      <View>
        {threads.top.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>No comments yet. Start the conversation.</Text>
        ) : (
          threads.top.map((item) => {
            const replies = threads.replies.get(item.id) ?? [];
            const shown = open.has(item.id);
            return (
              <View key={item.id}>
                {row(item, false)}
                {replies.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setOpen((o) => {
                        const next = new Set(o);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    style={{ marginLeft: 46, paddingVertical: 4 }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                      {shown ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                    </Text>
                  </Pressable>
                ) : null}
                {shown ? replies.map((r) => row(r, true)) : null}
              </View>
            );
          })
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
      {replyTo ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Replying to {replyTo.username}</Text>
          <Text
            accessibilityRole="button"
            onPress={() => {
              setReplyTo(null);
              setBody('');
            }}
            style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}
          >
            Cancel
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm }}>
        <Avatar username={profile?.username ?? '?'} size={34} />
        <TextInput
          accessibilityLabel="Add a comment"
          value={body}
          onChangeText={setBody}
          placeholder={replyTo ? `Reply to ${replyTo.username}…` : 'Add a comment…'}
          placeholderTextColor={colors.textMuted}
          maxLength={2200}
          style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8, outlineStyle: 'none' } as never}
        />
        <Text
          accessibilityRole="button"
          onPress={busy || !body.trim() ? undefined : send}
          style={{ color: colors.primary, fontWeight: '600', fontSize: 15, opacity: busy || !body.trim() ? 0.4 : 1 }}
        >
          Post
        </Text>
      </View>
    </Screen>
  );
}
