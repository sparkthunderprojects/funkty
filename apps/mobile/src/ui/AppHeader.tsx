import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * Header for pushed screens. It sits above the screen's content instead of floating over it
 * (newer iPhones draw the built-in header translucent, which covered the top of posts), and
 * shows a plain back arrow instead of the previous route's technical name such as "(tabs)".
 */
export function AppHeader({ title, onBack }: { title?: string; onBack?: () => void }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
        <View style={{ width: 44 }}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>
          {title}
        </Text>
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}
