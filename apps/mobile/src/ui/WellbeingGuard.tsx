import { Modal, Pressable, Text, View } from 'react-native';
import { useWellbeing } from '../lib/wellbeing';
import { useTheme } from '../theme';

const copy = {
  limit: { title: 'Daily limit reached', body: "You've used Funkty for as long as you set aside today. Time to put it down?", action: 'Remind me in 15 minutes' },
  break: { title: 'Time for a break', body: "You've been scrolling for a while. Stretch, look away from the screen, then come back.", action: 'Continue' },
  sleep: { title: 'Time to wind down', body: "It's late. Sleep is good for you. Funkty will still be here tomorrow.", action: 'Not now' },
} as const;

/** Gentle full-screen nudges for the screen time, break and sleep reminders. */
export function WellbeingGuard({ isTeen }: { isTeen: boolean }) {
  const { colors, spacing } = useTheme();
  const { reminder, dismiss } = useWellbeing(isTeen);
  if (!reminder) return null;
  const c = copy[reminder];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.background, borderRadius: 20, padding: spacing.lg, gap: spacing.md, maxWidth: 360, width: '100%' }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{c.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>{c.body}</Text>
          <Pressable accessibilityRole="button" onPress={dismiss} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 16 }}>{c.action}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
