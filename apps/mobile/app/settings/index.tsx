import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';

function Row({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 }}
    >
      <Ionicons name={icon} size={24} color={danger ? colors.danger : colors.text} />
      <Text style={{ flex: 1, color: danger ? colors.danger : colors.text, fontSize: 16 }}>{label}</Text>
      {danger ? null : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

export default function Settings() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  async function setPrivate(value: boolean) {
    if (!profile) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('profiles').update({ is_private: value }).eq('id', profile.id);
    setBusy(false);
    if (e) {
      setError(
        !value && profile.is_teen
          ? 'Accounts for people under 18 stay private.'
          : 'Could not change your account privacy. Please try again.',
      );
      return;
    }
    await refreshProfile();
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.text} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>Private account</Text>
            <Switch
              accessibilityLabel="Private account"
              value={profile.is_private}
              disabled={busy || (profile.is_teen && profile.is_private)}
              onValueChange={(v) => void setPrivate(v)}
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 36 }}>
            {profile.is_private
              ? 'Only people you approve can see your posts and stories.'
              : 'Anyone on Funkty can see your posts and stories.'}
          </Text>
          {error ? <Text style={{ color: colors.danger, fontSize: 13, marginLeft: 36 }}>{error}</Text> : null}
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row icon="heart-outline" label="Posts you've liked" onPress={() => router.push('/settings/liked')} />
        <Row icon="bookmark-outline" label="Saved" onPress={() => router.navigate('/profile')} />
        <Row icon="volume-mute-outline" label="Muted accounts" onPress={() => router.push('/settings/muted')} />
        <Row icon="person-remove-outline" label="Blocked accounts" onPress={() => router.push('/settings/blocked')} />
        <Row icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row icon="log-out-outline" label="Log out" danger onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
