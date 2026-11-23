import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tap for confirmations (like, save, follow). Does nothing on web. */
export function tap(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
