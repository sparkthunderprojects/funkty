import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { LIMITS, checkSignupAge } from '@funkty/core';
import { colors, fontSize, radius, spacing } from '@funkty/tokens';
import { signUpSchema } from '@funkty/validation';

// Spike 1: this screen proves @funkty/core, @funkty/validation and @funkty/tokens
// resolve and run in the native app. It is replaced by real screens in Phase 1.
const theme = colors.light;
const sample = signUpSchema.safeParse({
  email: 'spike@funkty.com',
  password: 'spike-password-123',
  username: 'Spike.User',
  birthDate: '2000-01-01',
  country: 'us',
});
const ageCheck = checkSignupAge(new Date('2010-01-01'), 'US');

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Funkty</Text>
      <View style={styles.card}>
        <Text style={styles.body}>Shared validation: {sample.success ? 'ok' : 'failed'}</Text>
        <Text style={styles.body}>Caption limit: {LIMITS.caption.max}</Text>
        <Text style={styles.body}>
          Age check (born 2010, US): {ageCheck.allowed ? 'allowed' : 'blocked'}
        </Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: { color: theme.primary, fontSize: fontSize.headline, fontWeight: '700' },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  body: { color: theme.text, fontSize: fontSize.body },
});
