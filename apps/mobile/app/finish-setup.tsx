import { useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '../src/lib/session';
import { useTheme } from '../src/theme';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';

/** Shown when someone is signed in but the profile could not be created (for example the username was taken). */
export default function FinishSetup() {
  const { refreshProfile, signOut } = useSession();
  const { colors, fontSize } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>
        Finishing your account
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.body, lineHeight: 22 }}>
        We could not set up your profile yet. Try again, or log out and sign up with a different
        username.
      </Text>
      <Button
        label="Try again"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await refreshProfile();
          setBusy(false);
        }}
      />
      <Button label="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
