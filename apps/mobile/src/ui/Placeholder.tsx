import { Text } from 'react-native';
import { useTheme } from '../theme';
import { Screen } from './Screen';

/** Honest stand-in for tabs whose backend slice is not built yet. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.body, lineHeight: 22 }}>{note}</Text>
    </Screen>
  );
}
