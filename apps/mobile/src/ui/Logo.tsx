import { Image } from 'expo-image';

/** The Funkty "F" mark (transparent background). */
export function Logo({ height = 32 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      accessibilityLabel="Funkty"
      style={{ height, width: height * (652 / 560) }}
      contentFit="contain"
    />
  );
}
