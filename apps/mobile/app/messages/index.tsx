import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { timeAgo } from '../../src/lib/posts';
import { useSession } from '../../src/lib/session';
import { type RequestContext, isRequest, loadRequestContext } from '../../src/lib/requests';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Screen } from '../../src/ui/Screen';

type Chat = { other_id: string; username: string; last_body: string; last_at: string; last_sender: string; unread: number };

export default function Inbox() {
  const { colors, fontSize, spacing } = useTheme();
  const { profile } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<RequestContext | null>(null);
  const [tab, setTab] = useState<'chats' | 'requests'>('chats');

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      void Promise.all([supabase.rpc('inbox'), loadRequestContext(profile.id)]).then(([inbox, context]) => {
        setChats((inbox.data ?? []) as Chat[]);
        setCtx(context);
        setLoading(false);
      });
    }, [profile]),
  );

  // Declined requests stay out of both lists.
  const visible = chats.filter((c) => !ctx?.declined.has(c.other_id) || !isRequest(ctx, c.other_id));
  const requests = ctx ? visible.filter((c) => isRequest(ctx, c.other_id)) : [];
  const shown = tab === 'requests' ? requests : ctx ? visible.filter((c) => !isRequest(ctx, c.other_id)) : visible;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.lg, paddingBottom: spacing.md }}>
        {([['chats', 'Messages'], ['requests', `Requests${requests.length ? ` (${requests.length})` : ''}`]] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}>
            <Text style={{ color: tab === key ? colors.text : colors.textMuted, fontWeight: tab === key ? '800' : '600', fontSize: fontSize.body }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.other_id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.body }}>
              {tab === 'requests'
                ? 'No message requests. Messages from people you do not follow show up here first.'
                : 'No messages yet. Open someone&apos;s profile and tap Message to start a conversation.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/messages/[username]', params: { username: item.username } }} asChild>
            <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar username={item.username} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: item.unread > 0 ? '800' : '700', fontSize: fontSize.body }}>
                  {item.username}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: item.unread > 0 ? colors.text : colors.textMuted, fontSize: fontSize.body }}
                >
                  {item.last_sender === profile?.id ? 'You: ' : ''}
                  {item.last_body} · {timeAgo(item.last_at)}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} accessibilityLabel="Unread" />
              ) : null}
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}
