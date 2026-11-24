import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { friendlyError } from '../lib/posts';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';

/** Opt in to being found by the email address on the account. Off unless the person turns it on. */
export function DiscoverSwitch() {
  const { colors } = useTheme();
  const { profile } = useSession();
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from('contact_discovery').select('discoverable').eq('user_id', profile.id).maybeSingle().then(({ data }) => setOn(!!data?.discoverable));
  }, [profile]);

  async function change(v: boolean) {
    setOn(v);
    setError(null);
    const { error: e } = await supabase.rpc('set_discoverable', { p_on: v });
    if (e) {
      setOn(!v);
      setError(friendlyError(e.message));
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' }}>Let contacts find me</Text>
        <Switch accessibilityLabel="Let contacts find me" value={on} onValueChange={(v) => void change(v)} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        People who have your account email in their contacts can find you when they use Find contacts. Your email is never shown to them. Off by default.
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
