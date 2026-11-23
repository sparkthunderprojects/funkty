import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { mediaUrl } from '../lib/posts';
import { useTheme } from '../theme';

/** Profile photo as a rounded square inside a gradient ring. */
export function RingAvatar({ username, storageKey, size = 96 }: { username: string; storageKey?: string | null; size?: number }) {
  const { colors } = useTheme();
  const ring = size >= 80 ? 4 : 2.5;
  const gap = size >= 80 ? 3 : 2;
  const inner = size - 2 * (ring + gap);
  const outerRadius = size * 0.3;
  return (
    <LinearGradient
      colors={['#7C3AED', '#F43F5E', '#FBBF24']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ width: size, height: size, borderRadius: outerRadius, padding: ring }}
    >
      <View style={{ flex: 1, borderRadius: outerRadius - ring, backgroundColor: colors.background, padding: gap }}>
        {storageKey ? (
          <Image
            source={{ uri: mediaUrl(storageKey) }}
            accessibilityLabel={`${username} profile photo`}
            style={{ width: inner, height: inner, borderRadius: outerRadius - ring - gap, backgroundColor: colors.surface }}
            contentFit="cover"
          />
        ) : (
          <View
            accessibilityLabel={`${username} profile photo`}
            style={{ width: inner, height: inner, borderRadius: outerRadius - ring - gap, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: size * 0.36 }}>{username.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

/** Cover photo behind the profile header; a soft gradient stands in until one is chosen. */
export function ProfileBanner({ height = 120, storageKey }: { height?: number; storageKey?: string | null }) {
  if (storageKey) {
    return (
      <Image
        source={{ uri: mediaUrl(storageKey) }}
        accessibilityLabel="Cover photo"
        style={{ height, borderRadius: 28 }}
        contentFit="cover"
      />
    );
  }
  return (
    <LinearGradient
      colors={['#C7B5FF', '#FFC4CF', '#FFE2A8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ height, borderRadius: 28 }}
    />
  );
}
