import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';

export default function Welcome() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.sm }}>
        <Image
          source={require('../../assets/logo-full.png')}
          accessibilityRole="header"
          accessibilityLabel="Funkty"
          style={{ width: '100%', aspectRatio: 1536 / 1024, borderRadius: 16 }}
          contentFit="cover"
        />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600', textAlign: 'center' }}>
          Share what moves you.
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button label="Create account" onPress={() => router.push('/sign-up')} />
        <Button label="Log in" variant="secondary" onPress={() => router.push('/log-in')} />
      </View>
    </Screen>
  );
}
