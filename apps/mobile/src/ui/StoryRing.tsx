import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../theme';

/**
 * Ring around an avatar in the stories tray. Unseen stories get Funkty's own magenta, violet
 * and blue gradient; seen stories a quiet grey line; no ring at all when `state` is "none".
 */
export function StoryRing({ size, state, children }: { size: number; state: 'unseen' | 'seen' | 'none'; children: React.ReactNode }) {
  const { colors } = useTheme();
  const outer = size + 12;
  if (state === 'none') {
    return <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
  }
  const inner = (
    <View style={{ width: outer - 6, height: outer - 6, borderRadius: outer, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
  return state === 'unseen' ? (
    <LinearGradient
      colors={['#FF2E93', '#8A3DFF', '#2D7BFF']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ width: outer, height: outer, borderRadius: outer, alignItems: 'center', justifyContent: 'center' }}
    >
      {inner}
    </LinearGradient>
  ) : (
    <View style={{ width: outer, height: outer, borderRadius: outer, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>{inner}</View>
  );
}
