import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const tabBarHeight = 62;

/** Distance from the bottom of the screen to the floating tab bar. */
export function useTabBarOffset(): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, 12);
}

/** Bottom padding that keeps scrolling content clear of the floating tab bar. */
export function useTabBarSpace(): number {
  return tabBarHeight + useTabBarOffset() + 16;
}
