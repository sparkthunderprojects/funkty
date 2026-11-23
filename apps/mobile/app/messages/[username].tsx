import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { friendlyError } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { isRequest, loadRequestContext } from '../../src/lib/requests';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Msg = { id: string; sender_id: string; body: string; created_at: string };

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
      .select('id, sender_id, body, created_at')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me.id})`)
      .order('id', { ascending: true })
      .limit(300);
    setMessages((data ?? []) as Msg[]);
    // Opening a request does not mark it read, so the sender gets no read signal until it is accepted.
    ctxRef.current ??= await loadRequestContext(me.id);
    const ctx = ctxRef.current;
    const pending = isRequest(ctx, otherId) && (data ?? []).some((m) => m.sender_id === otherId);
    setRequest(pending);
    if (!pending) void supabase.rpc('mark_thread_read', { p_other: otherId });
  }, [me, otherId]);

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
              return (
                <View
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    backgroundColor: mine ? colors.primary : colors.surface,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <Text style={{ color: mine ? colors.onPrimary : colors.text, fontSize: fontSize.body }}>{item.body}</Text>
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
        </>
      )}
    </Screen>
  );
}
