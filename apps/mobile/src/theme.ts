import { useColorScheme } from 'react-native';
import { colors, fontSize, radius, spacing } from '@funkty/tokens';
import { useAppearance } from './lib/appearance';

export function useTheme() {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pref = useAppearance();
  const scheme = pref === 'system' ? system : pref;
  return { scheme, colors: colors[scheme], spacing, radius, fontSize } as const;
}

export type Theme = ReturnType<typeof useTheme>;
