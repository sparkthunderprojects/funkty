import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';

type Restriction = {
  id: string;
  kind: string;
  feature: string | null;
  target_type: string;
  reason_text: string;
  status: string;
  automated: boolean;
  starts_at: string;
  ends_at: string | null;
  policies: { code: string; title: string; summary: string } | null;
};
type Appeal = { restriction_id: string; status: string; decision_note: string | null };

const kindLabel: Record<string, string> = {
  label: 'A label was added to your content',
  reduced_distribution: 'Your content is shown to fewer people',
  age_restriction: 'Your content is limited to adults',
  removal: 'Your content was removed',
  legal_removal: 'Your content was removed after a legal order',
  feature_limit: 'A feature is limited on your account',
  suspension: 'Your account is suspended',
  ban: 'Your account is banned',
};

/** Every action taken on the person's account or content, with the policy, the reason and a way to appeal. */
export default function AccountStatus() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const [items, setItems] = useState<Restriction[] | null>(null);
  const [appeals, setAppeals] = useState<Map<string, Appeal>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!profile) return;
    void Promise.all([
      supabase
        .from('restrictions')
        .select('id, kind, feature, target_type, reason_text, status, automated, starts_at, ends_at, policies(code, title, summary)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('appeals').select('restriction_id, status, decision_note').eq('user_id', profile.id),
    ]).then(([r, a]) => {
      setItems((r.data ?? []) as unknown as Restriction[]);
      setAppeals(new Map((a.data ?? []).map((x) => [x.restriction_id, x as Appeal])));
    });
  }, [profile]);
  useFocusEffect(load);

  async function appeal(id: string) {
    setError(null);
    const { error: e } = await supabase.rpc('appeal_restriction', { p_restriction: id, p_body: text });
    if (e) {
      setError(e.message === 'invalid_appeal_body' ? 'Please explain in at least 10 characters.' : e.message === 'already_appealed' ? 'You already appealed this.' : 'Something went wrong. Please try again.');
      return;
    }
    setOpen(null);
    setText('');
    load();
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {items && items.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>
            Your account is in good standing. If we ever limit your account or remove something, you will see which policy applied and why, and you can appeal.
          </Text>
        ) : null}
        {(items ?? []).map((r) => {
          const ap = appeals.get(r.id);
          return (
            <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md, gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{kindLabel[r.kind] ?? 'Action on your account'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {r.status === 'active' ? 'Active' : r.status === 'lifted' ? 'Lifted' : r.status === 'overturned' ? 'Overturned on appeal' : 'Ended'}{r.automated ? ' · decided automatically' : ''} · from {new Date(r.starts_at).toLocaleDateString()}
                {r.ends_at ? ` to ${new Date(r.ends_at).toLocaleDateString()}` : ''}
              </Text>
              {r.policies ? (
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  <Text style={{ fontWeight: '700' }}>Policy: {r.policies.title}. </Text>
                  {r.policies.summary}
                </Text>
              ) : null}
              <Text style={{ color: colors.text, fontSize: 14 }}>
                <Text style={{ fontWeight: '700' }}>Why: </Text>
                {r.reason_text}
              </Text>
              {ap ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Appeal {ap.status === 'open' ? 'sent. We will review it.' : ap.status === 'upheld' ? 'reviewed: the decision stands.' : 'reviewed: the decision was reversed.'}
                  {ap.decision_note ? ` ${ap.decision_note}` : ''}
                </Text>
              ) : open === r.id ? (
                <View style={{ gap: spacing.sm }}>
                  <TextInput
                    accessibilityLabel="Why should we reconsider?"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    placeholder="Why should we reconsider?"
                    placeholderTextColor={colors.textMuted}
                    style={{ color: colors.text, backgroundColor: colors.background, borderRadius: 10, padding: 12, minHeight: 90, textAlignVertical: 'top', outlineStyle: 'none' } as never}
                  />
                  {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
                  <Button label="Send appeal" onPress={() => void appeal(r.id)} compact />
                </View>
              ) : (
                <Button label="Appeal this" variant="secondary" onPress={() => { setOpen(r.id); setText(''); setError(null); }} compact />
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
