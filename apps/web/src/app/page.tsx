import { LIMITS, checkSignupAge } from '@funkty/core';
import { colors, radius, spacing } from '@funkty/tokens';
import { signUpSchema } from '@funkty/validation';

// Spike 1: this page proves @funkty/core, @funkty/validation and @funkty/tokens
// resolve and run in the web app. It is replaced by real pages in Phase 1.
const theme = colors.light;

export default function Home() {
  const sample = signUpSchema.safeParse({
    email: 'spike@funkty.com',
    password: 'spike-password-123',
    username: 'Spike.User',
    birthDate: '2000-01-01',
    country: 'us',
  });
  const ageCheck = checkSignupAge(new Date('2010-01-01'), 'US');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: theme.background,
        color: theme.text,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: theme.primary, fontSize: 28, margin: 0 }}>Funkty</h1>
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            background: theme.surface,
            borderRadius: radius.md,
            textAlign: 'left',
          }}
        >
          <p>Shared validation: {sample.success ? 'ok' : 'failed'}</p>
          <p>Caption limit: {LIMITS.caption.max}</p>
          <p>Age check (born 2010, US): {ageCheck.allowed ? 'allowed' : 'blocked'}</p>
        </div>
      </div>
    </main>
  );
}
