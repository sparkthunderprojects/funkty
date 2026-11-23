import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { minimumSignupAge } from '@funkty/core';
import { signUpSchema } from '@funkty/validation';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';

type Field = 'email' | 'password' | 'username' | 'birthDate' | 'country';
type Errors = Partial<Record<Field, string>>;

const BIRTH_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Best guess at the person's country from the device locale; they can change it. */
function defaultCountry(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.split('-')[1]?.toUpperCase() ?? '';
  } catch {
    return '';
  }
}

export default function SignUp() {
  const router = useRouter();
  const { colors, fontSize, spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState(defaultCountry());
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    setFormError(null);
    const next: Errors = {};
    if (!BIRTH_DATE.test(birthDate)) next.birthDate = 'Use the format YYYY-MM-DD.';
    const parsed = signUpSchema.safeParse({ email: email.trim(), password, username, birthDate, country });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        if (next[field]) continue;
        if (issue.message === 'under_minimum_age') {
          next.birthDate = `You must be at least ${minimumSignupAge(country || 'US')} to use Funkty.`;
        } else if (field === 'email') next.email = 'Enter a valid email address.';
        else if (field === 'password') next.password = 'Use 10 to 128 characters.';
        else if (field === 'username')
          next.username = 'Use 3 to 30 letters, numbers, dots or underscores.';
        else if (field === 'country') next.country = 'Enter a 2-letter country code, like US.';
        else next[field] = 'Check this field.';
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setBusy(true);
    const { data: free } = await supabase.rpc('username_available', { p_username: parsed.data.username });
    if (free === false) {
      setBusy(false);
      setErrors({ username: 'That username is taken.' });
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // Used to create the profile on first sign-in; the database re-checks every rule.
        data: { username: parsed.data.username, birth_date: birthDate, country: parsed.data.country },
      },
    });
    setBusy(false);
    if (error) {
      setFormError('We could not create that account. Check your details and try again.');
      return;
    }
    // With email verification on there is no session yet; ask the person to confirm their email.
    if (!data.session) setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <Screen>
        <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
          Check your email
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.body, lineHeight: 22 }}>
          We sent a confirmation link to {sentTo}. Open it, then come back and log in.
        </Text>
        <Button label="Go to log in" onPress={() => router.replace('/log-in')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        Create your account
      </Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
      />
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.username}
      />
      <TextField
        label="Date of birth (YYYY-MM-DD)"
        value={birthDate}
        onChangeText={setBirthDate}
        keyboardType="numbers-and-punctuation"
        placeholder="2000-01-31"
        maxLength={10}
        error={errors.birthDate}
      />
      <TextField
        label="Country (2-letter code)"
        value={country}
        onChangeText={(value) => setCountry(value.toUpperCase())}
        autoCapitalize="characters"
        maxLength={2}
        error={errors.country}
      />
      {formError ? <Text style={{ color: colors.danger }}>{formError}</Text> : null}
      <Text style={{ color: colors.textMuted, fontSize: fontSize.caption, marginBottom: spacing.xs }}>
        Funkty is for people 13 and over, or older where local law requires it.
      </Text>
      <Button label="Create account" onPress={submit} loading={busy} />
      <Button label="I already have an account" variant="ghost" onPress={() => router.replace('/log-in')} />
    </Screen>
  );
}
