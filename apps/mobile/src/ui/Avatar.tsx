import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { mediaUrl } from '../lib/posts';
import { useTheme } from '../theme';

type Props = { username: string; storageKey?: string | null; size?: number };

export function Avatar({ username, storageKey, size = 34 }: Props) {
  const { colors } = useTheme();
  if (storageKey) {
    return (
      <Image
        source={{ uri: mediaUrl(storageKey) }}
        accessibilityLabel={`${username} profile photo`}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${username} profile photo`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: size * 0.42 }}>
        {username.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
