import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { tap } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';

type SheetProps = { postId: string; visible: boolean; onClose: () => void };

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', padding: spacing.md }}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NewRow({ placeholder, onCreate, error }: { placeholder: string; onCreate: (name: string) => Promise<void>; error: string | null }) {
  const { colors, spacing } = useTheme();
  const [name, setName] = useState('');
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          accessibilityLabel={placeholder}
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          style={{ flex: 1, color: colors.text, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, outlineStyle: 'none' } as never}
        />
        <Text
          accessibilityRole="button"
          onPress={async () => {
            if (!name.trim()) return;
            await onCreate(name);
            setName('');
          }}
          style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}
        >
          Create
        </Text>
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

function PickRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 }}>
      <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{selected ? '✓' : ''}</Text>
    </Pressable>
  );
}

/** Choose which of the person's collections (their own or shared with them) a post belongs to. Adding also saves it. */
export function CollectionSheet({ postId, visible, onClose, onSaved }: SheetProps & { onSaved?: () => void }) {
  const { profile } = useSession();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [c, m, inv] = await Promise.all([
      supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      supabase.from('collection_posts').select('collection_id').eq('user_id', profile.id).eq('post_id', postId),
      supabase.from('collection_members').select('collection_id').eq('user_id', profile.id).eq('status', 'invited'),
    ]);
    // Collections you were invited to but have not joined yet are not places to save to.
    const pending = new Set((inv.data ?? []).map((r) => r.collection_id));
    setItems((c.data ?? []).filter((x) => !pending.has(x.id)));
    setMember(new Set((m.data ?? []).map((r) => r.collection_id)));
  }, [profile, postId]);

  useEffect(() => {
    if (visible) {
      setError(null);
      void load();
    }
  }, [visible, load]);

  async function toggle(id: string) {
    tap();
    const next = !member.has(id);
    const { error: e } = await supabase.rpc('set_collection_post', { p_collection_id: id, p_post_id: postId, p_in: next });
    if (e) return setError(friendlyError(e.message));
    setMember((s) => {
      const n = new Set(s);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
    if (next) onSaved?.();
  }

  async function create(name: string) {
    const { data, error: e } = await supabase.rpc('create_collection', { p_name: name });
    if (e || !data) return setError(friendlyError(e?.message));
    setError(null);
    await load();
    await toggle(data.id);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Save to collection">
      {items.map((c) => (
        <PickRow key={c.id} label={c.name} selected={member.has(c.id)} onPress={() => void toggle(c.id)} />
      ))}
      <NewRow placeholder="New collection" onCreate={create} error={error} />
    </Sheet>
  );
}

/** Put the author's post into one of their series, or take it out. */
export function SeriesSheet({ postId, currentId, visible, onClose, onChanged }: SheetProps & { currentId: string | null; onChanged: (s: { id: string; title: string } | null) => void }) {
  const { profile } = useSession();
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('series').select('id, title').eq('author_id', profile.id).order('created_at', { ascending: false });
    setItems(data ?? []);
  }, [profile]);

  useEffect(() => {
    if (visible) {
      setError(null);
      void load();
    }
  }, [visible, load]);

  async function choose(s: { id: string; title: string } | null) {
    const { error: e } = await supabase.rpc('set_post_series', { p_post_id: postId, p_series_id: s?.id ?? null });
    if (e) return setError(friendlyError(e.message));
    onChanged(s);
    onClose();
  }

  async function create(title: string) {
    const { data, error: e } = await supabase.rpc('create_series', { p_title: title });
    if (e || !data) return setError(friendlyError(e?.message));
    await choose({ id: data.id, title: data.title });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add to a series">
      <PickRow label="No series" selected={!currentId} onPress={() => void choose(null)} />
      {items.map((s) => (
        <PickRow key={s.id} label={s.title} selected={s.id === currentId} onPress={() => void choose(s)} />
      ))}
      <NewRow placeholder="New series, like Part one" onCreate={create} error={error} />
    </Sheet>
  );
}

type Credit = { role: string; name: string };

/** Up to five free-text credits, such as "Photo · Sam". */
export function CreditsSheet({ postId, initial, visible, onClose, onSaved }: SheetProps & { initial: Credit[]; onSaved: (c: { position: number; role: string; name: string }[]) => void }) {
  const { colors, spacing } = useTheme();
  const [rows, setRows] = useState<Credit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setRows(initial.length ? initial.map((c) => ({ ...c })) : [{ role: '', name: '' }]);
    }
  }, [visible, initial]);

  async function save() {
    const clean = rows.map((r) => ({ role: r.role.trim(), name: r.name.trim() })).filter((r) => r.role || r.name);
    const { error: e } = await supabase.rpc('set_post_credits', { p_post_id: postId, p_credits: clean });
    if (e) return setError(friendlyError(e.message));
    onSaved(clean.map((c, position) => ({ position, ...c })));
    onClose();
  }

  const input = { color: colors.text, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, outlineStyle: 'none' } as never;
  return (
    <Sheet visible={visible} onClose={onClose} title="Credits">
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput accessibilityLabel={`Credit ${i + 1} role`} value={r.role} maxLength={30} placeholder="Role" placeholderTextColor={colors.textMuted} style={[{ flex: 1 }, input]} onChangeText={(t) => setRows((x) => x.map((y, j) => (j === i ? { ...y, role: t } : y)))} />
            <TextInput accessibilityLabel={`Credit ${i + 1} name`} value={r.name} maxLength={60} placeholder="Name" placeholderTextColor={colors.textMuted} style={[{ flex: 2 }, input]} onChangeText={(t) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: t } : y)))} />
          </View>
        ))}
        {rows.length < 5 ? (
          <Text accessibilityRole="button" onPress={() => setRows((x) => [...x, { role: '', name: '' }])} style={{ color: colors.primary, fontWeight: '600' }}>
            + Add another
          </Text>
        ) : null}
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        <Text accessibilityRole="button" onPress={save} style={{ color: colors.primary, fontWeight: '700', fontSize: 16, textAlign: 'center', paddingVertical: spacing.sm }}>
          Done
        </Text>
      </View>
    </Sheet>
  );
}
