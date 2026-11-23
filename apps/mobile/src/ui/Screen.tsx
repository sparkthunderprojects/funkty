import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useTabBarSpace } from './layout';

type Props = { children: React.ReactNode; scroll?: boolean; /** Leave room for the floating tab bar. */ tabs?: boolean };

export function Screen({ children, scroll, tabs }: Props) {
  const { colors, spacing } = useTheme();
  const space = useTabBarSpace();
  const content = { padding: spacing.lg, paddingBottom: tabs ? space : spacing.lg, gap: spacing.md, flexGrow: 1 } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
