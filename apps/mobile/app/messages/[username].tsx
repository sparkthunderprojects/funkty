import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { tap } from '../../src/lib/haptics';
import { ActionSheet } from '../../src/ui/ActionSheet';
import { friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { isRequest, loadRequestContext } from '../../src/lib/requests';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Msg = { id: string; sender_id: string; body: string; created_at: string; story_id: string | null; unsent_at: string | null };
const emojis = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

export default function Thread() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useSession();
  const router = useRouter();
  const { colors, fontSize, spacing, radius } = useTheme();
  const [otherId, setOtherId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { user_id: string; emoji: string }[]>>({});
  const [picked, setPicked] = useState<Msg | null>(null);
  const ctxRef = useRef<Awaited<ReturnType<typeof loadRequestContext>> | null>(null);
  const list = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id')
      .eq('username', String(username).toLowerCase())
      .maybeSingle()
      .then(({ data }) => (data ? setOtherId(data.id) : setMissing(true)));
  }, [username]);

  const load = useCallback(async () => {
    if (!me || !otherId) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, story_id, unsent_at')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me.id})`)
      .order('id', { ascending: true })
      .limit(300);
    setMessages((data ?? []) as Msg[]);
    const ids = (data ?? []).map((m) => m.id);
    if (ids.length > 0) {
      const { data: rx } = await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', ids);
      const grouped: Record<string, { user_id: string; emoji: string }[]> = {};
      for (const r of rx ?? []) (grouped[r.message_id] ??= []).push({ user_id: r.user_id, emoji: r.emoji });
      setReactions(grouped);
    }
    // Opening a request does not mark it read, so the sender gets no read signal until it is accepted.
    ctxRef.current ??= await loadRequestContext(me.id);
    const ctx = ctxRef.current;
    const pending = isRequest(ctx, otherId) && (data ?? []).some((m) => m.sender_id === otherId);
    setRequest(pending);
    if (!pending) void supabase.rpc('mark_thread_read', { p_other: otherId });
  }, [me, otherId]);

  async function react(msg: Msg, emoji: string | null) {
    tap();
    setPicked(null);
    const { error: e } = await supabase.rpc('react_message', { p_message: msg.id, p_emoji: emoji });
    if (e) setError(friendlyError(e.message));
    void load();
  }

  async function unsend(msg: Msg) {
    setPicked(null);
    const { error: e } = await supabase.rpc('unsend_message', { p_message: msg.id });
    if (e) setError(friendlyError(e.message));
    void load();
  }

  async function decide(accept: boolean) {
    if (!otherId) return;
    await supabase.rpc('decide_message_request', { p_other: otherId, p_accept: accept });
    ctxRef.current = null;
    if (accept) void load();
    else router.back();
  }

  // Polling keeps the thread fresh; Realtime replaces this once the load test is done.
  useEffect(() => {
    void load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  async function send() {
    if (!otherId || !body.trim()) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('send_message', { p_recipient: otherId, p_body: body });
    setBusy(false);
    if (rpcError) return setError(friendlyError(rpcError.message));
    setBody('');
    void load();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: String(username) }} />
      {missing ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>This account does not exist.</Text>
      ) : (
        <>
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>Say hello to {username}.</Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === me?.id;
              const unsent = !!item.unsent_at;
              const rx = reactions[item.id] ?? [];
              return (
                <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={unsent ? 'Unsent message' : 'Message options'}
                    disabled={unsent}
                    onLongPress={() => setPicked(item)}
                    style={{
                      backgroundColor: unsent ? 'transparent' : mine ? colors.primary : colors.surface,
                      borderWidth: unsent ? 1 : 0,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                    }}
                  >
                    {item.story_id && !unsent ? (
                      <Text style={{ color: mine ? colors.onPrimary : colors.textMuted, fontSize: 12, marginBottom: 2 }}>
                        {mine ? 'You replied to their story' : 'Replied to your story'}
                      </Text>
                    ) : null}
                    <Text style={{ color: unsent ? colors.textMuted : mine ? colors.onPrimary : colors.text, fontSize: fontSize.body, fontStyle: unsent ? 'italic' : 'normal' }}>
                      {item.body}
                    </Text>
                  </Pressable>
                  {rx.length > 0 ? (
                    <Text accessibilityLabel={`Reactions: ${rx.map((r) => r.emoji).join(' ')}`} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: -6, marginHorizontal: 8, fontSize: 14, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 6, overflow: 'hidden' }}>
                      {rx.map((r) => r.emoji).join('')}
                    </Text>
                  ) : null}
                </View>
              );
            }}
          />
          {request ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                {username} is not someone you follow. They cannot see that you have read this until you accept.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}><Button label="Accept" onPress={() => void decide(true)} /></View>
                <View style={{ flex: 1 }}><Button label="Delete" variant="secondary" onPress={() => void decide(false)} /></View>
              </View>
            </View>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSize.body }}>
              {error}
            </Text>
          ) : null}
          <TextField label="Message" value={body} onChangeText={setBody} placeholder="Message…" maxLength={2000} />
          <Button label="Send" onPress={send} loading={busy} disabled={!body.trim()} />
          <ActionSheet
            visible={!!picked}
            onClose={() => setPicked(null)}
            actions={
              picked
                ? [
                    ...emojis.map((e) => ({ label: `React ${e}`, onPress: () => void react(picked, e) })),
                    ...((reactions[picked.id] ?? []).some((r) => r.user_id === me?.id) ? [{ label: 'Remove my reaction', onPress: () => void react(picked, null) }] : []),
                    ...(picked.sender_id === me?.id ? [{ label: 'Unsend', onPress: () => void unsend(picked), destructive: true }] : []),
                    { label: 'Cancel', onPress: () => setPicked(null) },
                  ]
                : []
            }
          />
        </>
      )}
    </Screen>
  );
}
