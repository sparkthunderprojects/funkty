import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

/** The Funkty "F" mark (transparent background). */
export function Logo({ height = 32 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      accessibilityLabel="Funkty"
      style={{ height, width: height }}
      contentFit="contain"
    />
  );
}

/** The mark followed by the "funkty" wordmark, for headers. */
export function Wordmark({ height = 30 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel="Funkty">
      <Logo height={height} />
      <Text style={{ color: colors.text, fontSize: height * 0.82, fontWeight: '800', letterSpacing: -0.8 }}>funkty</Text>
    </View>
  );
}
