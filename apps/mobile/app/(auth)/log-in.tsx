import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

export default function LogIn() {
  const router = useRouter();
  const { colors, fontSize } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const { error: failure } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    // One message for every failure so the screen never reveals which emails have accounts.
    if (failure) setError('That email and password do not match, or the email is not verified yet.');
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        Log in
      </Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={error}
      />
      <Button
        label="Log in"
        onPress={submit}
        loading={busy}
        disabled={!email.trim() || !password}
      />
      <Button label="Create an account instead" variant="ghost" onPress={() => router.replace('/sign-up')} />
    </Screen>
  );
}
