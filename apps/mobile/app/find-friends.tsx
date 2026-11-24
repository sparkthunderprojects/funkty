import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tap } from '../src/lib/haptics';
import { inviteChannels, inviteUrl, inviteVia, inviteWithSheet } from '../src/lib/invite';
import { contactsSupported, findContacts } from '../src/lib/contacts';
import { loadMuted } from '../src/lib/mutes';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/theme';
import { Avatar } from '../src/ui/Avatar';
import { DiscoverSwitch } from '../src/ui/DiscoverSwitch';

type Person = { id: string; username: string; display_name: string | null; avatar: { storage_key: string } | null; note?: string };
const select = 'id, username, display_name, avatar:media_assets!profiles_avatar_media_fk(storage_key)';
const clean = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}._]/gu, '');

export default function FindFriends() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [suggested, setSuggested] = useState<Person[]>([]);
  const [followBack, setFollowBack] = useState<Person[]>([]);
  const [state, setState] = useState<Record<string, 'active' | 'pending'>>({});
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Person[] | null>(null);
  const [contactsMsg, setContactsMsg] = useState<string | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const query = clean(term);

  const load = useCallback(async () => {
    if (!profile) return;
    const [sugg, followers, following, blocks, muted] = await Promise.all([
      supabase.rpc('friend_suggestions', { p_limit: 20 }),
      supabase.from('follows').select('follower_id').eq('followee_id', profile.id).eq('state', 'active').limit(200),
      supabase.from('follows').select('followee_id').eq('follower_id', profile.id).limit(500),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id),
      loadMuted(profile.id),
    ]);
    const mutual = new Map((sugg.data ?? []).map((r) => [r.user_id, r.mutual_count]));
    const iFollow = new Set((following.data ?? []).map((f) => f.followee_id));
    const skip = new Set([...(blocks.data ?? []).map((b) => b.blocked_id), ...muted]);
    const backIds = (followers.data ?? []).map((f) => f.follower_id).filter((id) => !iFollow.has(id) && !skip.has(id)).slice(0, 20);
    const ids = [...new Set([...mutual.keys(), ...backIds])];
    if (ids.length === 0) return;
    const { data } = await supabase.from('profiles').select(select).in('id', ids);
    const byId = new Map(((data ?? []) as unknown as Person[]).map((p) => [p.id, p]));
    setSuggested([...mutual.keys()].flatMap((id) => (byId.has(id) ? [{ ...byId.get(id)!, note: `${mutual.get(id)} mutual ${mutual.get(id) === 1 ? 'connection' : 'connections'}` }] : [])));
    setFollowBack(backIds.flatMap((id) => (byId.has(id) ? [{ ...byId.get(id)!, note: 'Follows you' }] : [])));
  }, [profile]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select(select)
        .or(`username.ilike.${query}%,display_name.ilike.%${query}%`)
        .neq('id', profile?.id ?? '')
        .limit(20);
      setResults((data ?? []) as unknown as Person[]);
    }, 250);
    return () => clearTimeout(t);
  }, [query, profile]);

  async function follow(id: string) {
    tap();
    const { data, error } = await supabase.rpc('follow_user', { p_target: id });
    if (!error && (data === 'active' || data === 'pending')) setState((s) => ({ ...s, [id]: data }));
  }

  async function runContacts() {
    setSearching(true);
    setContactsMsg(null);
    const r = await findContacts();
    if (!r.ok) {
      setSearching(false);
      setContactsMsg(
        r.reason === 'denied' ? 'Funkty needs permission to read your contacts. You can allow it in your phone settings.'
        : r.reason === 'unsupported' ? 'Find contacts works in the phone app.'
        : r.reason === 'rate_limited' ? 'You have searched a lot today. Try again tomorrow.'
        : 'Something went wrong. Try again.',
      );
      return;
    }
    const following = await supabase.from('follows').select('followee_id').eq('follower_id', profile!.id);
    const already = new Set((following.data ?? []).map((f) => f.followee_id));
    const ids = r.ids.filter((id) => !already.has(id));
    if (ids.length === 0) {
      setContacts([]);
    } else {
      const { data } = await supabase.from('profiles').select(select).in('id', ids);
      setContacts(((data ?? []) as unknown as Person[]).map((p) => ({ ...p, note: 'In your contacts' })));
    }
    setSearching(false);
  }

  if (!profile) return null;

  const PersonRow = ({ p }: { p: Person }) => {
    const s = state[p.id];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8, paddingHorizontal: spacing.lg }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View ${p.username}`}
          onPress={() => router.push({ pathname: '/user/[username]', params: { username: p.username } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}
        >
          <Avatar username={p.username} storageKey={p.avatar?.storage_key} size={48} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{p.username}</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>{p.note ?? p.display_name ?? ''}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s ? `Followed ${p.username}` : `Follow ${p.username}`}
          disabled={!!s}
          onPress={() => void follow(p.id)}
          style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: s ? colors.surface : colors.primary }}
        >
          <Text style={{ color: s ? colors.text : colors.onPrimary, fontWeight: '600' }}>{s === 'pending' ? 'Requested' : s === 'active' ? 'Following' : 'Follow'}</Text>
        </Pressable>
      </View>
    );
  };

  const Heading = ({ children }: { children: string }) => (
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4 }}>{children}</Text>
  );

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ margin: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search by name or username"
          placeholder="Search by name or username"
          placeholderTextColor={colors.textMuted}
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: colors.text, paddingVertical: 12, fontSize: 16 }}
        />
      </View>
      {query.length >= 2 ? (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <PersonRow p={item} />}
          ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.lg }}>No one found.</Text>}
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use QR code"
            onPress={() => router.push('/qr')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 }}
          >
            <Ionicons name="qr-code-outline" size={26} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Use QR code</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Show or scan each other's QR codes.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {contactsSupported ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: 12, gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find contacts"
                onPress={() => setContactsOpen((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
              >
                <Ionicons name="people-outline" size={26} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Find contacts</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>See which of your contacts are on Funkty.</Text>
                </View>
                <Ionicons name={contactsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>
              {contactsOpen ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: spacing.md }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    Funkty reads the email addresses in your contacts on your phone, scrambles them, and only the scrambled versions are sent. Names and numbers never leave your phone, and nothing is saved. You only see people who chose to be found.
                  </Text>
                  <Pressable accessibilityRole="button" disabled={searching} onPress={() => void runContacts()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', opacity: searching ? 0.6 : 1 }}>
                    <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{searching ? 'Looking…' : 'Find my contacts'}</Text>
                  </Pressable>
                  {contactsMsg ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{contactsMsg}</Text> : null}
                  <DiscoverSwitch />
                </View>
              ) : null}
              {contacts ? (
                contacts.length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>No one new from your contacts yet. Invite them below.</Text>
                ) : (
                  <View style={{ marginHorizontal: -spacing.lg }}>
                    <Heading>From your contacts</Heading>
                    {contacts.map((p) => <PersonRow key={p.id} p={p} />)}
                  </View>
                )
              ) : null}
            </View>
          ) : null}

          <Heading>Invite friends</Heading>
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>Share your profile so friends can find you.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {inviteChannels.map((c) => (
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`Invite with ${c.label}`} onPress={() => void inviteVia(c.key, profile.username)} style={{ alignItems: 'center', gap: 6, width: 68 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={c.icon} size={24} color={colors.text} />
                </View>
                <Text style={{ color: colors.text, fontSize: 12 }}>{c.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
              onPress={async () => {
                await Clipboard.setStringAsync(inviteUrl(profile.username));
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              style={{ alignItems: 'center', gap: 6, width: 68 }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={24} color={colors.text} />
              </View>
              <Text style={{ color: colors.text, fontSize: 12 }}>{copied ? 'Copied' : 'Copy link'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="More ways to share" onPress={() => void inviteWithSheet(profile.username)} style={{ alignItems: 'center', gap: 6, width: 68 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.onPrimary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 12 }}>More</Text>
            </Pressable>
          </ScrollView>

          {followBack.length > 0 ? <Heading>Follow back</Heading> : null}
          {followBack.map((p) => <PersonRow key={p.id} p={p} />)}
          {suggested.length > 0 ? <Heading>People you may know</Heading> : null}
          {suggested.map((p) => <PersonRow key={p.id} p={p} />)}
          {followBack.length === 0 && suggested.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl }}>Follow a few people and suggestions will appear here.</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
