import { useColorScheme } from 'react-native';
import { colors, fontSize, radius, spacing } from '@funkty/tokens';

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme], spacing, radius, fontSize } as const;
}

export type Theme = ReturnType<typeof useTheme>;
