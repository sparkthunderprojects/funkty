import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean };

/** Bottom sheet of actions, the same pattern as the profile menu on Instagram. */
export function ActionSheet({ visible, onClose, actions, stay }: { visible: boolean; onClose: () => void; actions: SheetAction[]; stay?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                // Multi-step sheets (confirm, report) stay open between steps; the action decides when to close.
                if (!stay) onClose();
                a.onPress();
              }}
              style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
            >
              <Text style={{ color: a.destructive ? colors.danger : colors.text, fontSize: 16, fontWeight: a.destructive ? '600' : '400' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
